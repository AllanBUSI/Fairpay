import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { ProcedureStatus, PaymentStatus } from "@/app/generated/prisma/enums";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-11-17.clover",
});

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId manquant" }, { status: 400 });
    }

    // Récupérer la session depuis Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Vérifier que le paiement est bien autorisé (paid) avant de mettre à jour
    if (session.payment_status === "paid" && session.metadata?.procedureId) {
      const procedureId = session.metadata.procedureId;

      // Vérifier si la procédure a déjà été mise à jour
      const procedure = await prisma.procedure.findUnique({
        where: { id: procedureId },
      });

      console.log(`Vérification de la procédure ${procedureId}, statut actuel: ${procedure?.status}, paymentId: ${procedure?.paymentId}, paymentStatus: ${procedure?.paymentStatus}`);
      
      if (!procedure) {
        console.error(`Procédure ${procedureId} non trouvée`);
        return NextResponse.json({ error: "Procédure non trouvée" }, { status: 404 });
      }
      
      // Mettre à jour si la procédure est en BROUILLONS, n'a pas de paymentId, ou si le paymentStatus n'est pas SUCCEEDED
      const needsUpdate = procedure.status === ProcedureStatus.BROUILLONS || 
                         !procedure.paymentId || 
                         procedure.paymentStatus !== PaymentStatus.SUCCEEDED;
      
      if (needsUpdate) {
        console.log(`Procédure ${procedureId} nécessite une mise à jour (statut: ${procedure.status}, paymentId: ${procedure.paymentId}), mise à jour en NOUVEAU...`);
        
        // Vérifier si un paiement existe déjà
        let payment = await prisma.payment.findFirst({
          where: {
            stripePaymentIntentId: session.payment_intent as string,
          },
        });

        if (!payment) {
          console.log(`Création d'un nouveau paiement pour la session ${session.id}`);
          // Récupérer les détails du PaymentIntent pour avoir plus d'informations
          let chargeId = null;
          if (session.payment_intent) {
            try {
              const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string);
              chargeId = paymentIntent.latest_charge as string | null;
            } catch (err) {
              console.error("Erreur lors de la récupération du PaymentIntent:", err);
            }
          }
          
          // Créer le paiement avec toutes les informations
          payment = await prisma.payment.create({
            data: {
              userId: payload.userId,
              procedureId: procedure.id,
              stripePaymentIntentId: session.payment_intent as string,
              stripeChargeId: chargeId,
              amount: (session.amount_total || 0) / 100,
              currency: session.currency || "eur",
              status: PaymentStatus.SUCCEEDED,
              description: `Paiement de dossier - ${procedure.contexte || "Procédure"}`,
              metadata: {
                sessionId: session.id,
                ...session.metadata,
              } as any,
            },
          });
          console.log(`Paiement créé avec succès: ${payment.id}, montant: ${payment.amount} ${payment.currency}`);
        } else {
          console.log(`Paiement existant trouvé: ${payment.id}, mise à jour du statut...`);
          // Mettre à jour le paiement pour s'assurer qu'il est bien lié à la procédure
          payment = await prisma.payment.update({
            where: { id: payment.id },
            data: {
              procedureId: procedure.id,
              status: PaymentStatus.SUCCEEDED,
            },
          });
        }

        // Mettre à jour la procédure : passer de BROUILLONS à NOUVEAU
        // FORCER la mise à jour même si elle n'est pas exactement en BROUILLONS
        try {
          const updatedProcedure = await prisma.procedure.update({
            where: { id: procedure.id },
            data: {
              status: ProcedureStatus.NOUVEAU,
              paymentId: payment.id,
              paymentStatus: PaymentStatus.SUCCEEDED,
              updatedAt: new Date(),
            },
          });

          console.log(`✅ Procédure ${procedureId} mise à jour avec succès:`);
          console.log(`   - Statut: ${updatedProcedure.status}`);
          console.log(`   - PaymentId: ${updatedProcedure.paymentId}`);
          console.log(`   - PaymentStatus: ${updatedProcedure.paymentStatus}`);
          
          // Vérifier que la mise à jour a bien fonctionné
          const verification = await prisma.procedure.findUnique({
            where: { id: procedure.id },
            select: { status: true, paymentId: true, paymentStatus: true },
          });
          
          if (verification?.status !== ProcedureStatus.NOUVEAU) {
            console.error(`❌ ERREUR: La procédure n'a pas été mise à jour correctement. Statut actuel: ${verification?.status}`);
            // Réessayer une fois
            await prisma.procedure.update({
              where: { id: procedure.id },
              data: {
                status: ProcedureStatus.NOUVEAU,
                paymentId: payment.id,
                paymentStatus: PaymentStatus.SUCCEEDED,
              },
            });
          }
        } catch (updateError) {
          console.error(`Erreur lors de la mise à jour de la procédure:`, updateError);
          throw updateError;
        }

        return NextResponse.json({
          success: true,
          procedureId: procedure.id,
          status: ProcedureStatus.NOUVEAU,
          updated: true,
        });
      } else {
        // Vérifier si la procédure est déjà en NOUVEAU avec un paiement réussi
        if (procedure.status === ProcedureStatus.NOUVEAU && procedure.paymentId && procedure.paymentStatus === PaymentStatus.SUCCEEDED) {
          console.log(`Procédure ${procedureId} est déjà en NOUVEAU avec un paiement réussi`);
          return NextResponse.json({
            success: true,
            procedureId: procedure.id,
            status: procedure.status,
            alreadyUpdated: true,
          });
        } else {
          // La procédure n'est pas correctement mise à jour, forcer la mise à jour
          console.log(`Procédure ${procedureId} n'est pas correctement mise à jour, forcer la mise à jour...`);
          
          // Vérifier si un paiement existe pour cette session
          let payment = await prisma.payment.findFirst({
            where: {
              stripePaymentIntentId: session.payment_intent as string,
            },
          });

          if (!payment) {
            // Créer le paiement
            let chargeId = null;
            if (session.payment_intent) {
              try {
                const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string);
                chargeId = paymentIntent.latest_charge as string | null;
              } catch (err) {
                console.error("Erreur lors de la récupération du PaymentIntent:", err);
              }
            }
            
            payment = await prisma.payment.create({
              data: {
                userId: payload.userId,
                procedureId: procedure.id,
                stripePaymentIntentId: session.payment_intent as string,
                stripeChargeId: chargeId,
                amount: (session.amount_total || 0) / 100,
                currency: session.currency || "eur",
                status: PaymentStatus.SUCCEEDED,
                description: `Paiement de dossier - ${procedure.contexte || "Procédure"}`,
                metadata: {
                  sessionId: session.id,
                  ...session.metadata,
                } as any,
              },
            });
          }

          // Forcer la mise à jour
          let updatedProcedure = await prisma.procedure.update({
            where: { id: procedure.id },
            data: {
              status: ProcedureStatus.NOUVEAU,
              paymentId: payment.id,
              paymentStatus: PaymentStatus.SUCCEEDED,
              updatedAt: new Date(),
            },
          });

          // Créer une facture Stripe pour ce paiement si elle n'existe pas déjà
          try {
            const user = await prisma.user.findUnique({
              where: { id: payload.userId },
            });

            if (user && user.stripeCustomerId && session.payment_intent) {
              // Vérifier si une facture existe déjà pour ce paiement
              const existingInvoices = await stripe.invoices.list({
                customer: user.stripeCustomerId,
                limit: 100,
              });

              const invoiceExists = existingInvoices.data.some(
                (inv) => inv.metadata?.paymentId === payment.id || inv.metadata?.sessionId === session.id
              );

              if (!invoiceExists) {
                // Récupérer le PaymentIntent pour obtenir les détails
                const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string);
                
                // Créer une facture Stripe pour ce paiement
                const invoice = await stripe.invoices.create({
                  customer: user.stripeCustomerId,
                  collection_method: "charge_automatically",
                  auto_advance: false,
                  description: `Facture pour ${procedure.contexte || "Procédure"}`,
                  metadata: {
                    procedureId: procedure.id,
                    paymentId: payment.id,
                    sessionId: session.id,
                  },
                });

                // Ajouter les lignes de la facture basées sur les line_items de la session
                try {
                  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
                    expand: ["data.price.product"],
                  });

                  if (lineItems.data && lineItems.data.length > 0) {
                    for (const item of lineItems.data) {
                      await stripe.invoiceItems.create({
                        customer: user.stripeCustomerId,
                        invoice: invoice.id,
                        amount: item.amount_total || 0,
                        currency: item.currency || "eur",
                        description: item.description || "Article",
                      });
                    }
                  } else {
                    // Si pas de line_items, créer une ligne simple
                    await stripe.invoiceItems.create({
                      customer: user.stripeCustomerId,
                      invoice: invoice.id,
                      amount: session.amount_total || 0,
                      currency: session.currency || "eur",
                      description: `Paiement de dossier - ${procedure.contexte || "Procédure"}`,
                    });
                  }
                } catch (lineItemsError) {
                  console.error("Erreur lors de la récupération des line_items:", lineItemsError);
                  // Créer une ligne simple en cas d'erreur
                  await stripe.invoiceItems.create({
                    customer: user.stripeCustomerId,
                    invoice: invoice.id,
                    amount: session.amount_total || 0,
                    currency: session.currency || "eur",
                    description: `Paiement de dossier - ${procedure.contexte || "Procédure"}`,
                  });
                }

                // Finaliser et payer la facture
                const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
                await stripe.invoices.pay(finalizedInvoice.id);

                console.log(`✅ Facture Stripe créée via check-session-status: ${finalizedInvoice.id}`);
              }
            }
          } catch (invoiceError) {
            console.error("Erreur lors de la création de la facture Stripe:", invoiceError);
            // Ne pas faire échouer le traitement si la facture échoue
          }

          return NextResponse.json({
            success: true,
            procedureId: procedure.id,
            status: ProcedureStatus.NOUVEAU,
            updated: true,
            forced: true,
          });
        }
      }
    } else if (session.metadata?.procedureId) {
      // Paiement non autorisé : s'assurer que la procédure reste en BROUILLONS
      const procedureId = session.metadata.procedureId;
      const procedure = await prisma.procedure.findUnique({
        where: { id: procedureId },
      });

      if (procedure && procedure.status !== ProcedureStatus.BROUILLONS) {
        // Mettre à jour la procédure pour s'assurer qu'elle reste en BROUILLONS
        await prisma.procedure.update({
          where: { id: procedureId },
          data: {
            status: ProcedureStatus.BROUILLONS,
            paymentStatus: PaymentStatus.FAILED,
          },
        });
      }

      return NextResponse.json({
        success: false,
        paymentStatus: session.payment_status,
        message: "Paiement non autorisé, procédure reste en BROUILLONS",
      });
    }

    return NextResponse.json({
      success: false,
      paymentStatus: session.payment_status,
    });
  } catch (error) {
    console.error("Erreur lors de la vérification du statut de la session:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


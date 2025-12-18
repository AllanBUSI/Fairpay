import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { ProcedureStatus, PaymentStatus, DocumentType } from "@/app/generated/prisma/enums";

const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"] || "", {
  apiVersion: "2025-11-17.clover",
});

/**
 * Route API pour vérifier et traiter le paiement d'une injonction de paiement
 * 
 * Cette route :
 * 1. Vérifie que l'utilisateur est authentifié
 * 2. Récupère la session Stripe
 * 3. Vérifie que le paiement est complété
 * 4. Crée le paiement en base de données s'il n'existe pas
 * 5. Met à jour le statut de la procédure en INJONCTION_DE_PAIEMENT_PAYER
 * 6. Crée les documents (KBIS et attestation) si fournis
 * 7. Crée une facture Stripe pour l'injonction
 */
export async function POST(request: NextRequest) {
  try {
    console.log("🔔 verify-injonction-payment appelé");
    
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      console.error("❌ Token manquant");
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      console.error("❌ Token invalide");
      return NextResponse.json({ error: "Token invalide" }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, procedureId } = body;

    console.log(`📋 Paramètres reçus: sessionId=${sessionId}, procedureId=${procedureId}`);

    if (!sessionId || !procedureId) {
      console.error("❌ Paramètres manquants");
      return NextResponse.json(
        { error: "sessionId et procedureId requis" },
        { status: 400 }
      );
    }

    // Récupérer la session Stripe
    console.log(`🔍 Récupération de la session Stripe: ${sessionId}`);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    console.log(`📋 Session récupérée - payment_status: ${session.payment_status}, metadata:`, session.metadata);

    // Vérifier que c'est bien une injonction
    const sessionMetadata = session.metadata as Record<string, string> | undefined;
    if (sessionMetadata?.["isInjonction"] !== "true") {
      console.warn(`⚠️ Session ${sessionId} n'est pas marquée comme injonction (isInjonction: ${sessionMetadata?.["isInjonction"]})`);
      return NextResponse.json(
        { error: "Cette route est réservée aux injonctions de paiement" },
        { status: 400 }
      );
    }

    // Vérifier que le paiement est complété
    // Note: payment_status de Stripe est une chaîne, pas l'enum PaymentStatus de Prisma
    const paymentStatus = session.payment_status as string;
    if (paymentStatus === "open" || paymentStatus === "unpaid") {
      console.warn(`⚠️ Paiement en attente (${paymentStatus}) pour la session ${sessionId}`);
      return NextResponse.json({
        paid: false,
        paymentStatus: paymentStatus,
        error: "Le paiement est en attente et n'a pas été complété. Veuillez compléter le paiement.",
        message: "Le paiement n'est pas encore complété",
      }, { status: 400 });
    }

    if (paymentStatus !== "paid") {
      console.warn(`⚠️ Paiement non complété pour la session ${sessionId} - status: ${session.payment_status}`);
      return NextResponse.json({
        paid: false,
        paymentStatus: session.payment_status,
        error: `Le paiement n'a pas été complété. Statut: ${session.payment_status}`,
        message: "Le paiement n'est pas encore complété",
      }, { status: 400 });
    }

    console.log(`✅ Paiement confirmé pour la session ${sessionId}`);

    // IMPORTANT: procedureId est unique dans le schéma Prisma
    // Une procédure ne peut avoir qu'un seul paiement
    // On doit donc vérifier dans l'ordre :
    // 1. Si un paiement existe déjà pour cette procédure
    // 2. Si un paiement existe avec le même payment_intent
    // 3. Sinon, créer un nouveau paiement

    let payment: {
      status: PaymentStatus;
      id: string;
      createdAt: Date;
      updatedAt: Date;
      userId: string;
      procedureId: string | null;
      stripePaymentIntentId: string;
      stripeChargeId: string | null;
      amount: number;
      currency: string;
      description: string | null;
      metadata: any;
    } | null = null;

    // Étape 1: Vérifier si un paiement existe déjà pour cette procédure
    payment = await prisma.payment.findUnique({
      where: {
        procedureId: procedureId,
      },
    });

    if (payment) {
      console.log(`✅ Paiement existant trouvé pour la procédure ${procedureId}: ${payment.id}`);
      
      // Mettre à jour le paiement existant avec les nouvelles informations de la session
      try {
        let chargeId: string | null = null;
        if (session.payment_intent) {
          try {
            const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string);
            chargeId = paymentIntent.latest_charge as string | null;
          } catch (err) {
            console.error("Erreur lors de la récupération du PaymentIntent:", err);
          }
        }

        payment = await prisma.payment.update({
          where: { id: payment.id },
          data: {
            stripePaymentIntentId: session.payment_intent as string || payment.stripePaymentIntentId,
            stripeChargeId: chargeId || payment.stripeChargeId,
            amount: session.amount_total ? (session.amount_total / 100) : payment.amount,
            currency: session.currency || payment.currency,
            status: PaymentStatus.SUCCEEDED,
            description: payment.description || "Paiement pour demande d'injonction de payer",
            metadata: {
              sessionId: session.id,
              isInjonction: true,
              ...session.metadata,
              ...(payment.metadata as any || {}),
            } as any,
          },
        });

        console.log(`✅ Paiement ${payment.id} mis à jour avec succès`);
      } catch (updateError) {
        console.error("❌ Erreur lors de la mise à jour du paiement:", updateError);
        // Continuer avec le paiement existant même si la mise à jour échoue
      }
    } 
    // Étape 2: Si aucun paiement pour cette procédure, vérifier s'il existe un paiement avec le même payment_intent
    else if (session.payment_intent) {
      payment = await prisma.payment.findUnique({
        where: {
          stripePaymentIntentId: session.payment_intent as string,
        },
      });

      if (payment) {
        console.log(`✅ Paiement trouvé avec le même payment_intent: ${payment.id}`);
        
        // Si ce paiement a déjà un procedureId différent, on ne peut pas le modifier
        // (contrainte unique). Dans ce cas, on utilise ce paiement tel quel.
        if (payment.procedureId && payment.procedureId !== procedureId) {
          console.warn(`⚠️ Le paiement ${payment.id} est déjà lié à une autre procédure (${payment.procedureId}). Utilisation du paiement existant.`);
          // On continue avec ce paiement, mais on ne peut pas le lier à cette procédure
        } else {
          // Le paiement n'a pas de procedureId ou c'est le même, on peut le mettre à jour
          try {
            payment = await prisma.payment.update({
              where: { id: payment.id },
              data: {
                procedureId: procedureId,
                status: PaymentStatus.SUCCEEDED,
                metadata: {
                  sessionId: session.id,
                  isInjonction: true,
                  ...session.metadata,
                  ...(payment.metadata as any || {}),
                } as any,
              },
            });
            console.log(`✅ Paiement ${payment.id} lié à la procédure ${procedureId}`);
          } catch (updateError: any) {
            console.error("❌ Erreur lors de la mise à jour du paiement:", updateError);
            
            // Si l'erreur est due à une contrainte unique sur procedureId,
            // cela signifie qu'un autre paiement existe déjà pour cette procédure
            if (updateError.code === 'P2002' && updateError.meta?.target?.includes('procedureId')) {
              console.log("⚠️ Un autre paiement existe déjà pour cette procédure, récupération...");
              payment = await prisma.payment.findUnique({
                where: {
                  procedureId: procedureId,
                },
              });
              
              if (payment) {
                console.log(`✅ Paiement existant récupéré: ${payment.id}`);
              }
            }
          }
        }
      }
    }

    // Étape 3: Si aucun paiement n'a été trouvé, en créer un nouveau
    if (!payment && session.payment_intent) {
      console.log(`💰 Création d'un nouveau paiement d'injonction pour la procédure ${procedureId}`);
      
      let chargeId: string | null = null;
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string);
        chargeId = paymentIntent.latest_charge as string | null;
      } catch (err) {
        console.error("Erreur lors de la récupération du PaymentIntent:", err);
      }

      try {
        payment = await prisma.payment.create({
          data: {
            userId: payload.userId,
            procedureId: procedureId,
            stripePaymentIntentId: session.payment_intent as string,
            stripeChargeId: chargeId,
            amount: (session.amount_total || 0) / 100,
            currency: session.currency || "eur",
            status: PaymentStatus.SUCCEEDED,
            description: "Paiement pour demande d'injonction de payer",
            metadata: {
              sessionId: session.id,
              isInjonction: true,
              ...session.metadata,
            } as any,
          },
        });

        console.log(`✅ Paiement d'injonction créé: ${payment.id}`);
      } catch (createError: any) {
        console.error("❌ Erreur lors de la création du paiement:", createError);
        
        // Si l'erreur est due à une contrainte unique, récupérer le paiement existant
        if (createError.code === 'P2002') {
          const target = createError.meta?.target || [];
          
          if (target.includes('procedureId')) {
            console.log("⚠️ Un paiement existe déjà pour cette procédure, récupération...");
            payment = await prisma.payment.findUnique({
              where: {
                procedureId: procedureId,
              },
            });
          } else if (target.includes('stripePaymentIntentId')) {
            console.log("⚠️ Un paiement existe déjà avec ce payment_intent, récupération...");
            payment = await prisma.payment.findUnique({
              where: {
                stripePaymentIntentId: session.payment_intent as string,
              },
            });
          }
          
          if (payment) {
            console.log(`✅ Paiement existant récupéré: ${payment.id}`);
          } else {
            // Si on ne peut pas récupérer le paiement, on ne peut pas continuer
            throw new Error("Impossible de créer ou récupérer le paiement. Un paiement existe peut-être déjà pour cette procédure ou ce payment_intent.");
          }
        } else {
          throw createError;
        }
      }
    }

    // Récupérer la procédure
    const procedure = await prisma.procedure.findUnique({
      where: { id: procedureId },
    });

    if (!procedure) {
      return NextResponse.json(
        { error: "Procédure non trouvée" },
        { status: 404 }
      );
    }

    // Vérifier que la procédure est bien en INJONCTION_DE_PAIEMENT (ou déjà payée)
    if (procedure.status !== ProcedureStatus.INJONCTION_DE_PAIEMENT && 
        procedure.status !== ProcedureStatus.INJONCTION_DE_PAIEMENT_PAYER) {
      console.warn(`⚠️ Procédure ${procedureId} n'est pas en INJONCTION_DE_PAIEMENT (statut actuel: ${procedure.status})`);
      // On continue quand même pour créer le paiement et mettre à jour le statut
    }

    // S'assurer qu'on a un paiement avant de continuer
    if (!payment) {
      console.error(`❌ Aucun paiement trouvé ou créé pour la procédure ${procedureId}`);
      return NextResponse.json({
        error: "Impossible de créer ou récupérer le paiement",
        paid: false,
      }, { status: 500 });
    }

    // Mettre à jour le statut en INJONCTION_DE_PAIEMENT_PAYER si ce n'est pas déjà fait
    if (procedure.status !== ProcedureStatus.INJONCTION_DE_PAIEMENT_PAYER) {
      const kbisFilePath = sessionMetadata?.["kbisFilePath"];
      const attestationFilePath = sessionMetadata?.["attestationFilePath"];
      const hasFiles = kbisFilePath && attestationFilePath && kbisFilePath !== "" && attestationFilePath !== "";

      // Mettre à jour le statut de la procédure
      await prisma.procedure.update({
        where: { id: procedureId },
        data: {
          status: ProcedureStatus.INJONCTION_DE_PAIEMENT_PAYER,
          paymentId: payment.id,
          paymentStatus: PaymentStatus.SUCCEEDED,
          updatedAt: new Date(),
        },
      });

      console.log(`✅ Statut de la procédure ${procedureId} mis à jour à INJONCTION_DE_PAIEMENT_PAYER`);

      // Si les fichiers sont fournis, créer les documents
      if (hasFiles) {
        try {
          const procedureWithRelations = await prisma.procedure.findUnique({
            where: { id: procedureId },
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  prenom: true,
                  nom: true,
                },
              },
            },
          });

          if (procedureWithRelations) {
            // Créer un document pour le Kbis
            await prisma.document.create({
              data: {
                procedureId: procedureWithRelations.id,
                fileName: `KBIS-${procedureWithRelations.id}-${Date.now()}.pdf`,
                filePath: kbisFilePath,
                type: DocumentType.AUTRES_PREUVES,
                fileSize: 0,
                mimeType: "application/pdf",
              },
            });

            // Créer un document pour l'attestation signée
            await prisma.document.create({
              data: {
                procedureId: procedureWithRelations.id,
                fileName: `ATTESTATION-SIGNEE-${procedureWithRelations.id}-${Date.now()}.pdf`,
                filePath: attestationFilePath,
                type: DocumentType.AUTRES_PREUVES,
                fileSize: 0,
                mimeType: "application/pdf",
              },
            });

            // Créer un commentaire pour marquer la demande
            if (procedureWithRelations.user) {
              await prisma.comment.create({
                data: {
                  procedureId: procedureWithRelations.id,
                  userId: procedureWithRelations.user.id,
                  content: `[DEMANDE TRIBUNAL] L'utilisateur a demandé une saisie du tribunal avec injonction de payer et article 700 pour le remboursement des frais d'avocat. Kbis et attestation sur l'honneur signée uploadés.`,
                },
              });
            }

            console.log(`✅ Documents créés pour la procédure ${procedureId}`);
          }
        } catch (error) {
          console.error("Erreur lors de la création des documents:", error);
        }
      }

      // Vérifier si une facture existe déjà pour cette session (créée automatiquement par Checkout)
      // Si oui, on la met à jour avec les métadonnées. Sinon, on en crée une nouvelle.
      try {
        const user = await prisma.user.findUnique({
          where: { id: payload.userId },
        });

        if (user && user.stripeCustomerId && session.payment_intent) {
          // Vérifier si une facture existe déjà pour ce PaymentIntent
          let invoice: Stripe.Invoice | null = null;
          
          // 1. D'abord, vérifier si Checkout a créé une facture automatiquement
          if (session.invoice) {
            invoice = await stripe.invoices.retrieve(session.invoice as string);
            console.log(`✅ Facture créée automatiquement par Checkout: ${invoice.id}`);
            
            // Mettre à jour les métadonnées de la facture
            await stripe.invoices.update(invoice.id, {
              metadata: {
                ...invoice.metadata,
                procedureId: procedureId,
                paymentId: payment.id,
                sessionId: session.id,
                isInjonction: "true",
              },
            });
          } else {
            // 2. Si pas de facture créée par Checkout, chercher une facture existante liée à ce PaymentIntent
            try {
              const existingInvoices = await stripe.invoices.list({
                customer: user.stripeCustomerId,
                limit: 100,
              });

              const foundInvoice = existingInvoices.data.find(
                (inv: any) => {
                  const invMetadata = inv?.metadata as Record<string, string> | undefined;
                  return inv?.payment_intent === session.payment_intent ||
                         invMetadata?.["sessionId"] === session.id ||
                         invMetadata?.["paymentId"] === payment.id;
                }
              );
              invoice = foundInvoice || null;
              if (invoice) {
                console.log(`✅ Facture existante trouvée: ${invoice.id}`);
                // Mettre à jour les métadonnées si nécessaire
                const invoiceMetadata = invoice.metadata as Record<string, string> | undefined;
                if (!invoiceMetadata?.["procedureId"] || !invoiceMetadata?.["isInjonction"]) {
                  await stripe.invoices.update(invoice.id, {
                    metadata: {
                      ...invoiceMetadata,
                      procedureId: procedureId,
                      paymentId: payment.id,
                      sessionId: session.id,
                      isInjonction: "true",
                    },
                  });
                }
              } else {
                console.log(`ℹ️ Aucune facture trouvée. Checkout devrait créer la facture automatiquement si invoice_creation est activé.`);
                // Ne pas créer de facture manuellement - Checkout devrait le faire
              }
            } catch (listError) {
              console.warn("Erreur lors de la récupération des factures existantes:", listError);
            }
          }
        }
      } catch (invoiceError) {
        console.error("Erreur lors de la création/mise à jour de la facture Stripe pour l'injonction:", invoiceError);
        // Ne pas faire échouer le traitement du paiement si la facture échoue
      }
    }

    // Récupérer la procédure mise à jour pour retourner le statut actuel
    const updatedProcedure = await prisma.procedure.findUnique({
      where: { id: procedureId },
      select: { status: true, paymentId: true, paymentStatus: true },
    });

    return NextResponse.json({
      paid: true,
      paymentStatus: session.payment_status,
      procedureStatus: updatedProcedure?.status || procedure.status,
      procedureId: procedureId,
      success: true,
    });
  } catch (error) {
    console.error("Erreur lors de la vérification du paiement d'injonction:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Erreur serveur",
        paid: false,
      },
      { status: 500 }
    );
  }
}


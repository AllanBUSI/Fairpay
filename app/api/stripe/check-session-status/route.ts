import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { ProcedureStatus, PaymentStatus, SubscriptionStatus } from "@/app/generated/prisma/enums";

const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"] || "", {
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
    const sessionMetadata = session.metadata as Record<string, string> | undefined;

    // Si c'est une session en mode subscription (abonnement), gérer différemment
    if (session.mode === "subscription" && session.subscription) {
      return handleSubscriptionCheckout(session, payload);
    }

    // Vérifier si le paiement est en statut "open" (non payé)
    // Note: payment_status de Stripe est une chaîne, pas l'enum PaymentStatus de Prisma
    const paymentStatus = session.payment_status as string;
    if (paymentStatus === "open" || paymentStatus === "unpaid") {
      return NextResponse.json({
        success: false,
        paymentStatus: session.payment_status,
        error: "Le paiement est en attente et n'a pas été complété. Veuillez compléter le paiement.",
        paid: false,
      }, { status: 400 });
    }

    // Vérifier que le paiement est bien autorisé (paid) avant de mettre à jour
    if (session.payment_status === "paid" && sessionMetadata?.["procedureId"]) {
      const procedureId = sessionMetadata["procedureId"];

      // Vérifier si la procédure a déjà été mise à jour
      const procedure = await prisma.procedure.findUnique({
        where: { id: procedureId },
      });

      console.log(`Vérification de la procédure ${procedureId}, statut actuel: ${procedure?.status}, paymentId: ${procedure?.paymentId}, paymentStatus: ${procedure?.paymentStatus}`);
      
      if (!procedure) {
        console.error(`Procédure ${procedureId} non trouvée`);
        return NextResponse.json({ error: "Procédure non trouvée" }, { status: 404 });
      }
      
      // Si c'est une injonction, rediriger vers la route dédiée
      if (sessionMetadata?.["isInjonction"] === "true" || procedure.status === ProcedureStatus.INJONCTION_DE_PAIEMENT) {
        return NextResponse.json({
          error: "Les injonctions de paiement doivent utiliser la route /api/stripe/verify-injonction-payment",
          isInjonction: true,
        }, { status: 400 });
      }
      
      // Mettre à jour si la procédure est en BROUILLONS, n'a pas de paymentId, ou si le paymentStatus n'est pas SUCCEEDED
      const needsUpdate = procedure.status === ProcedureStatus.BROUILLONS || 
                         !procedure.paymentId || 
                         procedure.paymentStatus !== PaymentStatus.SUCCEEDED;
      
      if (needsUpdate) {
        console.log(`Procédure ${procedureId} nécessite une mise à jour (statut actuel: ${procedure.status}), mise à jour en NOUVEAU...`);
        
        // Vérifier si un paiement existe déjà
        let payment = await prisma.payment.findFirst({
          where: {
            stripePaymentIntentId: session.payment_intent as string,
          },
        });

        if (!payment) {
          console.log(`Création d'un nouveau paiement pour la session ${session.id}`);
          // Récupérer les détails du PaymentIntent pour avoir plus d'informations
          let chargeId: string | null = null;
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

        // Si hasFacturation est true, créer l'abonnement Stripe
        // Option 2 : Paiement initial + Abonnement séparé
        // Si createSubscriptionAfterPayment est true, créer l'abonnement après le paiement réussi
        if (sessionMetadata?.["hasFacturation"] === "true" || sessionMetadata?.["createSubscriptionAfterPayment"] === "true") {
          try {
            const user = await prisma.user.findUnique({
              where: { id: payload.userId },
            });

            if (user && user.stripeCustomerId && !user.stripeSubscriptionId) {
              console.log(`📦 Création de l'abonnement pour l'utilisateur ${user.id}...`);
              
              // Récupérer le priceId de l'abonnement depuis les métadonnées ou les variables d'environnement
              const subscriptionPriceId = sessionMetadata?.["subscriptionPriceId"] || process.env["STRIPE_PRICE_ID_ABONNEMENT"];
              
              if (!subscriptionPriceId) {
                console.error("❌ STRIPE_PRICE_ID_ABONNEMENT non configuré");
              } else {
                // Récupérer le PaymentIntent pour obtenir le payment_method
                let paymentMethodId: string | null = null;
                if (session.payment_intent) {
                  try {
                    const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string);
                    if (paymentIntent.payment_method) {
                      if (typeof paymentIntent.payment_method === 'string') {
                        paymentMethodId = paymentIntent.payment_method;
                      } else {
                        paymentMethodId = (paymentIntent.payment_method as any).id;
                      }
                    }
                  } catch (err) {
                    console.error("Erreur lors de la récupération du PaymentIntent:", err);
                  }
                }

                // Créer l'abonnement Stripe
                const subscriptionParams: Stripe.SubscriptionCreateParams = {
                  customer: user.stripeCustomerId,
                  items: [{ price: subscriptionPriceId }],
                  metadata: {
                    userId: user.id,
                    createdFromCheckout: "true",
                    checkoutSessionId: session.id,
                    procedureId: procedureId || "",
                  },
                };

                // Si on a un payment_method, l'attacher au customer et l'utiliser comme default
                if (paymentMethodId) {
                  try {
                    await stripe.paymentMethods.attach(paymentMethodId, {
                      customer: user.stripeCustomerId,
                    });
                    await stripe.customers.update(user.stripeCustomerId, {
                      invoice_settings: {
                        default_payment_method: paymentMethodId,
                      },
                    });
                    console.log(`✅ Payment method ${paymentMethodId} attaché au customer`);
                  } catch (pmError) {
                    console.error("Erreur lors de l'attachement du payment method:", pmError);
                  }
                }

                const subscription = await stripe.subscriptions.create(subscriptionParams);

                // Mettre à jour l'utilisateur avec le stripeSubscriptionId
                await prisma.user.update({
                  where: { id: user.id },
                  data: {
                    stripeSubscriptionId: subscription.id,
                  },
                });

                // Créer l'entrée dans la table Subscription
                const statusMap: Record<string, SubscriptionStatus> = {
                  active: SubscriptionStatus.ACTIVE,
                  trialing: SubscriptionStatus.TRIALING,
                  past_due: SubscriptionStatus.PAST_DUE,
                  canceled: SubscriptionStatus.CANCELED,
                  unpaid: SubscriptionStatus.UNPAID,
                };

                const subscriptionData = subscription as any;
                await prisma.subscription.upsert({
                  where: { stripeSubscriptionId: subscription.id },
                  create: {
                    userId: user.id,
                    stripeSubscriptionId: subscription.id,
                    stripePriceId: subscriptionPriceId,
                    status: statusMap[subscription.status] || SubscriptionStatus.TRIALING,
                    currentPeriodStart: new Date((subscriptionData.current_period_start || Date.now() / 1000) * 1000),
                    currentPeriodEnd: new Date((subscriptionData.current_period_end || (Date.now() / 1000 + 30 * 24 * 60 * 60)) * 1000),
                    cancelAtPeriodEnd: subscriptionData.cancel_at_period_end || false,
                  },
                  update: {
                    status: statusMap[subscription.status] || SubscriptionStatus.TRIALING,
                    currentPeriodStart: new Date((subscriptionData.current_period_start || Date.now() / 1000) * 1000),
                    currentPeriodEnd: new Date((subscriptionData.current_period_end || (Date.now() / 1000 + 30 * 24 * 60 * 60)) * 1000),
                    cancelAtPeriodEnd: subscriptionData.cancel_at_period_end || false,
                  },
                });

                console.log(`✅ Abonnement créé: ${subscription.id} pour l'utilisateur ${user.id}`);
              }
            } else if (user && user.stripeSubscriptionId) {
              console.log(`ℹ️ L'utilisateur ${user.id} a déjà un abonnement: ${user.stripeSubscriptionId}`);
            }
          } catch (subscriptionError) {
            console.error("Erreur lors de la création de l'abonnement:", subscriptionError);
            // Ne pas faire échouer le traitement si l'abonnement échoue
          }
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
            let chargeId: string | null = null;
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

          // Forcer la mise à jour en NOUVEAU
          await prisma.procedure.update({
            where: { id: procedure.id },
            data: {
              status: ProcedureStatus.NOUVEAU,
              paymentId: payment.id,
              paymentStatus: PaymentStatus.SUCCEEDED,
              updatedAt: new Date(),
            },
          });

          // Récupérer la facture créée automatiquement par Checkout (si invoice_creation est activé)
          try {
            const user = await prisma.user.findUnique({
              where: { id: payload.userId },
            });

            if (user && user.stripeCustomerId && session.invoice) {
              // Checkout a créé une facture automatiquement, la récupérer et mettre à jour ses métadonnées
              const invoice = await stripe.invoices.retrieve(session.invoice as string);
              
              // Mettre à jour les métadonnées de la facture pour lier au paiement
              await stripe.invoices.update(invoice.id, {
                metadata: {
                  ...invoice.metadata,
                  procedureId: procedure.id,
                  paymentId: payment.id,
                  sessionId: session.id,
                },
              });

              console.log(`✅ Facture Stripe récupérée depuis Checkout: ${invoice.id} (statut: ${invoice.status})`);
            } else if (user && user.stripeCustomerId && session.payment_intent) {
              // Si pas d'invoice créée par Checkout, chercher si une facture existe déjà pour ce PaymentIntent
              const existingInvoices = await stripe.invoices.list({
                customer: user.stripeCustomerId,
                limit: 100,
              });

              const invoiceExists = existingInvoices.data.find(
                (inv) => {
                  const invMetadata = inv.metadata as Record<string, string> | undefined;
                  return (inv as any).payment_intent === session.payment_intent || 
                         invMetadata?.["paymentId"] === payment.id || 
                         invMetadata?.["sessionId"] === session.id;
                }
              );

              if (!invoiceExists) {
                console.log(`ℹ️ Aucune facture trouvée pour ce paiement. Checkout devrait créer la facture automatiquement si invoice_creation est activé.`);
              } else {
                console.log(`✅ Facture existante trouvée: ${invoiceExists.id} (statut: ${invoiceExists.status})`);
              }
            }
          } catch (invoiceError) {
            console.error("Erreur lors de la récupération de la facture Stripe:", invoiceError);
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
    } else if (sessionMetadata?.["procedureId"]) {
      // Paiement non autorisé : s'assurer que la procédure reste en BROUILLONS
      const procedureId = sessionMetadata["procedureId"];
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

      // Si le statut est "open" ou "unpaid", renvoyer une erreur spécifique
      const paymentStatus = session.payment_status as string;
      if (paymentStatus === "open" || paymentStatus === "unpaid") {
        return NextResponse.json({
          success: false,
          paymentStatus: session.payment_status,
          error: "Le paiement est en attente et n'a pas été complété. Veuillez compléter le paiement.",
          paid: false,
        }, { status: 400 });
      }

      return NextResponse.json({
        success: false,
        paymentStatus: session.payment_status,
        error: `Le paiement n'a pas été complété. Statut: ${session.payment_status}`,
        message: "Paiement non autorisé, procédure reste en BROUILLONS",
        paid: false,
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      paymentStatus: session.payment_status,
      error: `Le paiement n'a pas été complété. Statut: ${session.payment_status}`,
      paid: false,
    }, { status: 400 });
  } catch (error) {
    console.error("Erreur lors de la vérification du statut de la session:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

// Fonction pour gérer les sessions d'abonnement
async function handleSubscriptionCheckout(
  session: Stripe.Checkout.Session,
  payload: { userId: string }
) {
  try {
    console.log(`📦 Traitement d'une session d'abonnement: ${session.id}`);

    // Récupérer la subscription depuis Stripe
    const subscriptionId = typeof session.subscription === 'string' 
      ? session.subscription 
      : session.subscription?.id;
    
    if (!subscriptionId) {
      return NextResponse.json(
        { error: "Abonnement non trouvé dans la session" },
        { status: 400 }
      );
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || !user.stripeCustomerId) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé" },
        { status: 404 }
      );
    }

    // Mettre à jour l'utilisateur avec le stripeSubscriptionId
    await prisma.user.update({
      where: { id: user.id },
      data: {
        stripeSubscriptionId: subscription.id,
      },
    });

    // Créer/mettre à jour l'entrée dans la table Subscription
    const subscriptionData = subscription as any;
    const statusMap: Record<string, SubscriptionStatus> = {
      active: SubscriptionStatus.ACTIVE,
      trialing: SubscriptionStatus.TRIALING,
      past_due: SubscriptionStatus.PAST_DUE,
      canceled: SubscriptionStatus.CANCELED,
      unpaid: SubscriptionStatus.UNPAID,
    };

    await prisma.subscription.upsert({
      where: { stripeSubscriptionId: subscription.id },
      create: {
        userId: user.id,
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscription.items.data[0]?.price.id || "",
        status: statusMap[subscription.status] || SubscriptionStatus.TRIALING,
        currentPeriodStart: new Date((subscriptionData.current_period_start || Date.now() / 1000) * 1000),
        currentPeriodEnd: new Date((subscriptionData.current_period_end || (Date.now() / 1000 + 30 * 24 * 60 * 60)) * 1000),
        cancelAtPeriodEnd: subscriptionData.cancel_at_period_end || false,
      },
      update: {
        status: statusMap[subscription.status] || SubscriptionStatus.TRIALING,
        currentPeriodStart: new Date((subscriptionData.current_period_start || Date.now() / 1000) * 1000),
        currentPeriodEnd: new Date((subscriptionData.current_period_end || (Date.now() / 1000 + 30 * 24 * 60 * 60)) * 1000),
        cancelAtPeriodEnd: subscriptionData.cancel_at_period_end || false,
      },
    });

    console.log(`✅ Abonnement créé/mis à jour: ${subscription.id}`);

    // Si la session contient un procedureId dans les métadonnées, ajouter la procédure comme invoice item
    const procedureId = session?.metadata?.["procedureId"];
    if (procedureId) {
      try {
        const procedure = await prisma.procedure.findUnique({
          where: { id: procedureId },
        });

        if (procedure && procedure.status === ProcedureStatus.BROUILLONS) {
          // Calculer le montant de la procédure (99 € HT avec abonnement)
          const procedureAmountHT = 99;
          const procedureAmountTTC = procedureAmountHT * 1.20;

          // Récupérer la première facture de l'abonnement
          const invoices = await stripe.invoices.list({
            subscription: subscription.id,
            limit: 1,
          });

          // Correction: Ensure invoice is never assigned undefined (Type 'Invoice | undefined' is not assignable to type 'Invoice | null').
          let invoice: Stripe.Invoice | null = null;
          if (invoices.data.length > 0 && invoices.data[0]) {
            invoice = invoices.data[0] as Stripe.Invoice;
          } else {
            // Créer une facture pour l'abonnement si elle n'existe pas encore
            invoice = await stripe.invoices.create({
              customer: user.stripeCustomerId,
              subscription: subscription.id,
              auto_advance: false, // Ne pas finaliser automatiquement
            });
          }

          // Ajouter la procédure comme invoice item
          await stripe.invoiceItems.create({
            customer: user.stripeCustomerId,
            invoice: invoice?.id ?? undefined,
            amount: Math.round(procedureAmountTTC * 100), // En centimes
            currency: "eur",
            description: `Mise en demeure - ${procedure.contexte || "Procédure"}`,
            metadata: {
              procedureId: procedureId,
              userId: user.id,
            },
          });

          // Finaliser et payer la facture si elle n'est pas encore finalisée
          if (invoice && invoice.status === "draft") {
            invoice = await stripe.invoices.finalizeInvoice(invoice.id);
          }

          // Créer un paiement pour la procédure
          const invoiceData = invoice as any;
          let payment = await prisma.payment.create({
            data: {
              userId: user.id,
              procedureId: procedureId,
              stripePaymentIntentId: invoiceData.payment_intent || "",
              amount: procedureAmountTTC,
              currency: "eur",
              status: PaymentStatus.SUCCEEDED,
              description: `Mise en demeure - ${procedure.contexte || "Procédure"}`,
              metadata: {
                sessionId: session.id,
                subscriptionId: subscription.id,
                invoiceId: invoiceData.id,
                hasFacturation: "true",
              } as any,
            },
          });

          // Mettre à jour la procédure
          await prisma.procedure.update({
            where: { id: procedureId },
            data: {
              status: ProcedureStatus.NOUVEAU,
              paymentId: payment.id,
              paymentStatus: PaymentStatus.SUCCEEDED,
              updatedAt: new Date(),
            },
          });

          console.log(`✅ Procédure ${procedureId} ajoutée à la facture d'abonnement et mise à jour`);
        }
      } catch (procedureError) {
        console.error("Erreur lors de l'ajout de la procédure à la facture:", procedureError);
        // Ne pas faire échouer le traitement de l'abonnement si l'ajout de la procédure échoue
      }
    }

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      procedureId: procedureId || null,
    });
  } catch (error) {
    console.error("Erreur lors du traitement de l'abonnement:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


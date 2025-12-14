import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { ProcedureStatus, PaymentStatus, DocumentType } from "@/app/generated/prisma/enums";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-12-18.acacia",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Signature manquante" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Erreur de signature webhook:", err);
    return NextResponse.json(
      { error: "Signature invalide" },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        // Vérifier que le paiement est bien réussi avant de mettre à jour
        if (session.payment_status === "paid") {
          await handleCheckoutSuccess(session);
        } else {
          console.log(`Session ${session.id} complétée mais paiement non autorisé, statut: ${session.payment_status}`);
          // Mettre à jour la procédure pour s'assurer qu'elle reste en BROUILLONS
          if (session.metadata?.procedureId) {
            await prisma.procedure.update({
              where: { id: session.metadata.procedureId },
              data: {
                paymentStatus: PaymentStatus.FAILED,
                status: ProcedureStatus.BROUILLONS,
              },
            }).catch((err) => {
              console.error("Erreur lors de la mise à jour de la procédure en BROUILLONS:", err);
            });
          }
        }
        break;
      }

      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log(`Paiement asynchrone échoué pour la session ${session.id}`);
        // Mettre à jour la procédure pour s'assurer qu'elle reste en BROUILLONS
        if (session.metadata?.procedureId) {
          await prisma.procedure.update({
            where: { id: session.metadata.procedureId },
            data: {
              paymentStatus: PaymentStatus.FAILED,
              status: ProcedureStatus.BROUILLONS,
            },
          }).catch((err) => {
            console.error("Erreur lors de la mise à jour de la procédure en BROUILLONS:", err);
          });
        }
        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentSuccess(paymentIntent);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentFailure(paymentIntent);
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionUpdate(subscription);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionCancellation(subscription);
        break;
      }

      default:
        console.log(`Événement non géré: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Erreur lors du traitement du webhook:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}

async function handleCheckoutSuccess(session: Stripe.Checkout.Session) {
  try {
    const userId = session.metadata?.userId;
    const procedureId = session.metadata?.procedureId;

    console.log("handleCheckoutSuccess appelé avec:", { userId, procedureId, sessionId: session.id, paymentStatus: session.payment_status });

    if (!userId) {
      console.error("userId manquant dans les métadonnées");
      return;
    }

    if (!procedureId) {
      console.error("procedureId manquant dans les métadonnées");
      return;
    }

    // Vérifier que le paiement est bien autorisé/réussi
    if (session.payment_status !== "paid") {
      console.log(`Paiement non autorisé pour la session ${session.id}, statut: ${session.payment_status}`);
      // Ne pas mettre à jour la procédure, elle reste en BROUILLONS
      return;
    }

    // Récupérer la procédure depuis la base de données
    const procedure = await prisma.procedure.findUnique({
      where: { id: procedureId },
      include: { client: true },
    });

    if (!procedure) {
      console.error(`Procédure ${procedureId} non trouvée`);
      return;
    }

    console.log(`Procédure trouvée: ${procedure.id}, statut actuel: ${procedure.status}, paymentId: ${procedure.paymentId}, paymentStatus: ${procedure.paymentStatus}`);

    // Si la procédure est déjà en NOUVEAU avec un paiement réussi, ne rien faire
    if (procedure.status === ProcedureStatus.NOUVEAU && procedure.paymentId && procedure.paymentStatus === PaymentStatus.SUCCEEDED) {
      console.log(`Procédure ${procedure.id} est déjà en NOUVEAU avec un paiement réussi, pas de mise à jour nécessaire`);
      return;
    }

    // Vérifier si un paiement existe déjà pour cette session
    const existingPayment = await prisma.payment.findFirst({
      where: {
        stripePaymentIntentId: session.payment_intent as string,
      },
    });

    let payment;
    if (existingPayment) {
      console.log("Paiement existant trouvé, mise à jour...");
      payment = await prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          status: PaymentStatus.SUCCEEDED,
          procedureId: procedure.id,
        },
      });
    } else {
      console.log("Création d'un nouveau paiement...");
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
          userId,
          procedureId: procedure.id,
          stripePaymentIntentId: session.payment_intent as string,
          stripeChargeId: chargeId,
          amount: (session.amount_total || 0) / 100, // Convertir de centimes en euros
          currency: session.currency || "eur",
          status: PaymentStatus.SUCCEEDED,
          description: `Paiement de dossier - ${procedure.contexte || "Procédure"}`,
          metadata: {
            sessionId: session.id,
            ...session.metadata,
          } as any,
        },
      });
      console.log(`Paiement créé via webhook: ${payment.id}, montant: ${payment.amount} ${payment.currency}`);
    }

    console.log(`Paiement créé/mis à jour: ${payment.id}`);

    // Mettre à jour la procédure : passer de BROUILLONS à NOUVEAU et lier le paiement
    // FORCER la mise à jour même si elle n'est pas exactement en BROUILLONS
    if (procedure.status !== ProcedureStatus.BROUILLONS) {
      console.log(`Procédure ${procedure.id} n'est pas en BROUILLONS (statut: ${procedure.status}), mise à jour quand même...`);
    }
    
    const updatedProcedure = await prisma.procedure.update({
      where: { id: procedure.id },
      data: {
        status: ProcedureStatus.NOUVEAU,
        paymentId: payment.id,
        paymentStatus: PaymentStatus.SUCCEEDED,
        updatedAt: new Date(),
      },
    });

    console.log(`✅ Procédure mise à jour via webhook: ${updatedProcedure.id}`);
    console.log(`   - Nouveau statut: ${updatedProcedure.status}`);
    console.log(`   - PaymentId: ${updatedProcedure.paymentId}`);
    console.log(`   - PaymentStatus: ${updatedProcedure.paymentStatus}`);

    // Créer une facture Stripe pour ce paiement unique
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (user && user.stripeCustomerId && session.payment_intent) {
        // Récupérer le PaymentIntent pour obtenir les détails
        const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string);
        
        // Créer une facture Stripe pour ce paiement
        const invoice = await stripe.invoices.create({
          customer: user.stripeCustomerId,
          collection_method: "charge_automatically",
          auto_advance: false, // Ne pas finaliser automatiquement
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

        console.log(`✅ Facture Stripe créée: ${finalizedInvoice.id}`);
      }
    } catch (invoiceError) {
      console.error("Erreur lors de la création de la facture Stripe:", invoiceError);
      // Ne pas faire échouer le traitement du paiement si la facture échoue
    }

    // Si l'utilisateur a pris l'abonnement, créer l'abonnement Stripe
    const hasFacturation = session.metadata?.hasFacturation === "true";
    if (hasFacturation) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
        });

        if (!user) {
          console.error(`Utilisateur ${userId} non trouvé pour créer l'abonnement`);
          return;
        }

        // Vérifier si l'utilisateur a déjà un abonnement actif
        const existingSubscription = await prisma.subscription.findFirst({
          where: {
            userId: user.id,
            status: {
              in: ["ACTIVE", "TRIALING"],
            },
          },
        });

        if (existingSubscription) {
          console.log(`Utilisateur ${userId} a déjà un abonnement actif: ${existingSubscription.id}`);
          return;
        }

        const priceId = process.env.STRIPE_PRICE_ID;
        if (!priceId) {
          console.error("STRIPE_PRICE_ID non configuré, impossible de créer l'abonnement");
          return;
        }

        // Créer l'abonnement Stripe
        const stripeSubscription = await stripe.subscriptions.create({
          customer: user.stripeCustomerId || session.customer as string,
          items: [{ price: priceId }],
          metadata: {
            userId: user.id,
          },
        });

        console.log(`✅ Abonnement Stripe créé: ${stripeSubscription.id}`);

        // Créer l'enregistrement d'abonnement dans la base de données
        const statusMap: Record<string, any> = {
          active: "ACTIVE",
          canceled: "CANCELED",
          past_due: "PAST_DUE",
          unpaid: "UNPAID",
          trialing: "TRIALING",
        };

        await prisma.subscription.create({
          data: {
            userId: user.id,
            stripeSubscriptionId: stripeSubscription.id,
            stripePriceId: priceId,
            status: statusMap[stripeSubscription.status] || "TRIALING",
            currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
            currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
            canceledAt: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : null,
          },
        });

        // Mettre à jour l'utilisateur avec l'ID de l'abonnement Stripe
        await prisma.user.update({
          where: { id: user.id },
          data: {
            stripeSubscriptionId: stripeSubscription.id,
          },
        });

        console.log(`✅ Abonnement enregistré dans la base de données pour l'utilisateur ${userId}`);
      } catch (subscriptionError) {
        console.error("Erreur lors de la création de l'abonnement:", subscriptionError);
        // Ne pas faire échouer le traitement du paiement si l'abonnement échoue
      }
    }
  } catch (error) {
    console.error("Erreur dans handleCheckoutSuccess:", error);
    throw error;
  }
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const userId = paymentIntent.metadata?.userId;
  const procedureDataStr = paymentIntent.metadata?.procedureData;
  const hasFacturation = paymentIntent.metadata?.hasFacturation === "true";
  const existingProcedureId = paymentIntent.metadata?.procedureId;

  if (!userId) {
    console.error("userId manquant dans les métadonnées");
    return;
  }

  // Créer ou mettre à jour le paiement
  const payment = await prisma.payment.upsert({
    where: { stripePaymentIntentId: paymentIntent.id },
    update: {
      status: PaymentStatus.SUCCEEDED,
      stripeChargeId: paymentIntent.latest_charge as string | null,
      updatedAt: new Date(),
    },
    create: {
      userId,
      stripePaymentIntentId: paymentIntent.id,
      stripeChargeId: paymentIntent.latest_charge as string | null,
      amount: paymentIntent.amount / 100, // Convertir de centimes en euros
      currency: paymentIntent.currency,
      status: PaymentStatus.SUCCEEDED,
      description: paymentIntent.description || "Paiement de dossier",
      metadata: paymentIntent.metadata as any,
    },
  });

  // Vérifier si la procédure existe déjà (créée immédiatement après paiement)
  const existingPayment = await prisma.payment.findUnique({
    where: { stripePaymentIntentId: paymentIntent.id },
    include: { procedure: true },
  });

  // Si la procédure existe déjà, ne rien faire (elle a été créée immédiatement)
  if (existingPayment?.procedure) {
    console.log("Procédure déjà créée pour ce paiement");
    return;
  }

  // Si des données de procédure sont présentes, créer ou mettre à jour la procédure
  if (procedureDataStr) {
    try {
      const procedureData = JSON.parse(procedureDataStr);
      const { nom, prenom, siret, nomSociete, adresse, codePostal, ville, email, telephone, contexte, dateFactureEchue, montantDue, montantTTC, dateRelance, dateRelance2, documents, echeancier, hasEcheancier } = procedureData;
      
      // Si une procédure existe déjà (brouillon), la mettre à jour
      if (existingProcedureId) {
        const existingProcedure = await prisma.procedure.findUnique({
          where: { id: existingProcedureId },
          include: { client: true, documents: true },
        });

        if (existingProcedure && existingProcedure.status === ProcedureStatus.BROUILLONS) {
          // Mettre à jour le client
          let client = existingProcedure.client;
          if (client && siret && !siret.startsWith("DRAFT-")) {
            // Si le SIRET a changé (n'est plus un draft), mettre à jour ou créer un nouveau client
            if (client.siret !== siret) {
              let newClient = await prisma.client.findUnique({ where: { siret } });
              if (!newClient) {
                newClient = await prisma.client.create({
                  data: {
                    nom,
                    prenom,
                    siret,
                    nomSociete: nomSociete || null,
                    adresse: adresse || null,
                    codePostal: codePostal || null,
                    ville: ville || null,
                    email: email || null,
                    telephone: telephone || null,
                  },
                });
              } else {
                newClient = await prisma.client.update({
                  where: { id: newClient.id },
                  data: {
                    nomSociete: nomSociete || newClient.nomSociete,
                    adresse: adresse || newClient.adresse,
                    codePostal: codePostal || newClient.codePostal,
                    ville: ville || newClient.ville,
                    email: email || newClient.email,
                    telephone: telephone || newClient.telephone,
                  },
                });
              }
              client = newClient;
            } else {
              // Mettre à jour le client existant
              client = await prisma.client.update({
                where: { id: client.id },
                data: {
                  nom,
                  prenom,
                  nomSociete: nomSociete || client.nomSociete,
                  adresse: adresse || client.adresse,
                  codePostal: codePostal || client.codePostal,
                  ville: ville || client.ville,
                  email: email || client.email,
                  telephone: telephone || client.telephone,
                },
              });
            }
          }

          // Supprimer les anciens documents
          await prisma.document.deleteMany({
            where: { procedureId: existingProcedureId },
          });

          // Mettre à jour la procédure
          const procedure = await prisma.procedure.update({
            where: { id: existingProcedureId },
            data: {
              clientId: client.id,
              contexte,
              dateFactureEchue: dateFactureEchue ? new Date(dateFactureEchue) : new Date(),
              montantDue: montantDue !== null && montantDue !== undefined ? parseFloat(montantDue) : null,
              montantTTC: montantTTC !== undefined ? Boolean(montantTTC) : true,
              dateRelance: dateRelance ? new Date(dateRelance) : null,
              dateRelance2: dateRelance2 ? new Date(dateRelance2) : null,
              paymentId: payment.id,
              paymentStatus: PaymentStatus.SUCCEEDED,
              status: ProcedureStatus.NOUVEAU,
              hasFacturation,
              hasEcheancier: hasEcheancier || false,
              echeancier: echeancier && Array.isArray(echeancier) && echeancier.length > 0
                ? echeancier.slice(0, 5)
                : null,
              documents: documents && Array.isArray(documents) && documents.length > 0
                ? {
                    create: documents.map((doc: any) => ({
                      type: doc.type as DocumentType,
                      fileName: doc.fileName || "document",
                      filePath: doc.filePath,
                      fileSize: doc.fileSize || 0,
                      mimeType: doc.mimeType || "application/octet-stream",
                      numeroFacture: doc.numeroFacture || null,
                      dateFactureEchue: doc.dateFactureEchue ? new Date(doc.dateFactureEchue) : null,
                      montantDue: doc.montantDue ? parseFloat(doc.montantDue) : null,
                      montantTTC: doc.montantTTC !== undefined ? Boolean(doc.montantTTC) : null,
                    })),
                  }
                : undefined,
            },
            include: {
              client: true,
              documents: true,
            },
          });

          // Lier le paiement à la procédure
          await prisma.payment.update({
            where: { id: payment.id },
            data: { procedureId: procedure.id },
          });

          return; // Sortir de la fonction car on a mis à jour
        }
      }

      // Sinon, créer une nouvelle procédure (code existant)
      // Vérifier ou créer le client
      let client = await prisma.client.findUnique({
        where: { siret },
      });

      if (!client) {
        client = await prisma.client.create({
          data: {
            nom,
            prenom,
            siret,
            nomSociete: nomSociete || null,
            adresse: adresse || null,
            codePostal: codePostal || null,
            ville: ville || null,
            email: email || null,
            telephone: telephone || null,
          },
        });
      } else {
        // Mettre à jour les informations du client si elles ont changé
        client = await prisma.client.update({
          where: { id: client.id },
          data: {
            nomSociete: nomSociete || client.nomSociete,
            adresse: adresse || client.adresse,
            codePostal: codePostal || client.codePostal,
            ville: ville || client.ville,
            email: email || client.email,
            telephone: telephone || client.telephone,
          },
        });
      }

      // Créer la procédure avec le statut NOUVEAU
      const procedure = await prisma.procedure.create({
        data: {
          clientId: client.id,
          userId,
          contexte,
          dateFactureEchue: dateFactureEchue ? new Date(dateFactureEchue) : new Date(),
          montantDue: montantDue !== null && montantDue !== undefined ? parseFloat(montantDue) : null,
          montantTTC: montantTTC !== undefined ? Boolean(montantTTC) : true,
          dateRelance: dateRelance ? new Date(dateRelance) : null,
          dateRelance2: dateRelance2 ? new Date(dateRelance2) : null,
          paymentId: payment.id,
          paymentStatus: PaymentStatus.SUCCEEDED,
          status: ProcedureStatus.NOUVEAU,
          hasFacturation,
          hasEcheancier: hasEcheancier || false,
          echeancier: echeancier && Array.isArray(echeancier) && echeancier.length > 0
            ? echeancier.slice(0, 5)
            : null,
          documents: documents && Array.isArray(documents) && documents.length > 0
            ? {
                create: documents.map((doc: any) => ({
                  type: doc.type as DocumentType,
                  fileName: doc.fileName || "document",
                  filePath: doc.filePath,
                  fileSize: doc.fileSize || 0,
                  mimeType: doc.mimeType || "application/octet-stream",
                  numeroFacture: doc.numeroFacture || null,
                  dateFactureEchue: doc.dateFactureEchue ? new Date(doc.dateFactureEchue) : null,
                  montantDue: doc.montantDue ? parseFloat(doc.montantDue) : null,
                  montantTTC: doc.montantTTC !== undefined ? Boolean(doc.montantTTC) : null,
                })),
              }
            : undefined,
        },
        include: {
          client: true,
          documents: true,
        },
      });

      // Lier le paiement à la procédure
      await prisma.payment.update({
        where: { id: payment.id },
        data: { procedureId: procedure.id },
      });
    } catch (error) {
      console.error("Erreur lors de la création/mise à jour de la procédure:", error);
    }
  }
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  const userId = paymentIntent.metadata?.userId;
  const procedureId = paymentIntent.metadata?.procedureId;
  const procedureDataStr = paymentIntent.metadata?.procedureData;

  if (!userId) {
    console.error("userId manquant dans les métadonnées");
    return;
  }

  // Mettre à jour le paiement
  await prisma.payment.upsert({
    where: { stripePaymentIntentId: paymentIntent.id },
    update: {
      status: PaymentStatus.FAILED,
      updatedAt: new Date(),
    },
    create: {
      userId,
      stripePaymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      status: PaymentStatus.FAILED,
      description: paymentIntent.description || "Paiement de dossier",
      metadata: paymentIntent.metadata as any,
    },
  });

  // Si une procédure existe déjà (via procedureId), la mettre à jour en BROUILLONS
  if (procedureId) {
    try {
      const existingProcedure = await prisma.procedure.findUnique({
        where: { id: procedureId },
      });

      if (existingProcedure) {
        await prisma.procedure.update({
          where: { id: procedureId },
          data: {
            status: ProcedureStatus.BROUILLONS,
            paymentStatus: PaymentStatus.FAILED,
          },
        });
        console.log(`Procédure ${procedureId} mise à jour en BROUILLONS suite à l'échec du paiement`);
        return; // Ne pas créer une nouvelle procédure si on a mis à jour l'existante
      }
    } catch (error) {
      console.error("Erreur lors de la mise à jour de la procédure existante:", error);
    }
  }

  // Si des données de procédure sont présentes, créer la procédure en BROUILLONS
  if (procedureDataStr) {
    try {
      const procedureData = JSON.parse(procedureDataStr);
      const { nom, prenom, siret, nomSociete, adresse, codePostal, ville, email, telephone, contexte, dateFactureEchue, montantDue, montantTTC, dateRelance, dateRelance2, documents, echeancier, hasEcheancier } = procedureData;
      
      // Vérifier ou créer le client
      let client = await prisma.client.findUnique({
        where: { siret },
      });

      if (!client) {
        client = await prisma.client.create({
          data: {
            nom,
            prenom,
            siret,
            nomSociete: nomSociete || null,
            adresse: adresse || null,
            codePostal: codePostal || null,
            ville: ville || null,
            email: email || null,
            telephone: telephone || null,
          },
        });
      } else {
        // Mettre à jour les informations du client si elles ont changé
        client = await prisma.client.update({
          where: { id: client.id },
          data: {
            nomSociete: nomSociete || client.nomSociete,
            adresse: adresse || client.adresse,
            codePostal: codePostal || client.codePostal,
            ville: ville || client.ville,
            email: email || client.email,
            telephone: telephone || client.telephone,
          },
        });
      }

      const procedure = await prisma.procedure.create({
        data: {
          clientId: client.id,
          userId,
          contexte,
          dateFactureEchue: new Date(dateFactureEchue),
          montantDue: montantDue !== null && montantDue !== undefined ? parseFloat(montantDue) : null,
          montantTTC: montantTTC !== undefined ? Boolean(montantTTC) : true,
          dateRelance: dateRelance ? new Date(dateRelance) : null,
          dateRelance2: dateRelance2 ? new Date(dateRelance2) : null,
          paymentStatus: PaymentStatus.FAILED,
          status: ProcedureStatus.BROUILLONS,
          hasEcheancier: hasEcheancier || false,
          echeancier: echeancier && Array.isArray(echeancier) && echeancier.length > 0
            ? echeancier.slice(0, 5)
            : null,
          documents: documents && Array.isArray(documents) && documents.length > 0
            ? {
                create: documents.map((doc: any) => ({
                  type: doc.type as DocumentType,
                  fileName: doc.fileName || "document",
                  filePath: doc.filePath,
                  fileSize: doc.fileSize || 0,
                  mimeType: doc.mimeType || "application/octet-stream",
                  numeroFacture: doc.numeroFacture || null,
                  dateFactureEchue: doc.dateFactureEchue ? new Date(doc.dateFactureEchue) : null,
                  montantDue: doc.montantDue ? parseFloat(doc.montantDue) : null,
                  montantTTC: doc.montantTTC !== undefined ? Boolean(doc.montantTTC) : null,
                })),
              }
            : undefined,
        },
        include: {
          client: true,
          documents: true,
        },
      });
    } catch (error) {
      console.error("Erreur lors de la création de la procédure en brouillon:", error);
    }
  }
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    // Essayer de trouver l'utilisateur par customerId
    const user = await prisma.user.findFirst({
      where: { stripeCustomerId: subscription.customer as string },
    });
    if (!user) {
      console.error("Utilisateur non trouvé pour la facturation");
      return;
    }
    userId = user.id;
  }

  const statusMap: Record<string, any> = {
    active: "ACTIVE",
    canceled: "CANCELED",
    past_due: "PAST_DUE",
    unpaid: "UNPAID",
    trialing: "TRIALING",
  };

  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: subscription.id },
    update: {
      status: statusMap[subscription.status] || "TRIALING",
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      updatedAt: new Date(),
    },
    create: {
      userId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: subscription.items.data[0]?.price.id || "",
      status: statusMap[subscription.status] || "TRIALING",
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });

  // Mettre à jour l'utilisateur
  await prisma.user.update({
    where: { id: userId },
    data: { stripeSubscriptionId: subscription.id },
  });
}

async function handleSubscriptionCancellation(subscription: Stripe.Subscription) {
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: subscription.customer as string },
  });

  if (!user) {
      console.error("Utilisateur non trouvé pour la facturation annulée");
    return;
  }

  await prisma.subscription.updateMany({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: "CANCELED",
      canceledAt: new Date(),
      updatedAt: new Date(),
    },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { stripeSubscriptionId: null },
  });
}


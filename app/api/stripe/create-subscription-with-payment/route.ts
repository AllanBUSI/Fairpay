import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { SubscriptionStatus, PaymentStatus, ProcedureStatus } from "@/app/generated/prisma/enums";

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
    const { procedureData, procedureId } = body;

    // Récupérer l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    // Vérifier si l'utilisateur a déjà un abonnement actif
    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId: user.id },
    });

    if (existingSubscription && (existingSubscription.status === SubscriptionStatus.ACTIVE || existingSubscription.status === SubscriptionStatus.TRIALING)) {
      return NextResponse.json(
        { error: "Vous avez déjà un abonnement actif" },
        { status: 400 }
      );
    }

    // Si un abonnement existe mais est annulé, le supprimer avant d'en créer un nouveau
    if (existingSubscription) {
      // Annuler l'abonnement Stripe s'il existe encore
      if (existingSubscription.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(existingSubscription.stripeSubscriptionId);
        } catch (error) {
          console.error("Erreur lors de l'annulation de l'ancien abonnement Stripe:", error);
          // Continuer même si l'annulation échoue
        }
      }
      // Supprimer l'ancien abonnement de la base de données
      await prisma.subscription.delete({
        where: { userId: user.id },
      });
    }

    // Récupérer ou créer le client Stripe
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user.id,
        },
      });
      stripeCustomerId = customer.id;

      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId },
      });
    }

    // Récupérer le priceId de l'abonnement (TTC)
    // Essayer d'abord un Price ID TTC s'il existe, sinon créer un prix TTC dynamiquement
    let subscriptionPriceId = process.env["STRIPE_PRICE_ID_ABONNEMENT_TTC"];

    if (!subscriptionPriceId) {
      // Si pas de Price ID TTC, récupérer le produit de l'abonnement et créer un prix TTC
      const basePriceId = process.env["STRIPE_PRICE_ID_ABONNEMENT"];
      if (!basePriceId) {
        return NextResponse.json(
          { error: "Price ID d'abonnement non configuré" },
          { status: 500 }
        );
      }

      try {
        // Récupérer le prix de base pour obtenir le produit
        const basePrice = await stripe.prices.retrieve(basePriceId);
        const productId = typeof basePrice.product === 'string' ? basePrice.product : basePrice.product.id;

        // Créer un prix TTC (34,80€ = 3480 centimes)
        const ttcPrice = await stripe.prices.create({
          product: productId,
          unit_amount: 3480, // 34,80€ TTC en centimes
          currency: 'eur',
          recurring: {
            interval: 'month',
          },
          metadata: {
            isTTC: 'true',
            basePriceId: basePriceId,
          },
        });

        subscriptionPriceId = ttcPrice.id;
        console.log(`✅ Prix TTC créé pour l'abonnement: ${subscriptionPriceId}`);
      } catch (error) {
        console.error("Erreur lors de la création du prix TTC:", error);
        // En cas d'erreur, utiliser le prix de base et ajuster le montant
        subscriptionPriceId = basePriceId;
      }
    }

    // Montant de la mise en demeure avec abonnement (99€ HT = 118.80€ TTC)
    const procedureAmountHT = 99;
    const procedureAmountTTC = procedureAmountHT * 1.20;

    // Créer le PaymentIntent pour la mise en demeure
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(procedureAmountTTC * 100), // En centimes
      currency: "eur",
      customer: stripeCustomerId,
      description: "Mise en demeure avec abonnement",
      metadata: {
        userId: user.id,
        procedureId: procedureId || "",
        hasSubscription: "true",
      },
      setup_future_usage: "off_session", // Pour permettre les paiements récurrents
    });

    // Créer l'abonnement avec 30 jours d'essai gratuit
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: subscriptionPriceId }],
      trial_period_days: 30, // 30 jours gratuits
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      metadata: {
        userId: user.id,
        paymentIntentId: paymentIntent.id,
      },
      expand: ["latest_invoice.payment_intent"],
    });

    // Récupérer le clientSecret depuis le PaymentIntent de l'abonnement ou utiliser celui du paiement
    let clientSecret: string | null = null;

    // Si l'abonnement a un PaymentIntent (pour la période d'essai, il peut être null)
    const latestInvoice = subscription.latest_invoice;
    if (
      latestInvoice &&
      typeof latestInvoice === "object" &&
      "payment_intent" in latestInvoice &&
      latestInvoice.payment_intent &&
      typeof latestInvoice.payment_intent === "object" &&
      "client_secret" in latestInvoice.payment_intent
    ) {
      // Type assertion is safe here due to the above checks
      const pi = latestInvoice.payment_intent as { client_secret?: string };
      if (pi.client_secret) {
        clientSecret = pi.client_secret;
      }
    }

    // Si pas de clientSecret depuis l'abonnement, utiliser celui du PaymentIntent de la mise en demeure
    if (!clientSecret) {
      clientSecret = paymentIntent.client_secret;
    }

    if (!clientSecret) {
      return NextResponse.json(
        { error: "Impossible de créer le secret de paiement" },
        { status: 500 }
      );
    }

    // Créer ou mettre à jour la procédure si procedureData est fourni
    let finalProcedureId = procedureId;
    if (procedureData && !procedureId) {
      // Extraire les données du client depuis procedureData
      // Les données peuvent être dans procedureData.client ou directement dans procedureData
      const clientData = procedureData.client || {
        nom: procedureData.nom || "",
        prenom: procedureData.prenom || "",
        email: procedureData.email || "",
        telephone: procedureData.telephone || "",
        adresse: procedureData.adresse || "",
        codePostal: procedureData.codePostal || "",
        ville: procedureData.ville || "",
        nomSociete: procedureData.nomSociete || null,
        siret: procedureData.siret || `temp_${Date.now()}`,
      };

      if (!clientData.nom || !clientData.prenom || !clientData.siret) {
        throw new Error("Les informations du client sont requises (nom, prenom, siret)");
      }

      // Créer le client d'abord si nécessaire
      let clientId: string;
      // Vérifier si le client existe déjà par SIRET
      let client = clientData.siret
        ? await prisma.client.findUnique({
          where: { siret: clientData.siret },
        })
        : null;

      if (!client) {
        // Créer le client
        client = await prisma.client.create({
          data: {
            nom: clientData.nom || "",
            prenom: clientData.prenom || "",
            email: clientData.email || "",
            telephone: clientData.telephone || "",
            adresse: clientData.adresse || "",
            codePostal: clientData.codePostal || "",
            ville: clientData.ville || "",
            nomSociete: clientData.nomSociete || null,
            siret: clientData.siret || `temp_${Date.now()}`, // SIRET temporaire si non fourni
          },
        });
      }
      clientId = client.id;

      // Créer la procédure en brouillon
      const procedure = await prisma.procedure.create({
        data: {
          clientId,
          userId: user.id,
          status: ProcedureStatus.BROUILLONS,
          contexte: procedureData.contexte || "",
          dateFactureEchue: procedureData.dateFactureEchue
            ? new Date(procedureData.dateFactureEchue)
            : new Date(),
          montantDue: procedureData.montantDue !== null && procedureData.montantDue !== undefined
            ? parseFloat(procedureData.montantDue.toString())
            : null,
          montantTTC: procedureData.montantTTC !== undefined
            ? Boolean(procedureData.montantTTC)
            : true,
          dateRelance: procedureData.dateRelance ? new Date(procedureData.dateRelance) : null,
          dateRelance2: procedureData.dateRelance2 ? new Date(procedureData.dateRelance2) : null,
          hasEcheancier: procedureData.hasEcheancier || false,
          echeancier: procedureData.echeancier && Array.isArray(procedureData.echeancier) && procedureData.echeancier.length > 0
            ? procedureData.echeancier.slice(0, 5)
            : undefined,
          documents: procedureData.documents && Array.isArray(procedureData.documents) && procedureData.documents.length > 0
            ? {
              create: procedureData.documents.map((doc: any) => ({
                type: doc.type,
                fileName: doc.fileName || "document",
                filePath: doc.filePath,
                fileSize: doc.fileSize || 0,
                mimeType: doc.mimeType || "application/octet-stream",
                numeroFacture: doc.numeroFacture || null,
                dateFactureEchue: doc.dateFactureEchue ? new Date(doc.dateFactureEchue) : null,
                montantDue: doc.montantDue ? parseFloat(doc.montantDue.toString()) : null,
                montantTTC: doc.montantTTC !== undefined ? Boolean(doc.montantTTC) : null,
              })),
            }
            : undefined,
        },
      });
      finalProcedureId = procedure.id;
    }

    // Créer l'entrée Payment dans la base de données
    const payment = await prisma.payment.create({
      data: {
        userId: user.id,
        procedureId: finalProcedureId || null,
        stripePaymentIntentId: paymentIntent.id,
        amount: procedureAmountTTC,
        currency: "eur",
        status: PaymentStatus.PENDING,
        description: "Mise en demeure avec abonnement",
        metadata: {
          subscriptionId: subscription.id,
          paymentIntentId: paymentIntent.id,
          hasSubscription: true,
        } as any,
      },
    });

    console.log(`✅ Paiement créé: ${payment.id} pour la procédure ${finalProcedureId || "null"} avec PaymentIntent ${paymentIntent.id}`);

    // Créer l'entrée Subscription dans la base de données
    const subscriptionData = subscription as any;
    const statusMap: Record<string, SubscriptionStatus> = {
      active: SubscriptionStatus.ACTIVE,
      trialing: SubscriptionStatus.TRIALING,
      past_due: SubscriptionStatus.PAST_DUE,
      canceled: SubscriptionStatus.CANCELED,
      unpaid: SubscriptionStatus.UNPAID,
      incomplete: SubscriptionStatus.TRIALING,
      incomplete_expired: SubscriptionStatus.CANCELED,
    };

    // Créer le nouvel abonnement (on a déjà supprimé l'ancien s'il existait)
    await prisma.subscription.create({
      data: {
        userId: user.id,
        stripeSubscriptionId: subscription.id,
        stripePriceId: subscriptionPriceId,
        status: statusMap[subscription.status] || SubscriptionStatus.TRIALING,
        currentPeriodStart: new Date((subscriptionData.current_period_start || Date.now() / 1000) * 1000),
        currentPeriodEnd: new Date((subscriptionData.current_period_end || (Date.now() / 1000 + 30 * 24 * 60 * 60)) * 1000),
        cancelAtPeriodEnd: subscriptionData.cancel_at_period_end || false,
      },
    });

    // Mettre à jour l'utilisateur avec le stripeSubscriptionId
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeSubscriptionId: subscription.id },
    });

    return NextResponse.json({
      clientSecret,
      subscriptionId: subscription.id,
      paymentIntentId: paymentIntent.id,
      procedureId: finalProcedureId,
    });
  } catch (error) {
    console.error("Erreur lors de la création de l'abonnement avec paiement:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


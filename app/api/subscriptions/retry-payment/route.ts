import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";

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
    const { subscriptionId } = body;

    if (!subscriptionId) {
      return NextResponse.json(
        { error: "subscriptionId requis" },
        { status: 400 }
      );
    }

    // Récupérer l'abonnement
    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId: payload.userId,
      },
    });

    if (!subscription || !subscription.stripeSubscriptionId) {
      return NextResponse.json(
        { error: "Abonnement non trouvé" },
        { status: 404 }
      );
    }

    // Récupérer l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || !user.stripeCustomerId) {
      return NextResponse.json(
        { error: "Client Stripe non trouvé" },
        { status: 404 }
      );
    }

    // Récupérer la dernière facture impayée
    const invoices = await stripe.invoices.list({
      subscription: subscription.stripeSubscriptionId,
      status: "open",
      limit: 1,
    });

    let clientSecret: string | null = null;

    if (invoices.data.length > 0 && invoices.data[0]) {
      // Il y a une facture ouverte, créer un PaymentIntent pour la payer
      const invoice = invoices.data[0];
      
      // Finaliser la facture si elle est en brouillon
      if (invoice.status === "draft") {
        await stripe.invoices.finalizeInvoice(invoice.id);
      }

      // Récupérer le PaymentIntent de la facture
      const paymentIntentId = (invoice as unknown as { payment_intent?: string | Stripe.PaymentIntent }).payment_intent;
      if (paymentIntentId && typeof paymentIntentId === "string") {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        clientSecret = paymentIntent.client_secret;
      } else if (paymentIntentId && typeof paymentIntentId === "object" && "client_secret" in paymentIntentId) {
        // Ici paymentIntentId est sûrement Stripe.PaymentIntent
        clientSecret = (paymentIntentId as Stripe.PaymentIntent).client_secret || null;
      }

      // Si pas de PaymentIntent, en créer un
      if (!clientSecret) {
        // S'il n'existe pas de PaymentIntent pour cette facture ouverte, en créer un
        const paymentIntent = await stripe.paymentIntents.create({
          amount: invoice.amount_due,
          currency: invoice.currency || "eur",
          customer: user.stripeCustomerId,
          description: `Paiement de l'abonnement - Facture ${invoice.number || invoice.id}`,
          metadata: {
            userId: user.id,
            subscriptionId: subscription.id,
            invoiceId: invoice.id,
            isSubscriptionRetry: "true",
          },
        });
        clientSecret = paymentIntent.client_secret;

        // Attacher le PaymentIntent à la facture via update
        await stripe.invoices.update(invoice.id, {
          default_payment_method: undefined,
        });
      }
    } else {
      // Pas de facture ouverte, créer une nouvelle facture pour l'abonnement
      const newInvoice = await stripe.invoices.create({
        customer: user.stripeCustomerId,
        subscription: subscription.stripeSubscriptionId,
        auto_advance: false,
      });

      // Finaliser la facture
      const finalizedInvoice = await stripe.invoices.finalizeInvoice(newInvoice.id);

      // Récupérer ou créer le PaymentIntent
      const finalizedPaymentIntentId = (finalizedInvoice as unknown as { payment_intent?: string | Stripe.PaymentIntent }).payment_intent;
      if (finalizedPaymentIntentId && typeof finalizedPaymentIntentId === "string") {
        const paymentIntent = await stripe.paymentIntents.retrieve(finalizedPaymentIntentId);
        clientSecret = paymentIntent.client_secret;
      } else {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: finalizedInvoice.amount_due,
          currency: finalizedInvoice.currency || "eur",
          customer: user.stripeCustomerId,
          description: `Paiement de l'abonnement - Facture ${finalizedInvoice.number || finalizedInvoice.id}`,
          metadata: {
            userId: user.id,
            subscriptionId: subscription.id,
            invoiceId: finalizedInvoice.id,
            isSubscriptionRetry: "true",
          },
        });
        clientSecret = paymentIntent.client_secret;
      }
    }

    if (!clientSecret) {
      return NextResponse.json(
        { error: "Impossible de créer le secret de paiement" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      clientSecret,
      subscriptionId: subscription.id,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
    });
  } catch (error) {
    console.error("Erreur lors de la création du retry de paiement d'abonnement:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


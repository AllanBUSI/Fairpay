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
    const { priceId } = body;

    if (!priceId) {
      return NextResponse.json({ error: "Price ID requis" }, { status: 400 });
    }

    // Récupérer ou créer le client Stripe
    let user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

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

    // Vérifier si l'utilisateur a déjà une facturation active
    if (user.stripeSubscriptionId) {
      const existingSubscription = await stripe.subscriptions.retrieve(
        user.stripeSubscriptionId
      );
      if (existingSubscription.status === "active" || existingSubscription.status === "trialing") {
        return NextResponse.json(
          { error: "Vous avez déjà une facturation active" },
          { status: 400 }
        );
      }
    }

    // Créer la facturation
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      expand: ["latest_invoice.payment_intent", "pending_setup_intent"],
      metadata: {
        userId: user.id,
      },
    });

    // Récupérer le clientSecret depuis PaymentIntent ou SetupIntent
    let clientSecret: string | null = null;
    
    // Vérifier d'abord le pending_setup_intent (pour les abonnements avec période d'essai ou montant faible)
    if (subscription.pending_setup_intent) {
      const setupIntentId = typeof subscription.pending_setup_intent === 'string'
        ? subscription.pending_setup_intent
        : subscription.pending_setup_intent.id;
      
      const setupIntent = typeof subscription.pending_setup_intent === 'string'
        ? await stripe.setupIntents.retrieve(setupIntentId)
        : subscription.pending_setup_intent;
      
      if (setupIntent && setupIntent.client_secret) {
        clientSecret = setupIntent.client_secret;
      }
    }
    
    // Sinon, vérifier le PaymentIntent depuis l'invoice
    if (!clientSecret && subscription.latest_invoice) {
      const invoiceId = typeof subscription.latest_invoice === 'string' 
        ? subscription.latest_invoice 
        : subscription.latest_invoice.id;
      
      const fullInvoiceResponse = await stripe.invoices.retrieve(invoiceId, {
        expand: ['payment_intent'],
      });
      
      const fullInvoice = fullInvoiceResponse as Stripe.Invoice & { payment_intent?: Stripe.PaymentIntent | string };
      
      if (fullInvoice.payment_intent) {
        const paymentIntentId = typeof fullInvoice.payment_intent === 'string'
          ? fullInvoice.payment_intent
          : fullInvoice.payment_intent.id;
        
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent && paymentIntent.client_secret) {
          clientSecret = paymentIntent.client_secret;
        }
      }
    }

    if (!clientSecret) {
      console.error("Détails de l'abonnement:", {
        subscriptionId: subscription.id,
        latest_invoice: subscription.latest_invoice,
        pending_setup_intent: subscription.pending_setup_intent,
        status: subscription.status,
      });
      return NextResponse.json(
        { error: "Impossible de créer le secret de paiement pour l'abonnement. Veuillez utiliser Stripe Checkout pour les abonnements." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      subscriptionId: subscription.id,
      clientSecret: clientSecret,
    });
  } catch (error) {
    console.error("Erreur lors de la création de l'abonnement:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-12-18.acacia",
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
    const { 
      amount, 
      currency = "eur", 
      procedureData, 
      hasFacturation, 
      promoCode, 
      procedureId,
      priceIds // { miseEnDemeure, echeancier }
    } = body;

    // Si des Price ID sont fournis, les utiliser au lieu du montant
    let finalAmount = amount;
    let lineItems: Stripe.PaymentIntentCreateParams.LineItem[] | undefined;

    if (priceIds && (priceIds.miseEnDemeure || priceIds.echeancier)) {
      lineItems = [];
      if (priceIds.miseEnDemeure) {
        lineItems.push({
          price: priceIds.miseEnDemeure,
          quantity: 1,
        });
      }
      if (priceIds.echeancier) {
        lineItems.push({
          price: priceIds.echeancier,
          quantity: 1,
        });
      }
      // Calculer le montant total à partir des Price ID
      // Note: En production, vous devriez récupérer les prix depuis Stripe
      finalAmount = 0; // Sera calculé par Stripe
    } else if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Montant invalide ou Price ID manquants" }, { status: 400 });
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

    // Créer le PaymentIntent
    const paymentIntentData: Stripe.PaymentIntentCreateParams = {
      amount: lineItems ? undefined : Math.round(finalAmount * 100), // Convertir en centimes si pas de line items
      currency,
      customer: stripeCustomerId,
      metadata: {
        userId: user.id,
        hasFacturation: hasFacturation ? "true" : "false",
        procedureData: JSON.stringify(procedureData),
        procedureId: procedureId || "",
      },
      automatic_payment_methods: {
        enabled: true,
      },
    };

    // Si on utilise des line items, les ajouter
    if (lineItems && lineItems.length > 0) {
      // Pour les PaymentIntent avec line items, on doit utiliser une approche différente
      // Stripe PaymentIntent ne supporte pas directement les line items
      // On doit créer un Checkout Session ou calculer le montant total
      // Pour l'instant, on va récupérer les prix depuis Stripe
      let totalAmount = 0;
      for (const item of lineItems) {
        try {
          const price = await stripe.prices.retrieve(item.price as string);
          totalAmount += price.unit_amount || 0;
        } catch (err) {
          console.error(`Erreur lors de la récupération du prix ${item.price}:`, err);
        }
      }
      paymentIntentData.amount = totalAmount;
    }

    // Ajouter le code promotionnel si fourni
    if (promoCode) {
      paymentIntentData.discounts = [{ coupon: promoCode }];
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error) {
    console.error("Erreur lors de la création du PaymentIntent:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


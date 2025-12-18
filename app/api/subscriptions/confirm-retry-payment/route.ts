import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { SubscriptionStatus } from "@/app/generated/prisma/enums";

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
    const { paymentIntentId, subscriptionId } = body;

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: "paymentIntentId requis" },
        { status: 400 }
      );
    }

    // Vérifier le PaymentIntent dans Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      return NextResponse.json(
        { error: "Le paiement n'a pas réussi" },
        { status: 400 }
      );
    }

    // Si un subscriptionId est fourni, mettre à jour l'abonnement
    if (subscriptionId) {
      const subscription = await prisma.subscription.findFirst({
        where: {
          id: subscriptionId,
          userId: payload.userId,
        },
      });

      if (subscription && subscription.stripeSubscriptionId) {
        // Récupérer l'abonnement depuis Stripe pour vérifier son statut
        const stripeSubscription:any = await stripe.subscriptions.retrieve(
          subscription.stripeSubscriptionId
        );

        // Synchroniser le statut de l'abonnement
        const statusMap: Record<string, SubscriptionStatus> = {
          active: SubscriptionStatus.ACTIVE,
          trialing: SubscriptionStatus.TRIALING,
          past_due: SubscriptionStatus.PAST_DUE,
          canceled: SubscriptionStatus.CANCELED,
          unpaid: SubscriptionStatus.UNPAID,
        };

        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            status: statusMap[stripeSubscription.status] || SubscriptionStatus.ACTIVE,
            currentPeriodStart: new Date(
              (stripeSubscription.current_period_start || Date.now() / 1000) * 1000
            ),
            currentPeriodEnd: new Date(
              (stripeSubscription.current_period_end || Date.now() / 1000) * 1000
            ),
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end || false,
          },
        });

        console.log(`✅ Abonnement ${subscriptionId} mis à jour après paiement réussi`);
      }
    }

    return NextResponse.json({
      success: true,
      paymentIntentId: paymentIntent.id,
      subscriptionId: subscriptionId || null,
    });
  } catch (error) {
    console.error("Erreur lors de la confirmation du paiement d'abonnement:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


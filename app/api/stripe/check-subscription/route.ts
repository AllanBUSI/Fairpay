import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { SubscriptionStatus } from "@/app/generated/prisma/enums";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-11-17.clover",
});

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 });
    }

    // Récupérer l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    // Si l'utilisateur a un stripeSubscriptionId, vérifier directement dans Stripe
    if (user.stripeSubscriptionId) {
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        
        const statusMap: Record<string, SubscriptionStatus> = {
          active: SubscriptionStatus.ACTIVE,
          canceled: SubscriptionStatus.CANCELED,
          past_due: SubscriptionStatus.PAST_DUE,
          unpaid: SubscriptionStatus.UNPAID,
          trialing: SubscriptionStatus.TRIALING,
        };

        // Synchroniser avec la base de données
        const subscription = await prisma.subscription.upsert({
          where: { stripeSubscriptionId: stripeSubscription.id },
          update: {
            status: statusMap[stripeSubscription.status] || SubscriptionStatus.TRIALING,
            currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
            currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
            updatedAt: new Date(),
          },
          create: {
            userId: user.id,
            stripeSubscriptionId: stripeSubscription.id,
            stripePriceId: stripeSubscription.items.data[0]?.price.id || "",
            status: statusMap[stripeSubscription.status] || SubscriptionStatus.TRIALING,
            currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
            currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          },
        });

        // Mettre à jour l'utilisateur si nécessaire
        if (user.stripeSubscriptionId !== stripeSubscription.id) {
          await prisma.user.update({
            where: { id: user.id },
            data: { stripeSubscriptionId: stripeSubscription.id },
          });
        }

        return NextResponse.json({ subscription, synced: true });
      } catch (error) {
        console.error("Erreur lors de la récupération de l'abonnement Stripe:", error);
        // Continuer pour vérifier dans la base de données
      }
    }
    
    // Vérifier aussi si l'utilisateur a un customerId mais pas de subscriptionId
    // Cela peut arriver si l'abonnement vient d'être créé
    if (user.stripeCustomerId && !user.stripeSubscriptionId) {
      try {
        // Récupérer les abonnements actifs du client
        const subscriptions = await stripe.subscriptions.list({
          customer: user.stripeCustomerId,
          status: "all",
          limit: 1,
        });
        
        if (subscriptions.data.length > 0) {
          const stripeSubscription = subscriptions.data[0];
          
          const statusMap: Record<string, SubscriptionStatus> = {
            active: SubscriptionStatus.ACTIVE,
            canceled: SubscriptionStatus.CANCELED,
            past_due: SubscriptionStatus.PAST_DUE,
            unpaid: SubscriptionStatus.UNPAID,
            trialing: SubscriptionStatus.TRIALING,
          };

          // Synchroniser avec la base de données
          const subscription = await prisma.subscription.upsert({
            where: { stripeSubscriptionId: stripeSubscription.id },
            update: {
              status: statusMap[stripeSubscription.status] || SubscriptionStatus.TRIALING,
              currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
              currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
              cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
              updatedAt: new Date(),
            },
            create: {
              userId: user.id,
              stripeSubscriptionId: stripeSubscription.id,
              stripePriceId: stripeSubscription.items.data[0]?.price.id || "",
              status: statusMap[stripeSubscription.status] || SubscriptionStatus.TRIALING,
              currentPeriodStart: new Date((stripeSubscription as any).current_period_start * 1000),
              currentPeriodEnd: new Date((stripeSubscription as any).current_period_end * 1000),
              cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
            },
          });

          // Mettre à jour l'utilisateur
          await prisma.user.update({
            where: { id: user.id },
            data: { stripeSubscriptionId: stripeSubscription.id },
          });

          return NextResponse.json({ subscription, synced: true });
        }
      } catch (error) {
        console.error("Erreur lors de la recherche d'abonnement par customerId:", error);
        // Continuer pour vérifier dans la base de données
      }
    }

    // Sinon, vérifier dans la base de données
    const subscription = await prisma.subscription.findUnique({
      where: { userId: user.id },
    });

    return NextResponse.json({ subscription, synced: false });
  } catch (error) {
    console.error("Erreur lors de la vérification de l'abonnement:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { SubscriptionStatus } from "@/app/generated/prisma/enums";

const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"] || "", {
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
        console.log(`🔍 Vérification de l'abonnement ${user.stripeSubscriptionId} pour l'utilisateur ${user.id}`);
        const stripeSubscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        console.log(`✅ Abonnement récupéré: ${stripeSubscription.id}, statut Stripe: ${stripeSubscription.status}`);
        
        const statusMap: Record<string, SubscriptionStatus> = {
          active: SubscriptionStatus.ACTIVE,
          canceled: SubscriptionStatus.CANCELED,
          past_due: SubscriptionStatus.PAST_DUE,
          unpaid: SubscriptionStatus.UNPAID,
          trialing: SubscriptionStatus.TRIALING,
          incomplete: SubscriptionStatus.UNPAID,
          incomplete_expired: SubscriptionStatus.CANCELED,
        };

        // Synchroniser avec la base de données
        const periodStart = (stripeSubscription as any).current_period_start;
        const periodEnd = (stripeSubscription as any).current_period_end;
        
        const currentPeriodStart = periodStart && typeof periodStart === 'number' && periodStart > 0
          ? new Date(periodStart * 1000)
          : new Date();
        const currentPeriodEnd = periodEnd && typeof periodEnd === 'number' && periodEnd > 0
          ? new Date(periodEnd * 1000)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 jours par défaut

        const subscription = await prisma.subscription.upsert({
          where: { stripeSubscriptionId: stripeSubscription.id },
          update: {
            status: statusMap[stripeSubscription.status] || SubscriptionStatus.TRIALING,
            currentPeriodStart,
            currentPeriodEnd,
            cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
            updatedAt: new Date(),
          },
          create: {
            userId: user.id,
            stripeSubscriptionId: stripeSubscription.id,
            stripePriceId: stripeSubscription.items.data[0]?.price.id || "",
            status: statusMap[stripeSubscription.status] || SubscriptionStatus.TRIALING,
            currentPeriodStart,
            currentPeriodEnd,
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

        console.log(`✅ Abonnement synchronisé: ${subscription.id}, statut DB: ${subscription.status}`);
        return NextResponse.json({ subscription, synced: true });
      } catch (error) {
        console.error(`❌ Erreur lors de la récupération de l'abonnement Stripe ${user.stripeSubscriptionId}:`, error);
        // Continuer pour vérifier dans Stripe via customerId ou dans la base de données
      }
    }
    
    // Vérifier aussi si l'utilisateur a un customerId mais pas de subscriptionId
    // Cela peut arriver si l'abonnement vient d'être créé
    // OU si l'utilisateur a un subscriptionId mais l'abonnement n'a pas été trouvé (forcer la recherche)
    if (user.stripeCustomerId) {
      try {
        // Récupérer TOUS les abonnements du client (y compris incomplete)
        const subscriptions = await stripe.subscriptions.list({
          customer: user.stripeCustomerId,
          status: "all",
          limit: 20, // Augmenter la limite pour être sûr de trouver l'abonnement
        });
        
        console.log(`🔍 Recherche d'abonnements pour le client ${user.stripeCustomerId}: ${subscriptions.data.length} trouvé(s)`);
        
        // Trier pour prioriser les abonnements actifs/trialing, puis incomplete, puis les autres
        const activeSubscriptions = subscriptions.data.filter(
          sub => sub.status === "active" || sub.status === "trialing"
        );
        const incompleteSubscriptions = subscriptions.data.filter(
          sub => sub.status === "incomplete" || sub.status === "incomplete_expired"
        );
        
        // Prioriser: actif/trialing > incomplete > autres
        const stripeSubscription = activeSubscriptions.length > 0 
          ? activeSubscriptions[0] 
          : incompleteSubscriptions.length > 0
          ? incompleteSubscriptions[0]
          : subscriptions.data[0];
        
        if (stripeSubscription) {
          console.log(`✅ Abonnement trouvé: ${stripeSubscription.id}, statut: ${stripeSubscription.status}`);
          
          const statusMap: Record<string, SubscriptionStatus> = {
            active: SubscriptionStatus.ACTIVE,
            canceled: SubscriptionStatus.CANCELED,
            past_due: SubscriptionStatus.PAST_DUE,
            unpaid: SubscriptionStatus.UNPAID,
            trialing: SubscriptionStatus.TRIALING,
            incomplete: SubscriptionStatus.UNPAID, // Incomplete = paiement non complété
            incomplete_expired: SubscriptionStatus.CANCELED,
          };

          // Synchroniser avec la base de données
          const periodStart = (stripeSubscription as any).current_period_start;
          const periodEnd = (stripeSubscription as any).current_period_end;
          
          const currentPeriodStart = periodStart && typeof periodStart === 'number' && periodStart > 0
            ? new Date(periodStart * 1000)
            : new Date();
          const currentPeriodEnd = periodEnd && typeof periodEnd === 'number' && periodEnd > 0
            ? new Date(periodEnd * 1000)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 jours par défaut

          const subscription = await prisma.subscription.upsert({
            where: { stripeSubscriptionId: stripeSubscription.id },
            update: {
              status: statusMap[stripeSubscription.status] || SubscriptionStatus.TRIALING,
              currentPeriodStart,
              currentPeriodEnd,
              cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
              updatedAt: new Date(),
            },
            create: {
              userId: user.id,
              stripeSubscriptionId: stripeSubscription.id,
              stripePriceId: stripeSubscription.items.data[0]?.price.id || "",
              status: statusMap[stripeSubscription.status] || SubscriptionStatus.TRIALING,
              currentPeriodStart,
              currentPeriodEnd,
              cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
            },
          });

          // Mettre à jour l'utilisateur avec le stripeSubscriptionId
          if (!user.stripeSubscriptionId || user.stripeSubscriptionId !== stripeSubscription.id) {
            await prisma.user.update({
              where: { id: user.id },
              data: { stripeSubscriptionId: stripeSubscription.id },
            });
            console.log(`✅ stripeSubscriptionId mis à jour pour l'utilisateur ${user.id}`);
          }

          return NextResponse.json({ subscription, synced: true });
        } else {
          console.log(`⚠️ Aucun abonnement trouvé pour le client ${user.stripeCustomerId}`);
        }
      } catch (error) {
        console.error("Erreur lors de la recherche d'abonnement par customerId:", error);
        // Continuer pour vérifier dans la base de données
      }
    }

    // Si toujours pas d'abonnement trouvé, vérifier via les factures Stripe
    // Cela peut arriver si l'utilisateur a des factures d'abonnement mais pas de subscriptionId
    if (user.stripeCustomerId) {
      try {
        // Récupérer les factures récentes
        const invoices = await stripe.invoices.list({
          customer: user.stripeCustomerId,
          limit: 5,
        });

        // Chercher une facture avec un abonnement (subscription)
        for (const invoice of invoices.data) {
          // subscription fait partie du type Invoice selon Stripe API, mais peut ne pas être typé dans notre SDK
          const subscriptionId = (invoice as any).subscription;
          if (typeof subscriptionId === 'string' && subscriptionId.length > 0) {
            try {
              const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
              
              // Vérifier que c'est un abonnement actif ou récent (inclure incomplete)
              if (stripeSubscription.status === "active" || stripeSubscription.status === "trialing" || 
                  stripeSubscription.status === "past_due" || stripeSubscription.status === "unpaid" ||
                  stripeSubscription.status === "incomplete") {
                
                const statusMap: Record<string, SubscriptionStatus> = {
                  active: SubscriptionStatus.ACTIVE,
                  canceled: SubscriptionStatus.CANCELED,
                  past_due: SubscriptionStatus.PAST_DUE,
                  unpaid: SubscriptionStatus.UNPAID,
                  trialing: SubscriptionStatus.TRIALING,
                  incomplete: SubscriptionStatus.UNPAID, // Incomplete = paiement non complété
                  incomplete_expired: SubscriptionStatus.CANCELED,
                };

                // Synchroniser avec la base de données
                const periodStart = (stripeSubscription as any).current_period_start;
                const periodEnd = (stripeSubscription as any).current_period_end;
                
                const currentPeriodStart = periodStart && typeof periodStart === 'number' && periodStart > 0
                  ? new Date(periodStart * 1000)
                  : new Date();
                const currentPeriodEnd = periodEnd && typeof periodEnd === 'number' && periodEnd > 0
                  ? new Date(periodEnd * 1000)
                  : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 jours par défaut

                const subscription = await prisma.subscription.upsert({
                  where: { stripeSubscriptionId: stripeSubscription.id },
                  update: {
                    status: statusMap[stripeSubscription.status] || SubscriptionStatus.TRIALING,
                    currentPeriodStart,
                    currentPeriodEnd,
                    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
                    updatedAt: new Date(),
                  },
                  create: {
                    userId: user.id,
                    stripeSubscriptionId: stripeSubscription.id,
                    stripePriceId: stripeSubscription.items.data[0]?.price.id || "",
                    status: statusMap[stripeSubscription.status] || SubscriptionStatus.TRIALING,
                    currentPeriodStart,
                    currentPeriodEnd,
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
            } catch (subError) {
              console.error("Erreur lors de la récupération de l'abonnement depuis la facture:", subError);
              continue;
            }
          }
        }
      } catch (error) {
        console.error("Erreur lors de la recherche d'abonnement via les factures:", error);
        // Continuer pour vérifier dans la base de données
      }
    }

    // Sinon, vérifier dans la base de données
    const subscription = await prisma.subscription.findUnique({
      where: { userId: user.id },
    });

    if (subscription) {
      console.log(`📦 Abonnement trouvé dans la DB: ${subscription.id}, statut: ${subscription.status}`);
    } else {
      console.log(`⚠️ Aucun abonnement trouvé pour l'utilisateur ${user.id} (ni dans Stripe ni dans la DB)`);
    }

    return NextResponse.json({ subscription, synced: false });
  } catch (error) {
    console.error("Erreur lors de la vérification de l'abonnement:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


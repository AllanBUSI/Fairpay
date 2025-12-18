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

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      include: { subscription: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    if (!user.stripeSubscriptionId) {
      return NextResponse.json(
        { error: "Aucune facturation active" },
        { status: 400 }
      );
    }

    // Annuler la facturation à la fin de la période
    await stripe.subscriptions.update(
      user.stripeSubscriptionId,
      {
        cancel_at_period_end: true,
      }
    );

    // Récupérer la subscription mise à jour pour obtenir les informations complètes
    const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

    // Mettre à jour la base de données
    if (user.subscription) {
      const periodEnd = (subscription as any)?.current_period_end;
      const currentPeriodEnd = periodEnd && typeof periodEnd === 'number' && periodEnd > 0
        ? new Date(periodEnd * 1000)
        : undefined; // Ne pas mettre à jour si la date n'est pas valide

      await prisma.subscription.update({
        where: { id: user.subscription.id },
        data: {
            cancelAtPeriodEnd: true,
            ...(currentPeriodEnd && { currentPeriodEnd }), // Mettre à jour seulement si la date est valide
            updatedAt: new Date(),
        },
      });
    }

    const periodEnd = (subscription as any)?.current_period_end;
    const currentPeriodEndDate = periodEnd && typeof periodEnd === 'number' && periodEnd > 0
      ? new Date(periodEnd * 1000)
      : null;

    return NextResponse.json({
      message: "Facturation annulée avec succès",
      cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
      currentPeriodEnd: currentPeriodEndDate,
    });
  } catch (error) {
    console.error("Erreur lors de l'annulation de l'abonnement:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


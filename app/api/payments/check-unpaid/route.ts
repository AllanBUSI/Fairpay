import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { PaymentStatus, SubscriptionStatus } from "@/app/generated/prisma/enums";

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

    // Vérifier les paiements en échec ou en attente
    const failedPayments = await prisma.payment.findMany({
      where: {
        userId: payload.userId,
        status: {
          in: [PaymentStatus.FAILED, PaymentStatus.PENDING],
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5, // Limiter à 5 paiements récents
    });

    // Vérifier les abonnements en impayé
    const unpaidSubscriptions = await prisma.subscription.findMany({
      where: {
        userId: payload.userId,
        status: {
          in: [SubscriptionStatus.PAST_DUE, SubscriptionStatus.UNPAID],
        },
      },
    });

    const hasUnpaidPayments = failedPayments.length > 0;
    const hasUnpaidSubscriptions = unpaidSubscriptions.length > 0;
    const hasUnpaid = hasUnpaidPayments || hasUnpaidSubscriptions;

    return NextResponse.json({
      hasUnpaid,
      failedPayments: hasUnpaidPayments ? failedPayments : [],
      unpaidSubscriptions: hasUnpaidSubscriptions ? unpaidSubscriptions : [],
    });
  } catch (error) {
    console.error("Erreur lors de la vérification des impayés:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}


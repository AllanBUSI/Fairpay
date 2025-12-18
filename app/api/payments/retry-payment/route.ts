import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { PaymentStatus, ProcedureStatus } from "@/app/generated/prisma/enums";

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
    const { paymentId } = body;

    if (!paymentId) {
      return NextResponse.json(
        { error: "paymentId requis" },
        { status: 400 }
      );
    }

    // Récupérer le paiement qui n'a pas été payé (FAILED ou PENDING)
    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        userId: payload.userId,
        status: {
          in: [PaymentStatus.FAILED, PaymentStatus.PENDING],
        },
      },
      include: {
        procedure: {
          select: {
            id: true,
            status: true,
            contexte: true,
          },
        },
      },
    });

    if (!payment) {
      return NextResponse.json(
        { error: "Paiement non trouvé ou déjà payé" },
        { status: 404 }
      );
    }

    // Récupérer l'utilisateur pour obtenir le stripeCustomerId
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user || !user.stripeCustomerId) {
      return NextResponse.json(
        { error: "Client Stripe non trouvé" },
        { status: 404 }
      );
    }

    // Créer un nouveau PaymentIntent pour retry le paiement
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(payment.amount * 100), // Convertir en centimes
      currency: payment.currency || "eur",
      customer: user.stripeCustomerId,
      description: payment.description || "Paiement en échec",
      metadata: {
        userId: user.id,
        paymentId: payment.id,
        originalPaymentIntentId: payment.stripePaymentIntentId || "",
        isRetry: "true",
        procedureId: payment.procedureId || "",
        // Ajouter le type de procédure pour la mise à jour du statut
        isInjonction: payment.procedure?.status === ProcedureStatus.INJONCTION_DE_PAIEMENT || 
                      payment.procedure?.status === ProcedureStatus.INJONCTION_DE_PAIEMENT_PAYER 
                      ? "true" : "false",
        hasEcheancier: payment.procedure?.status === ProcedureStatus.LRAR_ECHEANCIER ? "true" : "false",
      },
    });

    // Mettre à jour le paiement avec le nouveau PaymentIntent
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        stripePaymentIntentId: paymentIntent.id,
        status: PaymentStatus.PENDING,
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      paymentId: payment.id,
    });
  } catch (error) {
    console.error("Erreur lors de la création du retry de paiement:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


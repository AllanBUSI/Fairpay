import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { ProcedureStatus, PaymentStatus } from "@/app/generated/prisma/enums";

const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"] || "", {
  apiVersion: "2025-11-17.clover",
});

/**
 * Route pour vérifier et traiter les paiements des nouveaux dossiers
 * Cette route ne gère QUE les nouveaux dossiers (BROUILLONS -> NOUVEAU)
 * Les injonctions de paiement sont gérées par /api/stripe/verify-injonction-payment
 */
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
    const { sessionId, procedureId } = body;

    if (!sessionId || !procedureId) {
      return NextResponse.json(
        { error: "sessionId et procedureId requis" },
        { status: 400 }
      );
    }

    // Vérifier la session Stripe
    const session:any = await stripe.checkout.sessions.retrieve(sessionId);
    const sessionMetadata = session.metadata as Record<string, string> | undefined;

    // Si c'est une injonction, rediriger vers la route dédiée
    if (sessionMetadata?.["isInjonction"] === "true") {
      return NextResponse.json({
        error: "Les injonctions de paiement doivent utiliser la route /api/stripe/verify-injonction-payment",
        isInjonction: true,
      }, { status: 400 });
    }

    // Vérifier le statut du paiement
    if (session.payment_status === PaymentStatus.OPEN) {
      return NextResponse.json({
        paid: false,
        paymentStatus: session.payment_status,
        error: "Le paiement est en attente et n'a pas été complété. Veuillez compléter le paiement.",
      }, { status: 400 });
    }

    if (session.payment_status !== "paid") {
      return NextResponse.json({
        paid: false,
        paymentStatus: session.payment_status,
        error: `Le paiement n'a pas été complété. Statut: ${session.payment_status}`,
      }, { status: 400 });
    }

    // Récupérer la procédure pour vérifier son statut
    const procedure = await prisma.procedure.findUnique({
      where: { id: procedureId },
    });

    if (!procedure) {
      return NextResponse.json(
        { error: "Procédure non trouvée" },
        { status: 404 }
      );
    }

    // Vérifier que ce n'est pas une injonction
    if (procedure.status === ProcedureStatus.INJONCTION_DE_PAIEMENT || 
        procedure.status === ProcedureStatus.INJONCTION_DE_PAIEMENT_PAYER) {
      return NextResponse.json({
        error: "Les injonctions de paiement doivent utiliser la route /api/stripe/verify-injonction-payment",
        isInjonction: true,
      }, { status: 400 });
    }

    // Vérifier si le paiement existe déjà en base
    let payment = await prisma.payment.findFirst({
      where: {
        procedureId: procedureId,
        stripePaymentIntentId: session.payment_intent as string,
      },
    });

    // Si le paiement n'existe pas, le créer
    if (!payment && session.payment_intent) {
      console.log(`💰 Création du paiement pour la procédure ${procedureId}`);
      
      let chargeId: string | null = null;
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(session.payment_intent as string);
        chargeId = paymentIntent.latest_charge as string | null;
      } catch (err) {
        console.error("Erreur lors de la récupération du PaymentIntent:", err);
      }

      payment = await prisma.payment.create({
        data: {
          userId: payload.userId,
          procedureId: procedureId,
          stripePaymentIntentId: session.payment_intent as string,
          stripeChargeId: chargeId,
          amount: (session.amount_total || 0) / 100,
          currency: session.currency || "eur",
          status: PaymentStatus.SUCCEEDED,
          description: `Paiement de dossier - ${procedure.contexte || "Procédure"}`,
          metadata: {
            sessionId: session.id,
            ...session.metadata,
          } as any,
        },
      });

      console.log(`✅ Paiement créé: ${payment.id}`);
    }

    // Cette route ne gère que les nouveaux dossiers (BROUILLONS -> NOUVEAU)
    // Mettre à jour le statut si la procédure est en BROUILLONS
    if (procedure.status === ProcedureStatus.BROUILLONS && payment) {
      await prisma.procedure.update({
        where: { id: procedureId },
        data: {
          status: ProcedureStatus.NOUVEAU,
          paymentId: payment.id,
          paymentStatus: PaymentStatus.SUCCEEDED,
          updatedAt: new Date(),
        },
      });

      console.log(`✅ Statut de la procédure ${procedureId} mis à jour à NOUVEAU`);
    }

    // Récupérer la procédure mise à jour pour retourner le statut actuel
    const updatedProcedure = await prisma.procedure.findUnique({
      where: { id: procedureId },
      select: { status: true, paymentId: true, paymentStatus: true },
    });

    return NextResponse.json({
      paid: true,
      paymentStatus: session.payment_status,
      procedureStatus: updatedProcedure?.status || procedure.status,
      procedureId: procedureId,
      success: true,
    });
  } catch (error) {
    console.error("Erreur lors de la vérification du paiement:", error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Erreur serveur",
        paid: false,
      },
      { status: 500 }
    );
  }
}

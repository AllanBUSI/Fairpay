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
    const { paymentIntentId, procedureId } = body;

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: "paymentIntentId requis" },
        { status: 400 }
      );
    }

    // Vérifier le PaymentIntent dans Stripe - NE PAS CHANGER LE STATUT AVANT CETTE VÉRIFICATION
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Vérification stricte : le paiement DOIT être réussi pour changer le statut
    if (paymentIntent.status !== "succeeded") {
      console.error(`❌ Le paiement ${paymentIntentId} n'a pas réussi. Statut: ${paymentIntent.status}`);
      return NextResponse.json(
        { error: `Le paiement n'a pas réussi. Statut: ${paymentIntent.status}` },
        { status: 400 }
      );
    }

    console.log(`✅ Paiement ${paymentIntentId} confirmé avec succès dans Stripe`);

    // Mettre à jour le paiement dans la base de données
    const paymentUpdateResult = await prisma.payment.updateMany({
      where: {
        stripePaymentIntentId: paymentIntentId,
        userId: payload.userId,
      },
      data: {
        status: PaymentStatus.SUCCEEDED,
      },
    });

    if (paymentUpdateResult.count === 0) {
      console.error(`❌ Aucun paiement trouvé pour PaymentIntent ${paymentIntentId} et utilisateur ${payload.userId}`);
      return NextResponse.json(
        { error: "Paiement non trouvé dans la base de données" },
        { status: 404 }
      );
    }

    console.log(`✅ ${paymentUpdateResult.count} paiement(s) mis à jour avec le statut SUCCEEDED`);

    // Si une procédure est fournie, la mettre à jour UNIQUEMENT si le paiement est confirmé
    if (procedureId) {
      console.log(`📋 Recherche de la procédure ${procedureId} pour le PaymentIntent ${paymentIntentId}`);
      
      const procedure = await prisma.procedure.findUnique({
        where: { id: procedureId },
        include: { payment: true },
      });

      if (!procedure) {
        console.error(`❌ Procédure ${procedureId} non trouvée`);
        return NextResponse.json(
          { error: "Procédure non trouvée" },
          { status: 404 }
        );
      }

      console.log(`✅ Procédure trouvée avec statut: ${procedure.status}`);
      
      // Trouver le paiement associé par PaymentIntent ID
      // Le modèle Procedure a une relation 1-1 avec Payment (champ payment, pas payments)
      // Chercher directement dans la table Payment
      let procedurePayment = await prisma.payment.findFirst({
        where: {
          procedureId: procedureId,
          stripePaymentIntentId: paymentIntentId,
        },
      });

      if (!procedurePayment) {
        console.log(`🔍 Paiement non trouvé pour cette procédure, recherche par PaymentIntent uniquement...`);
        // Si pas trouvé avec procedureId, chercher juste par PaymentIntent (au cas où le procedureId n'est pas encore lié)
        procedurePayment = await prisma.payment.findFirst({
          where: {
            stripePaymentIntentId: paymentIntentId,
            userId: payload.userId,
          },
        });
      }

      // NE CHANGER LE STATUT QUE SI LE PAIEMENT EST TROUVÉ ET RÉUSSI
      if (procedurePayment && procedurePayment.status === PaymentStatus.SUCCEEDED) {
        console.log(`✅ Paiement trouvé et confirmé: ${procedurePayment.id}`);
        
        // Vérifier que la procédure est bien en BROUILLONS avant de la mettre à jour
        if (procedure.status !== ProcedureStatus.BROUILLONS) {
          console.warn(`⚠️ La procédure ${procedureId} n'est pas en BROUILLONS (statut actuel: ${procedure.status}). Pas de changement de statut.`);
        } else {
          // Mettre à jour la procédure UNIQUEMENT si elle est en BROUILLONS et que le paiement est confirmé
          await prisma.procedure.update({
            where: { id: procedureId },
            data: {
              status: ProcedureStatus.NOUVEAU,
              paymentId: procedurePayment.id,
              paymentStatus: PaymentStatus.SUCCEEDED,
              updatedAt: new Date(),
            },
          });
          console.log(`✅ Procédure ${procedureId} mise à jour avec le statut NOUVEAU après confirmation du paiement`);
        }
      } else {
        console.error(`❌ Aucun paiement réussi trouvé pour PaymentIntent ${paymentIntentId} et procédure ${procedureId}`);
        return NextResponse.json(
          { error: "Paiement non trouvé ou non confirmé pour cette procédure" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      paymentIntentId,
      procedureId: procedureId || null,
    });
  } catch (error) {
    console.error("Erreur lors de la confirmation du paiement:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


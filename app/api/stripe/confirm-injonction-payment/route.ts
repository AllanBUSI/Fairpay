import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { PaymentStatus, ProcedureStatus } from "@/app/generated/prisma/enums";

const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"] || "", {
  apiVersion: "2025-11-17.clover",
});

// Fonction pour créer une facture Stripe pour un paiement unique
async function createInvoiceForPayment(
  stripe: Stripe,
  paymentIntent: Stripe.PaymentIntent,
  payment: any,
  user: any
): Promise<void> {
  try {
    // Vérifier si une facture existe déjà pour ce PaymentIntent
    const existingInvoices = await stripe.invoices.list({
      customer: user.stripeCustomerId,
      limit: 100,
    });

    const invoiceExists = existingInvoices.data.some(
      (inv) => {
        const invMetadata = inv.metadata as Record<string, string> | undefined;
        return invMetadata?.["paymentIntentId"] === paymentIntent.id || 
               invMetadata?.["paymentId"] === payment.id;
      }
    );

    if (invoiceExists) {
      console.log(`📄 Facture déjà existante pour le paiement ${payment.id}`);
      return;
    }

    // Créer la facture
    const invoice = await stripe.invoices.create({
      customer: user.stripeCustomerId,
      collection_method: "charge_automatically",
      auto_advance: false,
      description: payment.description || "Facture de paiement",
      metadata: {
        paymentId: payment.id,
        paymentIntentId: paymentIntent.id,
        procedureId: payment.procedureId || "",
      },
    });

    // Ajouter la ligne de facture
    await stripe.invoiceItems.create({
      customer: user.stripeCustomerId,
      invoice: invoice.id,
      amount: Math.round(payment.amount * 100),
      currency: payment.currency || "eur",
      description: payment.description || "Paiement",
    });

    // Finaliser et payer la facture
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
    await stripe.invoices.pay(finalizedInvoice.id, {
      paid_out_of_band: true,
    });

    console.log(`✅ Facture créée pour le paiement ${payment.id}: ${invoice.id}`);
  } catch (error) {
    console.error(`❌ Erreur lors de la création de la facture pour le paiement ${payment.id}:`, error);
    // Ne pas bloquer le processus si la création de facture échoue
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("🔔 confirm-injonction-payment appelé");
    
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      console.error("❌ Token manquant");
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      console.error("❌ Token invalide");
      return NextResponse.json({ error: "Token invalide" }, { status: 401 });
    }

    const body = await request.json();
    const { paymentIntentId, procedureId } = body;

    console.log(`📋 Paramètres reçus: paymentIntentId=${paymentIntentId}, procedureId=${procedureId}`);

    if (!paymentIntentId || !procedureId) {
      console.error("❌ Paramètres manquants");
      return NextResponse.json(
        { error: "paymentIntentId et procedureId requis" },
        { status: 400 }
      );
    }

    // Récupérer le PaymentIntent depuis Stripe
    console.log(`🔍 Récupération du PaymentIntent: ${paymentIntentId}`);
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    console.log(`📋 PaymentIntent récupéré - status: ${paymentIntent.status}`);

    if (paymentIntent.status !== "succeeded") {
      console.warn(`⚠️ PaymentIntent ${paymentIntentId} n'a pas réussi (status: ${paymentIntent.status})`);
      return NextResponse.json(
        { error: "Le paiement n'a pas réussi" },
        { status: 400 }
      );
    }

    // Récupérer l'utilisateur pour créer la facture
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    // Mettre à jour le Payment dans la base de données
    const payment = await prisma.payment.findFirst({
      where: {
        stripePaymentIntentId: paymentIntentId,
      },
    });

    if (payment) {
      console.log(`💳 Mise à jour du Payment ${payment.id} à SUCCEEDED`);
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCEEDED,
        },
      });

      // Créer une facture Stripe pour ce paiement d'injonction
      if (user && user.stripeCustomerId) {
        await createInvoiceForPayment(stripe, paymentIntent, payment, user);
      }
    } else {
      console.warn(`⚠️ Payment non trouvé pour paymentIntentId: ${paymentIntentId}`);
    }

    // Mettre à jour le statut de la procédure
    console.log(`📝 Mise à jour de la procédure ${procedureId} à INJONCTION_DE_PAIEMENT_PAYER`);
    await prisma.procedure.update({
      where: { id: procedureId },
      data: {
        status: ProcedureStatus.INJONCTION_DE_PAIEMENT_PAYER,
      },
    });

    console.log(`✅ Procédure ${procedureId} mise à jour avec succès à INJONCTION_DE_PAIEMENT_PAYER`);

    return NextResponse.json({
      success: true,
      paymentIntentId: paymentIntent.id,
      procedureId: procedureId,
    });
  } catch (error) {
    console.error("❌ Erreur lors de la confirmation du paiement d'injonction:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


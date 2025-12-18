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
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 });
    }

    const body = await request.json() as Record<string, unknown>;
    let paymentIntentId = typeof body["paymentIntentId"] === "string" ? body["paymentIntentId"] : undefined;
    let procedureId = typeof body["procedureId"] === "string" ? body["procedureId"] : undefined;

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: "paymentIntentId requis" },
        { status: 400 }
      );
    }

    // Récupérer le PaymentIntent depuis Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
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
      include: {
        procedure: {
          select: {
            id: true,
            status: true,
            hasEcheancier: true,
            echeancier: true,
          },
        },
      },
    });

    if (payment) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.SUCCEEDED,
        },
      });
      
      // Si c'est un retry (isRetry dans les métadonnées), récupérer le procedureId depuis le paiement
      const metadata = paymentIntent.metadata as Record<string, string> | undefined;
      if (metadata?.["isRetry"] === "true" && payment.procedureId && !procedureId) {
        procedureId = payment.procedureId;
        console.log(`🔄 Retry de paiement détecté, procedureId récupéré: ${procedureId}`);
      }

      // Créer une facture Stripe pour ce paiement unique (si ce n'est pas un abonnement)
      if (user && user.stripeCustomerId && metadata?.["hasSubscription"] !== "true") {
        await createInvoiceForPayment(stripe, paymentIntent, payment, user);
      }
    }

    // Si une procédure est associée, mettre à jour son statut selon son type
    if (procedureId) {
      // Vérifier si c'est une injonction via les métadonnées du PaymentIntent
      const metadata = paymentIntent.metadata as Record<string, string> | undefined;
      const isInjonction = metadata?.["isInjonction"] === "true";
      
      // Récupérer la procédure avec toutes ses informations
      const procedure = await prisma.procedure.findUnique({
        where: { id: procedureId },
      });
      
      if (procedure) {
        const isInjonctionProcedure = procedure.status === ProcedureStatus.INJONCTION_DE_PAIEMENT || 
                                      procedure.status === ProcedureStatus.INJONCTION_DE_PAIEMENT_PAYER;
        
        if (isInjonction || isInjonctionProcedure) {
          console.warn(`⚠️ Tentative de mettre à jour une injonction (${procedureId}) via confirm-payment-simple. Ignoré.`);
          return NextResponse.json({
            error: "Cette route ne doit pas être utilisée pour les injonctions. Utilisez /api/stripe/confirm-injonction-payment",
            isInjonction: true,
          }, { status: 400 });
        }
        
        // Déterminer le nouveau statut selon le type de procédure
        let newStatus:any = ProcedureStatus.NOUVEAU;
        
        // Si la procédure a un écheancier, mettre le statut à LRAR_ECHEANCIER
        if (procedure.hasEcheancier && procedure.echeancier) {
          newStatus = ProcedureStatus.LRAR_ECHEANCIER;
          console.log(`📋 Procédure avec écheancier détectée, statut mis à LRAR_ECHEANCIER`);
        }
        // Si c'est une mise en demeure (statut BROUILLONS), passer à NOUVEAU
        else if (procedure.status === ProcedureStatus.BROUILLONS) {
          newStatus = ProcedureStatus.NOUVEAU;
          console.log(`📋 Mise en demeure payée, statut mis à NOUVEAU`);
        }
        // Sinon, garder le statut actuel ou mettre à NOUVEAU
        else {
          newStatus = ProcedureStatus.NOUVEAU;
        }
        
        // Mettre à jour la procédure avec le nouveau statut
        await prisma.procedure.update({
          where: { id: procedureId },
          data: {
            status: newStatus,
            paymentId: payment?.id || null,
            paymentStatus: PaymentStatus.SUCCEEDED,
            updatedAt: new Date(),
          },
        });
        
        console.log(`✅ Procédure ${procedureId} mise à jour avec le statut ${newStatus} après paiement réussi`);
      }
    }

    return NextResponse.json({
      success: true,
      paymentIntentId: paymentIntent.id,
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


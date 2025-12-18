import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { PaymentStatus } from "@/app/generated/prisma/enums";

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

    // Récupérer l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    if (!user.stripeCustomerId) {
      return NextResponse.json({ message: "Aucun client Stripe trouvé", created: 0 });
    }

    // Récupérer tous les paiements réussis de l'utilisateur
    const payments = await prisma.payment.findMany({
      where: {
        userId: user.id,
        status: PaymentStatus.SUCCEEDED,
        stripePaymentIntentId: {
            not: undefined,
        },
      },
      include: {
        procedure: true,
      },
    });

    // Récupérer toutes les factures existantes
    const existingInvoices = await stripe.invoices.list({
      customer: user.stripeCustomerId,
      limit: 100,
    });

    console.log(`📋 Factures existantes: ${existingInvoices.data.length}`);

    const existingPaymentIds = new Set(
      existingInvoices.data
        .map((inv) => {
          const invMetadata = inv.metadata as Record<string, string> | undefined;
          return invMetadata?.["paymentId"];
        })
        .filter((id): id is string => !!id)
    );

    console.log(`📋 Paiements avec factures existantes: ${existingPaymentIds.size}`);
    console.log(`📋 Paiements à traiter: ${payments.length}`);

    let createdCount = 0;

    // Créer des factures pour les paiements qui n'en ont pas
    for (const payment of payments) {
      if (existingPaymentIds.has(payment.id)) {
        continue; // Facture déjà créée
      }

      if (!payment.stripePaymentIntentId) {
        continue; // Pas de PaymentIntent
      }

      try {
        // Récupérer la session de checkout si elle existe
        let session: Stripe.Checkout.Session | null = null;
        try {
          // Chercher la session via les métadonnées du PaymentIntent
          const paymentMetadata = payment.metadata as Record<string, string> | undefined;
          if (paymentMetadata && typeof paymentMetadata === 'object' && 'sessionId' in paymentMetadata) {
            session = await stripe.checkout.sessions.retrieve(paymentMetadata["sessionId"]);
          }
        } catch (e) {
          // Pas de session trouvée, continuer sans
        }

        // Créer la facture
        const invoice = await stripe.invoices.create({
          customer: user.stripeCustomerId,
          collection_method: "charge_automatically",
          auto_advance: false,
          description: payment.description || `Facture pour ${payment.procedure?.contexte || "Procédure"}`,
          metadata: {
            paymentId: payment.id,
            procedureId: payment.procedureId || "",
            paymentIntentId: payment.stripePaymentIntentId,
          },
        });

        // Ajouter les lignes de facture
        if (session) {
          try {
            const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
              expand: ["data.price.product"],
            });

            for (const item of lineItems.data) {
              await stripe.invoiceItems.create({
                customer: user.stripeCustomerId,
                invoice: invoice.id,
                amount: item.amount_total || 0,
                currency: item.currency || "eur",
                description: item.description || "Article",
              });
            }
          } catch (e) {
            // Si on ne peut pas récupérer les line_items, créer une ligne simple
            await stripe.invoiceItems.create({
              customer: user.stripeCustomerId,
              invoice: invoice.id,
              amount: Math.round(payment.amount * 100), // Convertir en centimes
              currency: payment.currency || "eur",
              description: payment.description || `Paiement de dossier`,
            });
          }
        } else {
          // Pas de session, créer une ligne simple
          await stripe.invoiceItems.create({
            customer: user.stripeCustomerId,
            invoice: invoice.id,
            amount: Math.round(payment.amount * 100), // Convertir en centimes
            currency: payment.currency || "eur",
            description: payment.description || `Paiement de dossier`,
          });
        }

        // Finaliser et payer la facture
        const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
        await stripe.invoices.pay(finalizedInvoice.id);

        createdCount++;
        console.log(`✅ Facture créée pour le paiement ${payment.id}: ${finalizedInvoice.id}`);
      } catch (error) {
        console.error(`Erreur lors de la création de la facture pour le paiement ${payment.id}:`, error);
        // Continuer avec les autres paiements
      }
    }

    return NextResponse.json({
      message: `${createdCount} facture(s) créée(s)`,
      created: createdCount,
    });
  } catch (error) {
    console.error("Erreur lors de la création des factures manquantes:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


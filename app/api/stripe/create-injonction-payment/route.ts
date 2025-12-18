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

    const body = await request.json();
    const { procedureId, kbisFilePath, attestationFilePath } = body;

    if (!procedureId) {
      return NextResponse.json(
        { error: "procedureId requis" },
        { status: 400 }
      );
    }

    // Récupérer l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    // Vérifier que la procédure existe et appartient à l'utilisateur
    const procedure = await prisma.procedure.findUnique({
      where: { id: procedureId },
    });

    if (!procedure || procedure.userId !== user.id) {
      return NextResponse.json(
        { error: "Procédure non trouvée" },
        { status: 404 }
      );
    }

    // Récupérer ou créer le client Stripe
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user.id,
        },
      });
      stripeCustomerId = customer.id;

      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId },
      });
    }

    // Récupérer le prix de l'injonction
    const priceId = process.env["STRIPE_PRICE_ID_INJONCTION"];
    if (!priceId) {
      return NextResponse.json(
        { error: "Price ID d'injonction non configuré" },
        { status: 500 }
      );
    }

    // Récupérer le prix depuis Stripe
    let prixHT = 79; // Prix par défaut
    try {
      const price = await stripe.prices.retrieve(priceId);
      prixHT = (price.unit_amount || 7900) / 100;
    } catch (err) {
      console.error("Erreur lors de la récupération du prix:", err);
    }

    // Calculer le prix TTC
    const prixTTC = prixHT * 1.20;

    // Créer le PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(prixTTC * 100), // En centimes
      currency: "eur",
      customer: stripeCustomerId,
      description: "Injonction de paiement",
      metadata: {
        userId: user.id,
        procedureId: procedureId,
        isInjonction: "true",
        kbisFilePath: kbisFilePath || "",
        attestationFilePath: attestationFilePath || "",
      },
    });

    // Créer ou mettre à jour l'entrée Payment dans la base de données
    // Utiliser upsert car procedureId est unique
    await prisma.payment.upsert({
      where: { procedureId: procedureId },
      update: {
        stripePaymentIntentId: paymentIntent.id,
        amount: prixTTC,
        currency: "eur",
        status: PaymentStatus.PENDING,
        description: "Injonction de paiement",
        metadata: {
          paymentIntentId: paymentIntent.id,
          isInjonction: true,
          kbisFilePath: kbisFilePath || "",
          attestationFilePath: attestationFilePath || "",
        } as any,
      },
      create: {
        userId: user.id,
        procedureId: procedureId,
        stripePaymentIntentId: paymentIntent.id,
        amount: prixTTC,
        currency: "eur",
        status: PaymentStatus.PENDING,
        description: "Injonction de paiement",
        metadata: {
          paymentIntentId: paymentIntent.id,
          isInjonction: true,
          kbisFilePath: kbisFilePath || "",
          attestationFilePath: attestationFilePath || "",
        } as any,
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      procedureId: procedureId,
    });
  } catch (error) {
    console.error("Erreur lors de la création du paiement d'injonction:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


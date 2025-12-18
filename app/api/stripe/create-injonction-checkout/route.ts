import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";

const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"] || "", {
  apiVersion: "2025-11-17.clover",
});

/**
 * Route API pour créer une session Stripe Checkout pour une injonction de paiement
 * 
 * Cette route :
 * 1. Vérifie que l'utilisateur est authentifié
 * 2. Vérifie que la procédure existe et appartient à l'utilisateur
 * 3. Vérifie que la procédure est en statut INJONCTION_DE_PAIEMENT
 * 4. Crée ou récupère le client Stripe
 * 5. Récupère le prix de l'injonction depuis Stripe
 * 6. Crée une session de checkout avec les métadonnées nécessaires
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
    const { procedureId, priceId, kbisFilePath, attestationFilePath, successUrl, cancelUrl } = body;

    // Validation des paramètres requis
    if (!procedureId || !priceId) {
      return NextResponse.json(
        { error: "procedureId et priceId sont requis" },
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
      select: { 
        id: true,
        userId: true,
        status: true,
      },
    });

    if (!procedure) {
      return NextResponse.json({ error: "Procédure non trouvée" }, { status: 404 });
    }

    if (procedure.userId !== user.id) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission d'accéder à cette procédure" },
        { status: 403 }
      );
    }

    // Vérifier que la procédure est en statut INJONCTION_DE_PAIEMENT
    if (procedure.status !== "INJONCTION_DE_PAIEMENT") {
      return NextResponse.json(
        { error: "Cette procédure n'est pas éligible pour une injonction de paiement" },
        { status: 400 }
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

    // Récupérer le prix HT depuis Stripe pour calculer le TTC
    let prixHT = 79; // Prix par défaut si on ne peut pas récupérer depuis Stripe
    try {
      const price = await stripe.prices.retrieve(priceId);
      // Le prix dans Stripe est en centimes, donc on divise par 100
      prixHT = (price.unit_amount || 7900) / 100;
    } catch (err) {
      console.error("Erreur lors de la récupération du prix depuis Stripe:", err);
      // Utiliser le prix par défaut
    }

    // Calculer le prix TTC (HT * 1.20)
    const prixTTC = prixHT * 1.20;

    // Créer une session de checkout pour l'injonction de payer avec prix TTC
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: "Injonction de paiement",
              description: "Fairpay, automatise toute l'injonction de paiement avec un Avocat qualifié",
            },
            unit_amount: Math.round(prixTTC * 100), // Convertir en centimes
          },
          quantity: 1,
        },
      ],
      invoice_creation: {
        enabled: true, // Activer la création automatique d'invoice par Checkout
      },
      metadata: {
        userId: user.id,
        procedureId: procedureId,
        isInjonction: "true",
        kbisFilePath: kbisFilePath || "",
        attestationFilePath: attestationFilePath || "",
      },
      success_url: successUrl || `${process.env["NEXT_PUBLIC_APP_URL"] || "http://localhost:3000"}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env["NEXT_PUBLIC_APP_URL"] || "http://localhost:3000"}/dashboard?payment=cancelled`,
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
      procedureId: procedureId,
    });
  } catch (error) {
    console.error("Erreur lors de la création de la session de checkout pour l'injonction:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


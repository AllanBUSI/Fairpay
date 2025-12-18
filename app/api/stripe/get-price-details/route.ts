import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
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

    const body = await request.json();
    const { priceId } = body;

    if (!priceId) {
      return NextResponse.json({ error: "Price ID requis" }, { status: 400 });
    }

    // Récupérer le prix depuis Stripe
    const price = await stripe.prices.retrieve(priceId);
    
    // Le prix dans Stripe est en centimes, donc on divise par 100 pour obtenir le prix en euros
    const prixHT = (price.unit_amount || 0) / 100;

    return NextResponse.json({ prixHT });
  } catch (error) {
    console.error("Erreur lors de la récupération du prix:", error);
    return NextResponse.json(
      { error: "Erreur serveur", prixHT: null },
      { status: 500 }
    );
  }
}


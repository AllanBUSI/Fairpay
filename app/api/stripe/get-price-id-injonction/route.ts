import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";

/**
 * Route API pour récupérer le priceId de l'injonction de paiement
 * Le priceId est stocké dans les variables d'environnement
 */
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

    // Récupérer le priceId depuis les variables d'environnement
    const priceId = process.env["STRIPE_PRICE_ID_INJONCTION"];

    if (!priceId) {
      return NextResponse.json(
        { error: "Prix de l'injonction non configuré" },
        { status: 500 }
      );
    }

    return NextResponse.json({ priceId });
  } catch (error) {
    console.error("Erreur lors de la récupération du prix de l'injonction:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}


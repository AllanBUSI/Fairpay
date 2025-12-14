import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Récupérer le priceId de l'abonnement depuis les variables d'environnement
    const priceId = process.env.STRIPE_PRICE_ID_ABONNEMENT;

    if (!priceId) {
      console.error("STRIPE_PRICE_ID_ABONNEMENT n'est pas défini dans les variables d'environnement");
      return NextResponse.json(
        { 
          error: "Price ID non configuré. Veuillez définir STRIPE_PRICE_ID_ABONNEMENT dans votre fichier .env" 
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ priceId });
  } catch (error) {
    console.error("Erreur lors de la récupération du Price ID:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}


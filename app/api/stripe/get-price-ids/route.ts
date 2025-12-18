import { NextResponse } from "next/server";

export async function GET() {
  try {
    // Récupérer tous les Price ID depuis les variables d'environnement
    const priceIds = {
      abonnement: process.env["STRIPE_PRICE_ID_ABONNEMENT"] || null,
      miseEnDemeureSansAbo: process.env["STRIPE_PRICE_ID_MISE_EN_DEMEURE_SANS_ABO"] || null,
      miseEnDemeureAvecAbo: process.env["STRIPE_PRICE_ID_MISE_EN_DEMEURE_AVEC_ABO"] || null,
      echeancier: process.env["STRIPE_PRICE_ID_ECHEANCIER"] || null,
    };

    // Vérifier que tous les Price ID sont configurés
    const missing = Object.entries(priceIds)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missing.length > 0) {
      console.error(`Price ID manquants: ${missing.join(", ")}`);
      return NextResponse.json(
        {
          error: `Price ID non configurés: ${missing.join(", ")}. Veuillez définir les variables d'environnement STRIPE_PRICE_ID_*`,
          priceIds: null,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ priceIds });
  } catch (error) {
    console.error("Erreur lors de la récupération des Price ID:", error);
    return NextResponse.json(
      { error: "Erreur serveur", priceIds: null },
      { status: 500 }
    );
  }
}


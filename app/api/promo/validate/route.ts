import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-11-17.clover",
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, amount } = body;

    if (!code) {
      return NextResponse.json(
        { error: "Code promotionnel requis" },
        { status: 400 }
      );
    }

    // Récupérer le coupon depuis Stripe
    try {
      const coupon = await stripe.coupons.retrieve(code.toUpperCase());

      if (!coupon.valid) {
        return NextResponse.json(
          { error: "Code promotionnel invalide ou expiré" },
          { status: 400 }
        );
      }

      // Calculer la réduction
      let discount = 0;
      if (coupon.percent_off) {
        // Réduction en pourcentage
        discount = (amount * coupon.percent_off) / 100;
      } else if (coupon.amount_off) {
        // Réduction en montant fixe (convertir de centimes en euros)
        discount = coupon.amount_off / 100;
      }

      return NextResponse.json({
        valid: true,
        discount,
        coupon: {
          id: coupon.id,
          name: coupon.name,
          percent_off: coupon.percent_off,
          amount_off: coupon.amount_off,
        },
      });
    } catch (error: any) {
      if (error.type === "StripeInvalidRequestError") {
        return NextResponse.json(
          { error: "Code promotionnel invalide" },
          { status: 400 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error("Erreur lors de la validation du code promotionnel:", error);
    return NextResponse.json(
      { error: "Erreur serveur" },
      { status: 500 }
    );
  }
}


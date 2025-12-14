import { NextResponse } from "next/server";

export async function POST() {
  // Avec JWT, la déconnexion se fait côté client en supprimant le token
  // Le token expirera naturellement après sa date d'expiration
  return NextResponse.json({ message: "Déconnexion réussie" }, { status: 200 });
}


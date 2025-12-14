import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { nom, prenom, email, adresse, codePostal, ville, telephone, iban } = body;

    // Validation
    if (!nom || !prenom || !email || !adresse || !codePostal || !ville || !telephone) {
      return NextResponse.json(
        { error: "Tous les champs sont obligatoires" },
        { status: 400 }
      );
    }

    // Vérifier que l'email n'est pas déjà utilisé par un autre utilisateur
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser && existingUser.id !== user.userId) {
      return NextResponse.json(
        { error: "Cet email est déjà utilisé par un autre utilisateur" },
        { status: 400 }
      );
    }

    // Mettre à jour le profil
    const updatedUser = await prisma.user.update({
      where: { id: user.userId },
      data: {
        nom,
        prenom,
        email,
        adresse,
        codePostal,
        ville,
        telephone,
        iban: iban || null,
      },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        adresse: true,
        codePostal: true,
        ville: true,
        telephone: true,
        iban: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user: updatedUser }, { status: 200 });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du profil:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du profil" },
      { status: 500 }
    );
  }
}


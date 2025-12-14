import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateCode } from "@/lib/auth";
import { sendVerificationCode } from "@/lib/email";
import { UserRole } from "@/app/generated/prisma/enums";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email requis" },
        { status: 400 }
      );
    }

    // Valider le format de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Format d'email invalide" },
        { status: 400 }
      );
    }

    // Générer un code à 6 chiffres
    const code = generateCode();

    // Vérifier si l'utilisateur existe
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      // Mettre à jour le code si l'utilisateur existe
      await prisma.user.update({
        where: { email: email.toLowerCase() },
        data: { code },
      });
    } else {
      // Créer l'utilisateur si c'est la première fois avec le rôle USER par défaut
      await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          code,
          role: UserRole.USER, // Rôle par défaut pour les nouveaux utilisateurs
        },
      });
    }

    // Envoyer l'email avec le code
    await sendVerificationCode(email.toLowerCase(), code);

    return NextResponse.json(
      { message: "Code envoyé avec succès" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erreur lors de l'envoi du code:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'envoi du code" },
      { status: 500 }
    );
  }
}


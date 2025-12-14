import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateToken } from "@/lib/jwt";

export async function POST(request: NextRequest) {
  try {
    const { email, code } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email requis" },
        { status: 400 }
      );
    }

    if (!code || typeof code !== "string" || code.length !== 6) {
      return NextResponse.json(
        { error: "Code invalide" },
        { status: 400 }
      );
    }

    // Vérifier si l'utilisateur existe et si le code correspond
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé" },
        { status: 404 }
      );
    }

    if (user.code !== code) {
      return NextResponse.json(
        { error: "Code invalide" },
        { status: 401 }
      );
    }

    // Générer un token JWT
    const token = generateToken({
      userId: user.id,
      email: user.email,
    });

    return NextResponse.json(
      { 
        message: "Code vérifié avec succès",
        token,
        user: {
          id: user.id,
          email: user.email,
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erreur lors de la vérification du code:", error);
    return NextResponse.json(
      { error: "Erreur lors de la vérification du code" },
      { status: 500 }
    );
  }
}


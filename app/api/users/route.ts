import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { canAddUser } from "@/lib/permissions";
import { UserRole } from "@/app/generated/prisma/enums";
import { generateCode } from "@/lib/auth";
import { sendVerificationCode } from "@/lib/email";

/**
 * GET /api/users - Liste tous les utilisateurs (seulement pour les avocats)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Vérifier les permissions
    if (!canAddUser(user.role)) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de voir les utilisateurs" },
        { status: 403 }
      );
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ users }, { status: 200 });
  } catch (error) {
    console.error("Erreur lors de la récupération des utilisateurs:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des utilisateurs" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/users - Créer un nouvel utilisateur (seulement pour les avocats)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Vérifier les permissions
    if (!canAddUser(user.role)) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission d'ajouter des utilisateurs" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, role } = body;

    // Validation
    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Email requis" },
        { status: 400 }
      );
    }

    // Valider le rôle
    const validRoles: UserRole[] = [UserRole.USER, UserRole.JURISTE, UserRole.AVOCAT];
    const userRole = validRoles.includes(role as UserRole) 
      ? (role as UserRole) 
      : UserRole.USER;

    // Vérifier si l'utilisateur existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "Un utilisateur avec cet email existe déjà" },
        { status: 400 }
      );
    }

    // Générer un code de vérification
    const code = generateCode();

    // Créer l'utilisateur
    const newUser = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        code,
        role: userRole,
      },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    // Envoyer l'email avec le code
    try {
      await sendVerificationCode(email, code);
    } catch (emailError) {
      console.error("Erreur lors de l'envoi de l'email:", emailError);
      // Ne pas bloquer la création de l'utilisateur si l'email échoue
    }

    return NextResponse.json({ user: newUser }, { status: 201 });
  } catch (error) {
    console.error("Erreur lors de la création de l'utilisateur:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de l'utilisateur" },
      { status: 500 }
    );
  }
}


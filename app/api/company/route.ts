import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const company = await prisma.company.findUnique({
      where: { userId: user.userId },
      select: {
        id: true,
        nomSociete: true,
        siret: true,
        adresse: true,
        codePostal: true,
        ville: true,
        email: true,
        telephone: true,
        siteWeb: true,
        logoUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ company }, { status: 200 });
  } catch (error) {
    console.error("Erreur lors de la récupération de l'entreprise:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de l'entreprise" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      nomSociete,
      siret,
      adresse,
      codePostal,
      ville,
      email,
      telephone,
      siteWeb,
      logoUrl,
    } = body;

    // Validation
    if (!nomSociete || !siret) {
      return NextResponse.json(
        { error: "Le nom de l'entreprise et le SIRET sont obligatoires" },
        { status: 400 }
      );
    }

    // Validation du SIRET (14 chiffres)
    const siretRegex = /^\d{14}$/;
    if (!siretRegex.test(siret.replace(/\s/g, ""))) {
      return NextResponse.json(
        { error: "Le SIRET doit contenir 14 chiffres" },
        { status: 400 }
      );
    }

    // Vérifier si le SIRET est déjà utilisé par un autre utilisateur
    const existingCompany = await prisma.company.findFirst({
      where: {
        siret: siret.replace(/\s/g, ""),
        userId: { not: user.userId },
      },
    });

    if (existingCompany) {
      return NextResponse.json(
        { error: "Ce SIRET est déjà utilisé par un autre utilisateur" },
        { status: 400 }
      );
    }

    // Créer ou mettre à jour l'entreprise
    const company = await prisma.company.upsert({
      where: { userId: user.userId },
      update: {
        nomSociete,
        siret: siret.replace(/\s/g, ""),
        adresse: adresse || null,
        codePostal: codePostal || null,
        ville: ville || null,
        email: email || null,
        telephone: telephone || null,
        siteWeb: siteWeb || null,
        logoUrl: logoUrl || null,
      },
      create: {
        userId: user.userId,
        nomSociete,
        siret: siret.replace(/\s/g, ""),
        adresse: adresse || null,
        codePostal: codePostal || null,
        ville: ville || null,
        email: email || null,
        telephone: telephone || null,
        siteWeb: siteWeb || null,
        logoUrl: logoUrl || null,
      },
      select: {
        id: true,
        nomSociete: true,
        siret: true,
        adresse: true,
        codePostal: true,
        ville: true,
        email: true,
        telephone: true,
        siteWeb: true,
        logoUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ company }, { status: 200 });
  } catch (error) {
    console.error("Erreur lors de la sauvegarde de l'entreprise:", error);
    return NextResponse.json(
      { error: "Erreur lors de la sauvegarde de l'entreprise" },
      { status: 500 }
    );
  }
}


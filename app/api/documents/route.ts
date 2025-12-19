import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { UserRole } from "@/app/generated/prisma/enums";

/**
 * GET /api/documents - Récupère tous les documents de l'utilisateur
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

    // Récupérer toutes les procédures de l'utilisateur
    const where: any = {};
    
    if (user.role === UserRole.USER) {
      where.userId = user.userId;
    } else if (user.role === UserRole.AVOCAT || user.role === UserRole.JURISTE) {
      // Les avocats/juristes peuvent voir les documents des procédures qui leur sont assignées
      where.OR = [
        { avocatId: user.userId },
        { avocatId: null }, // Nouveaux dossiers non assignés
      ];
    }

    const procedures = await prisma.procedure.findMany({
      where,
      select: {
        id: true,
        contexte: true,
        status: true,
        createdAt: true,
        client: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            nomSociete: true,
          },
        },
        documents: {
          select: {
            id: true,
            type: true,
            fileName: true,
            filePath: true,
            fileSize: true,
            mimeType: true,
            numeroFacture: true,
            dateFactureEchue: true,
            montantDue: true,
            montantTTC: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Aplatir les documents avec les informations de leur procédure
    const documents = procedures.flatMap((procedure) =>
      procedure.documents.map((doc) => ({
        ...doc,
        procedure: {
          id: procedure.id,
          contexte: procedure.contexte,
          status: procedure.status,
          createdAt: procedure.createdAt,
          client: procedure.client,
        },
      }))
    );

    return NextResponse.json({ documents }, { status: 200 });
  } catch (error) {
    console.error("Erreur lors de la récupération des documents:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des documents" },
      { status: 500 }
    );
  }
}


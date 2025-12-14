import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { canCommentDossier } from "@/lib/permissions";
import { UserRole } from "@/app/generated/prisma/enums";
import { ProcedureStatus } from "@/app/generated/prisma/enums";

/**
 * GET /api/procedures/[id]/comments - Récupère tous les commentaires d'une procédure
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const procedureId = id;

    // Vérifier que la procédure existe et que l'utilisateur peut la voir
    const procedure = await prisma.procedure.findUnique({
      where: { id: procedureId },
      select: { userId: true },
    });

    if (!procedure) {
      return NextResponse.json(
        { error: "Procédure non trouvée" },
        { status: 404 }
      );
    }

    // Les USER ne peuvent voir les commentaires que de leurs propres dossiers
    // Les JURISTE et AVOCAT peuvent voir tous les commentaires
    if (user.role === "USER" && procedure.userId !== user.userId) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de voir les commentaires de ce dossier" },
        { status: 403 }
      );
    }

    const comments = await prisma.comment.findMany({
      where: { procedureId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json({ comments }, { status: 200 });
  } catch (error) {
    console.error("Erreur lors de la récupération des commentaires:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des commentaires" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/procedures/[id]/comments - Ajoute un commentaire à une procédure
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const procedureId = id;

    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Le contenu du commentaire est requis" },
        { status: 400 }
      );
    }

    // Vérifier que la procédure existe
    const procedure = await prisma.procedure.findUnique({
      where: { id: procedureId },
      select: { userId: true },
    });

    if (!procedure) {
      return NextResponse.json(
        { error: "Procédure non trouvée" },
        { status: 404 }
      );
    }

    // Vérifier les permissions : les USER ne peuvent commenter que leurs propres dossiers
    // Les JURISTE et AVOCAT peuvent commenter tous les dossiers
    if (user.role === "USER" && procedure.userId !== user.userId) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de commenter ce dossier" },
        { status: 403 }
      );
    }

    // Vérifier les permissions générales pour les autres rôles
    if (user.role !== "USER" && !canCommentDossier(user.role)) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de commenter ce dossier" },
        { status: 403 }
      );
    }

    // Créer le commentaire
    const comment = await prisma.comment.create({
      data: {
        procedureId,
        userId: user.userId,
        content: content.trim(),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // Mettre à jour le statut du dossier à "EN_ATTENTE_RETOUR" après l'envoi d'un message
    await prisma.procedure.update({
      where: { id: procedureId },
      data: {
        status: ProcedureStatus.EN_ATTENTE_RETOUR,
      },
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error("Erreur lors de la création du commentaire:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du commentaire" },
      { status: 500 }
    );
  }
}


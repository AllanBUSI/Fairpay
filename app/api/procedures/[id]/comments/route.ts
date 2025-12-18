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

    // Récupérer les informations complètes de la procédure pour l'email
    const procedureWithUsers = await prisma.procedure.findUnique({
      where: { id: procedureId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
        avocat: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!procedureWithUsers) {
      return NextResponse.json(
        { error: "Procédure non trouvée" },
        { status: 404 }
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

    // Envoyer un email de notification
    try {
      let recipientEmail: string | null = null;

      if (user.role === UserRole.AVOCAT) {
        // Si l'avocat envoie un message, notifier l'utilisateur
        recipientEmail = procedureWithUsers.user.email;
      } else if (user.role === UserRole.USER && procedureWithUsers.avocat) {
        // Si l'utilisateur répond, notifier l'avocat
        recipientEmail = procedureWithUsers.avocat.email;
      }

      if (recipientEmail) {
        const emailSubject = user.role === UserRole.AVOCAT
          ? "Nouveau message de votre avocat - FairPay"
          : "Réponse de l'utilisateur - FairPay";

        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0F172A;">${emailSubject}</h2>
            <p>Bonjour,</p>
            <p>${user.role === UserRole.AVOCAT ? "Votre avocat" : "L'utilisateur"} a envoyé un nouveau message concernant votre dossier.</p>
            <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Message :</strong></p>
              <p style="margin: 10px 0 0 0; white-space: pre-wrap;">${content.trim()}</p>
            </div>
            <p>Vous pouvez consulter et répondre à ce message directement depuis votre espace FairPay.</p>
            <p style="margin-top: 30px; color: #6b7280; font-size: 12px;">
              Cet email a été envoyé automatiquement par FairPay.
            </p>
          </div>
        `;

        // Appeler l'API d'envoi d'email de manière asynchrone (ne pas bloquer la réponse)
        fetch(`${process.env["NEXT_PUBLIC_APP_URL"] || "http://localhost:3000"}/api/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: recipientEmail,
            subject: emailSubject,
            html: emailHtml,
          }),
        }).catch((err) => {
          console.error("Erreur lors de l'envoi de l'email de notification:", err);
        });
      }
    } catch (emailError) {
      // Ne pas faire échouer la création du commentaire si l'email échoue
      console.error("Erreur lors de l'envoi de l'email:", emailError);
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    console.error("Erreur lors de la création du commentaire:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création du commentaire" },
      { status: 500 }
    );
  }
}


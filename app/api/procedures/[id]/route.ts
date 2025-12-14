import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { canViewDossier, canValidateDossier } from "@/lib/permissions";
import { DossierAcceptation, UserRole, ProcedureStatus } from "@/app/generated/prisma/enums";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Vérifier l'authentification JWT
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const procedureId = id;

    // Récupérer la procédure avec toutes ses informations
    const procedure = await prisma.procedure.findUnique({
      where: { id: procedureId },
      include: {
        client: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            siret: true,
            nomSociete: true,
            adresse: true,
            codePostal: true,
            ville: true,
            email: true,
            telephone: true,
          },
        },
        documents: {
          orderBy: {
            createdAt: "desc",
          },
        },
        comments: {
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
            createdAt: "desc",
          },
        },
      },
    });

    if (!procedure) {
      return NextResponse.json(
        { error: "Procédure non trouvée" },
        { status: 404 }
      );
    }

    // Vérifier les permissions : les USER ne peuvent voir que leurs propres dossiers
    if (user.role === UserRole.USER && procedure.userId !== user.userId) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de consulter ce dossier" },
        { status: 403 }
      );
    }

    // Vérifier les permissions générales pour les autres rôles
    if (user.role !== UserRole.USER && !canViewDossier(user.role)) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de consulter ce dossier" },
        { status: 403 }
      );
    }

    return NextResponse.json({ procedure }, { status: 200 });
  } catch (error) {
    console.error("Erreur lors de la récupération de la procédure:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération de la procédure" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/procedures/[id] - Met à jour une procédure (validation pour les avocats)
 */
export async function PATCH(
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
    const { acceptation, status, analysed, miseEnDemeure, avocatId, echeancier, dateRelance, dateRelance2 } = body;

    // Vérifier que la procédure existe
    const existingProcedure = await prisma.procedure.findUnique({
      where: { id: procedureId },
      select: { userId: true, avocatId: true },
    });

    if (!existingProcedure) {
      return NextResponse.json(
        { error: "Procédure non trouvée" },
        { status: 404 }
      );
    }

    // Vérifier les permissions : USER peut modifier le statut de ses propres dossiers
    // AVOCAT peut modifier uniquement les dossiers qui lui sont assignés ou les nouveaux dossiers non assignés
    if (user.role === UserRole.USER && existingProcedure.userId !== user.userId) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de modifier ce dossier" },
        { status: 403 }
      );
    }
    
    if (user.role === UserRole.AVOCAT) {
      // Un avocat ne peut modifier que les dossiers qui lui sont assignés ou les nouveaux dossiers non assignés
      if (existingProcedure.avocatId !== null && existingProcedure.avocatId !== user.userId) {
        return NextResponse.json(
          { error: "Ce dossier est assigné à un autre avocat" },
          { status: 403 }
        );
      }
    }

    // Construire les données à mettre à jour
    const updateData: any = {};

    // Si on met à jour l'acceptation (seulement pour les avocats)
    if (acceptation !== undefined) {
      if (!canValidateDossier(user.role)) {
        return NextResponse.json(
          { error: "Vous n'avez pas la permission de valider ce dossier" },
          { status: 403 }
        );
      }

      const validAcceptations: DossierAcceptation[] = [
        DossierAcceptation.PAS_ENCORE_CHOISI,
        DossierAcceptation.ACCEPTE,
        DossierAcceptation.REFUSE,
      ];

      if (!validAcceptations.includes(acceptation as DossierAcceptation)) {
        return NextResponse.json(
          { error: "Valeur d'acceptation invalide" },
          { status: 400 }
        );
      }

      updateData.acceptation = acceptation as DossierAcceptation;
    }

    // Si on met à jour le statut
    if (status !== undefined) {
      const validStatuses = ["NOUVEAU", "EN_COURS", "RESOLU", "ANNULE", "EN_ATTENTE_REPONSE", "EN_ATTENTE_RETOUR", "LRAR", "LRAR_ECHEANCIER"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: "Statut invalide" },
          { status: 400 }
        );
      }
      
      // Vérifier les permissions : USER ne peut mettre que RESOLU
      if (user.role === UserRole.USER && status !== "RESOLU") {
        return NextResponse.json(
          { error: "Vous ne pouvez que mettre le dossier en résolu" },
          { status: 403 }
        );
      }
      
      updateData.status = status;
    }

    // Si on met à jour l'analyse (seulement pour les avocats)
    if (analysed !== undefined) {
      if (user.role !== UserRole.AVOCAT) {
        return NextResponse.json(
          { error: "Seuls les avocats peuvent marquer un dossier comme analysé" },
          { status: 403 }
        );
      }
      updateData.analysed = analysed;
    }

    // Si on met à jour la mise en demeure (seulement pour les avocats)
    if (miseEnDemeure !== undefined) {
      if (user.role !== UserRole.AVOCAT) {
        return NextResponse.json(
          { error: "Seuls les avocats peuvent écrire la mise en demeure" },
          { status: 403 }
        );
      }
      updateData.miseEnDemeure = miseEnDemeure;
    }

    // Si on assigne le dossier à un avocat (prendre le dossier)
    if (avocatId !== undefined) {
      if (user.role !== UserRole.AVOCAT) {
        return NextResponse.json(
          { error: "Seuls les avocats peuvent prendre un dossier" },
          { status: 403 }
        );
      }
      // Vérifier que le dossier n'est pas déjà assigné à un autre avocat
      if (existingProcedure.avocatId !== null && existingProcedure.avocatId !== user.userId) {
        return NextResponse.json(
          { error: "Ce dossier est déjà assigné à un autre avocat" },
          { status: 403 }
        );
      }
      updateData.avocatId = avocatId === user.userId ? user.userId : null;
    }

    // Si on met à jour les dates de relance
    if (dateRelance !== undefined) {
      updateData.dateRelance = dateRelance ? new Date(dateRelance) : null;
    }

    if (dateRelance2 !== undefined) {
      updateData.dateRelance2 = dateRelance2 ? new Date(dateRelance2) : null;
    }

    // Mettre à jour la procédure
    const procedure = await prisma.procedure.update({
      where: { id: procedureId },
      data: updateData,
      include: {
        client: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            siret: true,
            nomSociete: true,
            email: true,
            telephone: true,
          },
        },
        documents: {
          orderBy: {
            createdAt: "desc",
          },
        },
        comments: {
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
            createdAt: "desc",
          },
        },
      },
    });

    return NextResponse.json({ procedure }, { status: 200 });
  } catch (error) {
    console.error("Erreur lors de la mise à jour de la procédure:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de la procédure" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/procedures/[id] - Supprime un brouillon
 */
export async function DELETE(
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

    // Vérifier que la procédure existe
    const existingProcedure = await prisma.procedure.findUnique({
      where: { id: procedureId },
      select: { 
        userId: true, 
        status: true,
        documents: {
          select: { id: true }
        }
      },
    });

    if (!existingProcedure) {
      return NextResponse.json(
        { error: "Procédure non trouvée" },
        { status: 404 }
      );
    }

    // Vérifier que c'est un brouillon
    if (existingProcedure.status !== ProcedureStatus.BROUILLONS) {
      return NextResponse.json(
        { error: "Seuls les brouillons peuvent être supprimés" },
        { status: 400 }
      );
    }

    // Vérifier les permissions : USER ne peut supprimer que ses propres brouillons
    if (user.role === UserRole.USER && existingProcedure.userId !== user.userId) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de supprimer ce brouillon" },
        { status: 403 }
      );
    }

    // Supprimer les documents associés
    if (existingProcedure.documents && existingProcedure.documents.length > 0) {
      await prisma.document.deleteMany({
        where: { procedureId },
      });
    }

    // Supprimer la procédure
    await prisma.procedure.delete({
      where: { id: procedureId },
    });

    return NextResponse.json({ message: "Brouillon supprimé avec succès" }, { status: 200 });
  } catch (error) {
    console.error("Erreur lors de la suppression du brouillon:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du brouillon" },
      { status: 500 }
    );
  }
}

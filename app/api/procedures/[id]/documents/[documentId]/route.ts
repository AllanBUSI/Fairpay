import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { canUploadDocuments } from "@/lib/permissions";
import { UserRole } from "@/app/generated/prisma/enums";

/**
 * PATCH /api/procedures/[id]/documents/[documentId] - Met à jour un document (notamment le numéro de facture)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; documentId: string }> }
) {
  try {
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const { id, documentId } = await params;
    const procedureId = id;

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

    // Vérifier que le document existe et appartient à cette procédure
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: { procedureId: true, type: true },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document non trouvé" },
        { status: 404 }
      );
    }

    if (document.procedureId !== procedureId) {
      return NextResponse.json(
        { error: "Document n'appartient pas à cette procédure" },
        { status: 400 }
      );
    }

    // Vérifier les permissions : les USER ne peuvent modifier que leurs propres dossiers
    // Les AVOCAT peuvent modifier tous les dossiers
    if (user.role === UserRole.USER && procedure.userId !== user.userId) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de modifier ce document" },
        { status: 403 }
      );
    }

    if (user.role !== UserRole.USER && !canUploadDocuments(user.role)) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de modifier ce document" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { numeroFacture, dateFactureEchue, montantDue, montantTTC } = body;

    // Mettre à jour le document
    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: {
        numeroFacture: numeroFacture || null,
        dateFactureEchue: dateFactureEchue ? new Date(dateFactureEchue) : null,
        montantDue: montantDue || null,
        montantTTC: montantTTC ?? null,
      },
    });

    return NextResponse.json({ document: updatedDocument }, { status: 200 });
  } catch (error) {
    console.error("Erreur lors de la mise à jour du document:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour du document" },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { canUploadDocuments } from "@/lib/permissions";
import { UserRole } from "@/app/generated/prisma/enums";
import { DocumentType } from "@/app/generated/prisma/enums";

/**
 * POST /api/procedures/[id]/documents - Ajoute un document à une procédure existante
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

    // Vérifier les permissions : les USER ne peuvent ajouter des documents qu'à leurs propres dossiers
    // Les AVOCAT peuvent ajouter des documents à tous les dossiers
    if (user.role === UserRole.USER && procedure.userId !== user.userId) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission d'ajouter des documents à ce dossier" },
        { status: 403 }
      );
    }

    if (user.role !== UserRole.USER && !canUploadDocuments(user.role)) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission d'ajouter des documents" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { documents } = body;

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return NextResponse.json(
        { error: "Aucun document fourni" },
        { status: 400 }
      );
    }

    // Créer les documents
    const createdDocuments = await Promise.all(
      documents.map(async (doc: {
        type: string;
        fileName?: string;
        filePath: string;
        fileSize?: number;
        mimeType?: string;
        numeroFacture?: string | null;
        dateFactureEchue?: string | null;
        montantDue?: number | null;
        montantTTC?: boolean | null;
      }) => {
        // Valider le type de document
        const validTypes: DocumentType[] = [
          DocumentType.FACTURE,
          DocumentType.DEVIS,
          DocumentType.CONTRAT,
          DocumentType.EMAIL,
          DocumentType.WHATSAPP_SMS,
          DocumentType.AUTRES_PREUVES,
        ];
        
        const docType = validTypes.includes(doc.type as DocumentType)
          ? (doc.type as DocumentType)
          : DocumentType.AUTRES_PREUVES;

        return prisma.document.create({
          data: {
            procedureId,
            type: docType,
            fileName: doc.fileName || "fichier",
            filePath: doc.filePath, // URL Supabase
            fileSize: doc.fileSize || 0,
            mimeType: doc.mimeType || "application/octet-stream",
            numeroFacture: doc.numeroFacture || null,
            dateFactureEchue: doc.dateFactureEchue ? new Date(doc.dateFactureEchue) : null,
            montantDue: doc.montantDue || null,
            montantTTC: doc.montantTTC ?? null,
          },
        });
      })
    );

    return NextResponse.json({ documents: createdDocuments }, { status: 201 });
  } catch (error) {
    console.error("Erreur lors de l'ajout des documents:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'ajout des documents" },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { UserRole, DocumentType } from "@/app/generated/prisma/enums";
import { supabaseAdmin } from "@/lib/supabase";

const BUCKET_NAME = process.env["SUPABASE_BUCKET_NAME"] || "File";

/**
 * DELETE /api/documents/[documentId] - Supprime un document (sauf les factures)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const { documentId } = await params;

    // Récupérer le document avec sa procédure
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        procedure: {
          select: {
            id: true,
            userId: true,
            avocatId: true,
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: "Document non trouvé" },
        { status: 404 }
      );
    }

    // Vérifier que ce n'est pas une facture
    if (document.type === DocumentType.FACTURE) {
      return NextResponse.json(
        { error: "Les factures ne peuvent pas être supprimées" },
        { status: 403 }
      );
    }

    // Vérifier les permissions
    const procedure = document.procedure;
    
    if (user.role === UserRole.USER && procedure.userId !== user.userId) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de supprimer ce document" },
        { status: 403 }
      );
    }

    if (
      (user.role === UserRole.AVOCAT || user.role === UserRole.JURISTE) &&
      procedure.avocatId !== user.userId &&
      procedure.userId !== user.userId
    ) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de supprimer ce document" },
        { status: 403 }
      );
    }

    // Extraire le chemin du fichier depuis l'URL Supabase
    // Le filePath est généralement une URL complète, on doit extraire le chemin relatif
    let filePath = document.filePath;
    
    // Si c'est une URL Supabase, extraire le chemin
    if (filePath.includes("/storage/v1/object/public/")) {
      const parts = filePath.split("/storage/v1/object/public/");
      if (parts.length > 1) {
        filePath = parts[1].split("?")[0]; // Enlever les query params
      }
    } else if (filePath.includes(BUCKET_NAME + "/")) {
      // Si c'est déjà un chemin relatif avec le bucket
      const parts = filePath.split(BUCKET_NAME + "/");
      if (parts.length > 1) {
        filePath = parts[1];
      }
    }

    // Supprimer le fichier de Supabase Storage
    if (supabaseAdmin && filePath) {
      try {
        const { error: deleteError } = await supabaseAdmin.storage
          .from(BUCKET_NAME)
          .remove([filePath]);

        if (deleteError) {
          console.error("Erreur lors de la suppression du fichier Supabase:", deleteError);
          // Continuer quand même pour supprimer l'entrée en base de données
        }
      } catch (storageError) {
        console.error("Erreur lors de la suppression du fichier:", storageError);
        // Continuer quand même pour supprimer l'entrée en base de données
      }
    }

    // Supprimer le document de la base de données
    await prisma.document.delete({
      where: { id: documentId },
    });

    return NextResponse.json(
      { message: "Document supprimé avec succès" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erreur lors de la suppression du document:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du document" },
      { status: 500 }
    );
  }
}


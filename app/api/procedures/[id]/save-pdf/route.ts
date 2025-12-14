import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";
import { DocumentType } from "@/app/generated/prisma/enums";

const BUCKET_NAME = process.env.SUPABASE_BUCKET_NAME || "File";

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

    const { id: procedureId } = await params;

    // Vérifier que la procédure existe et appartient à l'utilisateur
    const procedure = await prisma.procedure.findUnique({
      where: { id: procedureId },
    });

    if (!procedure) {
      return NextResponse.json(
        { error: "Procédure non trouvée" },
        { status: 404 }
      );
    }

    if (procedure.userId !== user.userId && user.role !== "AVOCAT") {
      return NextResponse.json(
        { error: "Vous n'avez pas accès à cette procédure" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { pdfBase64, fileName, documentType } = body;

    if (!pdfBase64 || !fileName || !documentType) {
      return NextResponse.json(
        { error: "Données manquantes (pdfBase64, fileName, documentType requis)" },
        { status: 400 }
      );
    }

    // Convertir le base64 en buffer
    const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // Générer un chemin de fichier unique
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const filePath = `${user.userId}/${documentType}/${timestamp}-${randomString}.pdf`;

    // Upload vers Supabase Storage
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Configuration Supabase manquante" },
        { status: 500 }
      );
    }

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Erreur upload Supabase:", uploadError);
      return NextResponse.json(
        { error: "Erreur lors de l'upload du PDF" },
        { status: 500 }
      );
    }

    // Obtenir l'URL publique
    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    // Créer le document dans la base de données
    const document = await prisma.document.create({
      data: {
        procedureId,
        type: DocumentType.AUTRES_PREUVES, // Type par défaut pour les PDFs générés
        fileName: fileName,
        filePath: urlData.publicUrl,
        fileSize: buffer.length,
        mimeType: "application/pdf",
      },
    });

    return NextResponse.json({ document }, { status: 201 });
  } catch (error) {
    console.error("Erreur lors de la sauvegarde du PDF:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


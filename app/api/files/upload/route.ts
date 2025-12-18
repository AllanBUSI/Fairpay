import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { canUploadDocuments } from "@/lib/permissions";
import { supabaseAdmin } from "@/lib/supabase";

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const BUCKET_NAME = process.env["SUPABASE_BUCKET_NAME"] || "File"; // Nom du bucket Supabase Storage

export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification JWT
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Vérifier les permissions pour uploader des documents
    if (!canUploadDocuments(user.role)) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission d'uploader des documents" },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const type = formData.get("type") as string;

    if (!file) {
      return NextResponse.json(
        { error: "Aucun fichier fourni" },
        { status: 400 }
      );
    }

    if (!type) {
      return NextResponse.json(
        { error: "Type de document requis" },
        { status: 400 }
      );
    }

    // Vérifier le type MIME
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Type de fichier non autorisé. Seuls les images (JPEG, PNG, GIF, WebP) et PDF sont acceptés." },
        { status: 400 }
      );
    }

    // Vérifier la taille
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Fichier trop volumineux. Taille maximale: 10MB" },
        { status: 400 }
      );
    }

    // Générer un nom de fichier unique
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = file.name.split(".").pop();
    const fileName = `${timestamp}-${randomString}.${extension}`;
    const filePath = `${user.userId}/${type}/${fileName}`;

    // Convertir le fichier en buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Utiliser le client admin pour contourner les politiques RLS
    if (!supabaseAdmin) {
      return NextResponse.json(
        { 
          error: "SUPABASE_SERVICE_ROLE_KEY manquante. " +
          "Veuillez ajouter SUPABASE_SERVICE_ROLE_KEY dans votre .env pour permettre les uploads."
        },
        { status: 500 }
      );
    }

    // Upload vers Supabase Storage avec le client admin
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Erreur Supabase upload:", uploadError);
      
      // Message d'erreur plus explicite
      if (uploadError.message.includes("Bucket not found")) {
        return NextResponse.json(
          { 
            error: `Le bucket '${BUCKET_NAME}' n'existe pas dans Supabase Storage. ` +
            `Veuillez créer un bucket nommé '${BUCKET_NAME}' dans votre projet Supabase avec les permissions publiques.`
          },
          { status: 500 }
        );
      }
      
      const uploadErrorObj = uploadError as { statusCode?: string | number; status?: number; message: string };
      if (uploadError.message.includes("row-level security") || uploadErrorObj.statusCode === '403' || uploadErrorObj.status === 403) {
        return NextResponse.json(
          { 
            error: "Erreur de permissions Supabase. " +
            "Vérifiez que SUPABASE_SERVICE_ROLE_KEY est correcte dans votre .env."
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: "Erreur lors de l'upload vers Supabase: " + uploadError.message },
        { status: 500 }
      );
    }

    // Obtenir l'URL publique du fichier (peut utiliser le client normal pour la lecture)
    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      return NextResponse.json(
        { error: "Erreur lors de la récupération de l'URL publique" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        fileName: file.name,
        filePath: urlData.publicUrl, // URL publique Supabase
        fileSize: file.size,
        mimeType: file.type,
        type,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erreur lors de l'upload:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'upload du fichier" },
      { status: 500 }
    );
  }
}


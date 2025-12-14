import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const BUCKET_NAME = process.env.SUPABASE_BUCKET_NAME || "File";

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "Aucun fichier fourni" },
        { status: 400 }
      );
    }

    // Vérifier le type MIME
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Type de fichier non autorisé. Formats acceptés : JPEG, PNG, GIF, WebP" },
        { status: 400 }
      );
    }

    // Vérifier la taille du fichier
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Le fichier est trop volumineux. Taille maximale : 5MB" },
        { status: 400 }
      );
    }

    // Vérifier que l'entreprise existe
    const company = await prisma.company.findUnique({
      where: { userId: user.userId },
    });

    if (!company) {
      return NextResponse.json(
        { error: "Entreprise non trouvée" },
        { status: 404 }
      );
    }

    // Générer un nom de fichier unique
    const fileExt = file.name.split(".").pop();
    const fileName = `logos/${user.userId}-${Date.now()}.${fileExt}`;

    // Convertir le fichier en buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload vers Supabase
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Erreur upload Supabase:", uploadError);
      return NextResponse.json(
        { error: "Erreur lors de l'upload du logo" },
        { status: 500 }
      );
    }

    // Obtenir l'URL publique
    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    const logoUrl = urlData.publicUrl;

    // Supprimer l'ancien logo si il existe
    if (company.logoUrl) {
      try {
        // Extraire le chemin complet depuis l'URL
        const urlParts = company.logoUrl.split("/");
        const pathIndex = urlParts.findIndex(part => part === BUCKET_NAME);
        if (pathIndex !== -1 && pathIndex < urlParts.length - 1) {
          const oldFilePath = urlParts.slice(pathIndex + 1).join("/");
          await supabaseAdmin.storage
            .from(BUCKET_NAME)
            .remove([oldFilePath]);
        }
      } catch (err) {
        console.error("Erreur suppression ancien logo:", err);
        // On continue même si la suppression échoue
      }
    }

    // Mettre à jour l'entreprise avec la nouvelle URL du logo
    const updatedCompany = await prisma.company.update({
      where: { userId: user.userId },
      data: { logoUrl },
      select: {
        id: true,
        logoUrl: true,
      },
    });

    return NextResponse.json(
      { logoUrl: updatedCompany.logoUrl },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erreur lors de l'upload du logo:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'upload du logo" },
      { status: 500 }
    );
  }
}


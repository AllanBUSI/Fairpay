import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabase";
import { PDFDocument } from "pdf-lib";
import { ProcedureStatus } from "@/app/generated/prisma/enums";

const BUCKET_NAME = process.env["SUPABASE_BUCKET_NAME"] || "File";

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
    const body = await request.json();
    const { documentIds } = body;

    console.log("Document IDs reçus (ordre):", documentIds);

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json(
        { error: "Aucun document sélectionné" },
        { status: 400 }
      );
    }

    // Vérifier que la procédure existe et que l'utilisateur y a accès
    const procedure = await prisma.procedure.findUnique({
      where: { id: procedureId },
      include: {
        documents: {
          where: {
            id: { in: documentIds }, // Récupérer uniquement les documents demandés
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

    if (procedure.avocatId !== user.userId && user.role !== "AVOCAT") {
      return NextResponse.json(
        { error: "Vous n'avez pas accès à cette procédure" },
        { status: 403 }
      );
    }

    console.log(`Documents récupérés de la base: ${procedure.documents.length}`);
    console.log(`IDs des documents récupérés: ${procedure.documents.map(d => d.id).join(", ")}`);

    // Créer une Map pour un accès rapide aux documents par ID
    const documentsMap = new Map(procedure.documents.map(doc => [doc.id, doc]));

    // Respecter l'ordre exact des documentIds passés et filtrer les PDFs/images
    const documentsToMerge: typeof procedure.documents = [];
    const processedIds = new Set<string>();
    
    // Traiter dans l'ordre exact fourni
    for (const docId of documentIds) {
      if (processedIds.has(docId)) {
        console.log(`Document ${docId} déjà traité, ignoré`);
        continue;
      }
      
      const document = documentsMap.get(docId);
      if (document) {
        // Vérifier que c'est un PDF ou une image
        if (document.mimeType === "application/pdf" || document.mimeType.startsWith("image/")) {
          documentsToMerge.push(document);
          processedIds.add(docId);
        } else {
          console.log(`Document ${docId} (${document.fileName}) ignoré (type: ${document.mimeType})`);
        }
      } else {
        console.log(`Document ${docId} non trouvé dans la procédure`);
      }
    }

    console.log(`Nombre total de documents dans la procédure: ${procedure.documents.length}`);
    console.log(`Nombre de documents à fusionner: ${documentsToMerge.length}`);
    console.log(`IDs des documents à fusionner: ${documentsToMerge.map(d => d.id).join(", ")}`);
    console.log(`Documents à fusionner (ordre): ${documentsToMerge.map((d, i) => `${i + 1}. ${d.fileName}`).join(" -> ")}`);

    if (documentsToMerge.length === 0) {
      return NextResponse.json(
        { error: "Aucun document PDF ou image à fusionner" },
        { status: 400 }
      );
    }

    // Vérifier qu'on ne fusionne que les documents demandés
    if (documentsToMerge.length !== documentIds.length) {
      console.warn(`Attention: ${documentsToMerge.length} documents seront fusionnés sur ${documentIds.length} demandés`);
    }

    // Créer un nouveau PDF
    const mergedPdf = await PDFDocument.create();

    // Traiter chaque document dans l'ordre exact
    let processedCount = 0;
    for (const document of documentsToMerge) {
      processedCount++;
      console.log(`Traitement du document ${processedCount}/${documentsToMerge.length}: ${document.fileName} (${document.id})`);
      try {
        if (document.mimeType === "application/pdf") {
          // Télécharger le PDF
          const response = await fetch(document.filePath);
          if (!response.ok) {
            console.error(`Erreur lors du téléchargement du PDF ${document.id}:`, response.statusText);
            continue;
          }
          const pdfBytes = await response.arrayBuffer();
          const pdfDoc = await PDFDocument.load(pdfBytes);
          
          // Copier toutes les pages
          const pages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
          pages.forEach((page) => mergedPdf.addPage(page));
        } else if (document.mimeType.startsWith("image/")) {
          // Télécharger l'image
          const response = await fetch(document.filePath);
          if (!response.ok) {
            console.error(`Erreur lors du téléchargement de l'image ${document.id}:`, response.statusText);
            continue;
          }
          const imageBytes = await response.arrayBuffer();
          
          // Ajouter l'image comme page dans le PDF
          let image;
          if (document.mimeType === "image/jpeg" || document.mimeType === "image/jpg") {
            image = await mergedPdf.embedJpg(imageBytes);
          } else if (document.mimeType === "image/png") {
            image = await mergedPdf.embedPng(imageBytes);
          } else {
            // Pour les autres formats d'image, essayer PNG
            try {
              image = await mergedPdf.embedPng(imageBytes);
            } catch {
              console.error(`Format d'image non supporté: ${document.mimeType}`);
              continue;
            }
          }
          
          // Créer une page A4 et ajouter l'image
          const page = mergedPdf.addPage([595, 842]); // A4 en points (72 DPI)
          const { width, height } = image.scale(1);
          const pageWidth = page.getWidth();
          const pageHeight = page.getHeight();
          
          // Centrer l'image sur la page
          const scaleX = pageWidth / width;
          const scaleY = pageHeight / height;
          const scale = Math.min(scaleX, scaleY, 1); // Ne pas agrandir
          
          const scaledWidth = width * scale;
          const scaledHeight = height * scale;
          const x = (pageWidth - scaledWidth) / 2;
          const y = (pageHeight - scaledHeight) / 2;
          
          page.drawImage(image, {
            x,
            y,
            width: scaledWidth,
            height: scaledHeight,
          });
        }
      } catch (error) {
        console.error(`Erreur lors du traitement du document ${document.id}:`, error);
        // Continuer avec les autres documents
        continue;
      }
    }

    // Générer le PDF fusionné
    const mergedPdfBytes = await mergedPdf.save();

    // Upload vers Supabase
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: "Configuration Supabase manquante" },
        { status: 500 }
      );
    }

    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileName = `merged-${procedureId}-${timestamp}-${randomString}.pdf`;
    const filePath = `${user.userId}/merged/${fileName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(filePath, Buffer.from(mergedPdfBytes), {
        contentType: "application/pdf",
        upsert: false,
      });

    if (uploadError) {
      console.error("Erreur upload Supabase:", uploadError);
      return NextResponse.json(
        { error: "Erreur lors de l'upload du PDF fusionné" },
        { status: 500 }
      );
    }

    // Obtenir l'URL publique
    const { data: urlData } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    // Créer le document dans la base de données
    const mergedDocument = await prisma.document.create({
      data: {
        procedureId,
        type: "AUTRES_PREUVES",
        fileName: `Document fusionné - ${new Date().toLocaleDateString("fr-FR")}.pdf`,
        filePath: urlData.publicUrl,
        fileSize: mergedPdfBytes.length,
        mimeType: "application/pdf",
      },
    });

    // Mettre à jour le statut de la procédure à LRAR_FINI
    await prisma.procedure.update({
      where: { id: procedureId },
      data: {
        status: ProcedureStatus.LRAR_FINI,
      },
    });

    return NextResponse.json(
      {
        mergedPdfId: mergedDocument.id,
        mergedPdfUrl: urlData.publicUrl,
        message: "Documents fusionnés avec succès",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erreur lors de la fusion des documents:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


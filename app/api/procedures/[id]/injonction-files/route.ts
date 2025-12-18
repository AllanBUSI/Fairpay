import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 });
    }

    const { id } = await params;
    const procedureId = id;

    // Récupérer le Payment associé à la procédure
    console.log(`🔍 Recherche du Payment pour la procédure ${procedureId}`);
    
    const payment = await prisma.payment.findUnique({
      where: { procedureId: procedureId },
      select: {
        id: true,
        metadata: true,
        procedureId: true,
      },
    });

    console.log(`💳 Payment trouvé:`, payment ? `Oui (${payment.id})` : "Non");

    if (!payment) {
      console.warn(`⚠️ Aucun Payment trouvé pour la procédure ${procedureId}`);
      return NextResponse.json({
        kbisFilePath: null,
        attestationFilePath: null,
      });
    }

    // Extraire les chemins des fichiers depuis les métadonnées
    const metadata = payment.metadata as any;
    console.log(`📋 Métadonnées du Payment:`, metadata);
    
    const files = {
      kbisFilePath: metadata?.["kbisFilePath"] && metadata["kbisFilePath"] !== "" ? metadata["kbisFilePath"] : null,
      attestationFilePath: metadata?.["attestationFilePath"] && metadata["attestationFilePath"] !== "" ? metadata["attestationFilePath"] : null,
    };

    console.log(`📁 Fichiers extraits:`, files);

    return NextResponse.json(files);
  } catch (error) {
    console.error("Erreur lors de la récupération des fichiers d'injonction:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


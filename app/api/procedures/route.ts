import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ProcedureStatus, DocumentType } from "@/app/generated/prisma/enums";
import { UserRole } from "@/app/generated/prisma/enums";

export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification JWT
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Récupérer le paramètre de statut depuis l'URL
    const searchParams = request.nextUrl.searchParams;
    const statusParam = searchParams.get("status");

    // Construire le filtre
    const where: any = {};
    
    // Si l'utilisateur est USER, il ne peut voir que ses propres dossiers
    if (user.role === UserRole.USER) {
      where.userId = user.userId;
    }
    
    // Si l'utilisateur est AVOCAT, il ne peut voir que les dossiers qui lui sont assignés
    // ou les nouveaux dossiers non assignés
    if (user.role === UserRole.AVOCAT) {
      if (statusParam === "NOUVEAU" || statusParam === "all") {
        // Pour les nouveaux dossiers ou la vue "all", on montre les dossiers non assignés ou assignés à cet avocat
        where.OR = [
          { avocatId: null },
          { avocatId: user.userId },
        ];
      } else {
        // Pour les autres statuts, on montre uniquement les dossiers assignés à cet avocat
        where.avocatId = user.userId;
      }
    }
    
    if (statusParam && statusParam !== "all") {
      // Valider que le statut est valide
      const validStatuses: ProcedureStatus[] = [
        ProcedureStatus.NOUVEAU,
        ProcedureStatus.EN_COURS,
        ProcedureStatus.RESOLU,
        ProcedureStatus.ANNULE,
        ProcedureStatus.EN_ATTENTE_REPONSE,
        ProcedureStatus.EN_ATTENTE_RETOUR,
        ProcedureStatus.BROUILLONS,
      ];
      
      if (validStatuses.includes(statusParam as ProcedureStatus)) {
        where.status = statusParam as ProcedureStatus;
      }
    } else {
      // Si aucun statut spécifique n'est demandé (y compris "all"), exclure les brouillons
      where.status = {
        not: ProcedureStatus.BROUILLONS,
      };
    }

    // Récupérer les procédures avec les informations du client et les documents
    const procedures = await prisma.procedure.findMany({
      where,
      select: {
        id: true,
        status: true,
        contexte: true,
        dateFactureEchue: true,
        montantDue: true,
        paymentStatus: true,
        createdAt: true,
        updatedAt: true,
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
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ procedures }, { status: 200 });
  } catch (error) {
    console.error("Erreur lors de la récupération des procédures:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des procédures" },
      { status: 500 }
    );
  }
}

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

    const body = await request.json();
    let { 
      nom, 
      prenom, 
      siret, 
      nomSociete,
      adresse,
      codePostal,
      ville,
      email,
      telephone,
      contexte, 
      dateFactureEchue, 
      montantDue, 
      montantTTC,
      dateRelance,
      dateRelance2,
      status, 
      documents, 
      echeancier 
    } = body;

    // Validation stricte uniquement si ce n'est pas un brouillon
    const isDraft = status === ProcedureStatus.BROUILLONS;
    
    if (!isDraft) {
      // Validation pour les dossiers complets
      if (!nom || !prenom || !siret || !contexte || !dateFactureEchue || !email || !telephone || !adresse || !codePostal || !ville) {
        return NextResponse.json(
          { error: "Tous les champs obligatoires doivent être remplis" },
          { status: 400 }
        );
      }
    } else {
      // Pour les brouillons, utiliser des valeurs par défaut si manquantes
      if (!nom || !prenom || !siret) {
        // Ces champs sont nécessaires pour créer le client, utiliser des valeurs par défaut
        if (!nom) nom = "Non renseigné";
        if (!prenom) prenom = "Non renseigné";
        if (!siret) siret = `DRAFT-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`; // SIRET temporaire unique
      }
    }

    // Vérifier ou créer le client
    // Pour les brouillons avec SIRET temporaire, créer toujours un nouveau client
    let client;
    if (isDraft && siret.startsWith("DRAFT-")) {
      // Créer un nouveau client pour le brouillon
      client = await prisma.client.create({
        data: {
          nom,
          prenom,
          siret,
          nomSociete: nomSociete || null,
          adresse: adresse || null,
          codePostal: codePostal || null,
          ville: ville || null,
          email: email || null,
          telephone: telephone || null,
        },
      });
    } else {
      client = await prisma.client.findUnique({
        where: { siret },
      });

      if (!client) {
        client = await prisma.client.create({
          data: {
            nom,
            prenom,
            siret,
            nomSociete: nomSociete || null,
            adresse: adresse || null,
            codePostal: codePostal || null,
            ville: ville || null,
            email: email || null,
            telephone: telephone || null,
          },
        });
      } else {
        // Mettre à jour les informations du client si elles ont changé
        client = await prisma.client.update({
          where: { id: client.id },
          data: {
            nomSociete: nomSociete || client.nomSociete,
            adresse: adresse || client.adresse,
            codePostal: codePostal || client.codePostal,
            ville: ville || client.ville,
            email: email || client.email,
            telephone: telephone || client.telephone,
          },
        });
      }
    }

    // Créer la procédure avec les documents
    const procedure = await prisma.procedure.create({
      data: {
        clientId: client.id,
        userId: user.userId, // Associer le dossier à l'utilisateur qui le crée
        contexte,
        dateFactureEchue: dateFactureEchue ? new Date(dateFactureEchue) : new Date(),
        montantDue: montantDue !== null && montantDue !== undefined ? parseFloat(montantDue) : null,
        montantTTC: montantTTC !== undefined ? Boolean(montantTTC) : true,
        dateRelance: dateRelance ? new Date(dateRelance) : null,
        dateRelance2: dateRelance2 ? new Date(dateRelance2) : null,
        status: (status as ProcedureStatus) || ProcedureStatus.EN_ATTENTE_REPONSE,
        echeancier: echeancier && Array.isArray(echeancier) && echeancier.length > 0
          ? echeancier.slice(0, 5) // Limiter à 5 échéances maximum
          : null,
        documents: documents && Array.isArray(documents) && documents.length > 0
          ? {
              create: documents.map((doc: {
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

                return {
                  type: docType,
                  fileName: doc.fileName || "fichier",
                  filePath: doc.filePath, // URL Supabase stockée dans Prisma/Neon
                  fileSize: doc.fileSize || 0,
                  mimeType: doc.mimeType || "application/octet-stream",
                  numeroFacture: doc.numeroFacture || null,
                  dateFactureEchue: doc.dateFactureEchue ? new Date(doc.dateFactureEchue) : null,
                  montantDue: doc.montantDue || null,
                  montantTTC: doc.montantTTC ?? null,
                };
              }),
            }
          : undefined,
      },
      include: {
        client: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            siret: true,
          },
        },
        documents: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    return NextResponse.json({ procedure }, { status: 201 });
  } catch (error) {
    console.error("Erreur lors de la création de la procédure:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de la procédure" },
      { status: 500 }
    );
  }
}

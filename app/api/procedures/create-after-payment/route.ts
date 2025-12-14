import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { ProcedureStatus, DocumentType } from "@/app/generated/prisma/enums";
import { PaymentStatus } from "@/app/generated/prisma/enums";

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
    const {
      paymentIntentId,
      procedureData,
      existingProcedureId,
    } = body;

    if (!paymentIntentId || !procedureData) {
      return NextResponse.json(
        { error: "Données manquantes" },
        { status: 400 }
      );
    }

    // Récupérer le paiement
    const payment = await prisma.payment.findUnique({
      where: { stripePaymentIntentId: paymentIntentId },
    });

    if (!payment) {
      return NextResponse.json(
        { error: "Paiement non trouvé" },
        { status: 404 }
      );
    }

    // Si une procédure existe déjà (brouillon), la mettre à jour
    if (existingProcedureId) {
      const existingProcedure = await prisma.procedure.findUnique({
        where: { id: existingProcedureId },
        include: { client: true, documents: true },
      });

      if (!existingProcedure) {
        return NextResponse.json(
          { error: "Brouillon non trouvé" },
          { status: 404 }
        );
      }

      if (existingProcedure.status !== ProcedureStatus.BROUILLONS) {
        return NextResponse.json(
          { error: "Cette procédure n'est pas un brouillon" },
          { status: 400 }
        );
      }

      // Mettre à jour le brouillon existant
      const { nom, prenom, siret, nomSociete, adresse, codePostal, ville, email, telephone, contexte, dateFactureEchue, montantDue, montantTTC, dateRelance, dateRelance2, documents, echeancier, hasEcheancier, hasFacturation } = procedureData;

        // Mettre à jour le client
        let client = existingProcedure.client;
        if (client && siret && !siret.startsWith("DRAFT-")) {
          if (client.siret !== siret) {
            let newClient = await prisma.client.findUnique({ where: { siret } });
            if (!newClient) {
              newClient = await prisma.client.create({
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
              newClient = await prisma.client.update({
                where: { id: newClient.id },
                data: {
                  nomSociete: nomSociete || newClient.nomSociete,
                  adresse: adresse || newClient.adresse,
                  codePostal: codePostal || newClient.codePostal,
                  ville: ville || newClient.ville,
                  email: email || newClient.email,
                  telephone: telephone || newClient.telephone,
                },
              });
            }
            client = newClient;
          } else {
            client = await prisma.client.update({
              where: { id: client.id },
              data: {
                nom,
                prenom,
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

        // Supprimer les anciens documents
        await prisma.document.deleteMany({
          where: { procedureId: existingProcedureId },
        });

        // Mettre à jour la procédure
        const procedure = await prisma.procedure.update({
          where: { id: existingProcedureId },
          data: {
            clientId: client.id,
            contexte,
            dateFactureEchue: dateFactureEchue ? new Date(dateFactureEchue) : new Date(),
            montantDue: montantDue !== null && montantDue !== undefined ? parseFloat(montantDue) : null,
            montantTTC: montantTTC !== undefined ? Boolean(montantTTC) : true,
            dateRelance: dateRelance ? new Date(dateRelance) : null,
            dateRelance2: dateRelance2 ? new Date(dateRelance2) : null,
            paymentId: payment.id,
            paymentStatus: PaymentStatus.SUCCEEDED,
            status: ProcedureStatus.NOUVEAU,
            hasFacturation,
            hasEcheancier: hasEcheancier || false,
            echeancier: echeancier && Array.isArray(echeancier) && echeancier.length > 0
              ? echeancier.slice(0, 5)
              : null,
            documents: documents && Array.isArray(documents) && documents.length > 0
              ? {
                  create: documents.map((doc: any) => ({
                    type: doc.type as DocumentType,
                    fileName: doc.fileName || "document",
                    filePath: doc.filePath,
                    fileSize: doc.fileSize || 0,
                    mimeType: doc.mimeType || "application/octet-stream",
                    numeroFacture: doc.numeroFacture || null,
                    dateFactureEchue: doc.dateFactureEchue ? new Date(doc.dateFactureEchue) : null,
                    montantDue: doc.montantDue ? parseFloat(doc.montantDue) : null,
                    montantTTC: doc.montantTTC !== undefined ? Boolean(doc.montantTTC) : null,
                  })),
                }
              : undefined,
          },
          include: {
            client: true,
            documents: true,
          },
        });

        // Lier le paiement à la procédure
        await prisma.payment.update({
          where: { id: payment.id },
          data: { procedureId: procedure.id },
        });

        return NextResponse.json({ procedure }, { status: 200 });
    }

    // Sinon, créer une nouvelle procédure (seulement si existingProcedureId n'est pas fourni)
    const { nom, prenom, siret, nomSociete, adresse, codePostal, ville, email, telephone, contexte, dateFactureEchue, montantDue, montantTTC, dateRelance, dateRelance2, documents, echeancier, hasEcheancier, hasFacturation } = procedureData;

    // Vérifier ou créer le client
    let client = await prisma.client.findUnique({
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

    // Créer la procédure
    const procedure = await prisma.procedure.create({
      data: {
        clientId: client.id,
        userId: user.userId,
        contexte,
        dateFactureEchue: dateFactureEchue ? new Date(dateFactureEchue) : new Date(),
        montantDue: montantDue !== null && montantDue !== undefined ? parseFloat(montantDue) : null,
        montantTTC: montantTTC !== undefined ? Boolean(montantTTC) : true,
        dateRelance: dateRelance ? new Date(dateRelance) : null,
        dateRelance2: dateRelance2 ? new Date(dateRelance2) : null,
        paymentId: payment.id,
        paymentStatus: PaymentStatus.SUCCEEDED,
        status: ProcedureStatus.NOUVEAU,
        hasFacturation,
        hasEcheancier: hasEcheancier || false,
        echeancier: echeancier && Array.isArray(echeancier) && echeancier.length > 0
          ? echeancier.slice(0, 5)
          : null,
        documents: documents && Array.isArray(documents) && documents.length > 0
          ? {
              create: documents.map((doc: any) => ({
                type: doc.type as DocumentType,
                fileName: doc.fileName || "document",
                filePath: doc.filePath,
                fileSize: doc.fileSize || 0,
                mimeType: doc.mimeType || "application/octet-stream",
                numeroFacture: doc.numeroFacture || null,
                dateFactureEchue: doc.dateFactureEchue ? new Date(doc.dateFactureEchue) : null,
                montantDue: doc.montantDue ? parseFloat(doc.montantDue) : null,
                montantTTC: doc.montantTTC !== undefined ? Boolean(doc.montantTTC) : null,
              })),
            }
          : undefined,
      },
      include: {
        client: true,
        documents: true,
      },
    });

    // Lier le paiement à la procédure
    await prisma.payment.update({
      where: { id: payment.id },
      data: { procedureId: procedure.id },
    });

    return NextResponse.json({ procedure }, { status: 201 });
  } catch (error) {
    console.error("Erreur lors de la création de la procédure après paiement:", error);
    return NextResponse.json(
      { error: "Erreur lors de la création de la procédure" },
      { status: 500 }
    );
  }
}


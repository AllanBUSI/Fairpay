import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { PaymentStatus, ProcedureStatus } from "@/app/generated/prisma/enums";

const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"] || "", {
  apiVersion: "2025-11-17.clover",
});

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 });
    }

    const body = await request.json();
    const { procedureData, procedureId, isSubscribed, hasEcheancier } = body;

    // Récupérer l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    // Récupérer ou créer le client Stripe
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user.id,
        },
      });
      stripeCustomerId = customer.id;

      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId },
      });
    }

    // Calculer le montant
    let totalHT = isSubscribed ? 99 : 179;
    if (hasEcheancier && !isSubscribed) {
      totalHT += 49;
    }
    const totalTTC = totalHT * 1.20;

    // Créer ou mettre à jour la procédure si procedureData est fourni
    let finalProcedureId = procedureId;
    if (procedureData && !procedureId) {
      // Extraire les données du client
      const clientData = procedureData.client || {
        nom: procedureData.nom || "",
        prenom: procedureData.prenom || "",
        email: procedureData.email || "",
        telephone: procedureData.telephone || "",
        adresse: procedureData.adresse || "",
        codePostal: procedureData.codePostal || "",
        ville: procedureData.ville || "",
        nomSociete: procedureData.nomSociete || null,
        siret: procedureData.siret || `temp_${Date.now()}`,
      };

      if (!clientData.nom || !clientData.prenom || !clientData.siret) {
        return NextResponse.json(
          { error: "Les informations du client sont requises (nom, prenom, siret)" },
          { status: 400 }
        );
      }

      // Vérifier si le client existe déjà
      let client = await prisma.client.findUnique({
        where: { siret: clientData.siret },
      });

      if (!client) {
        client = await prisma.client.create({
          data: {
            nom: clientData.nom,
            prenom: clientData.prenom,
            email: clientData.email || "",
            telephone: clientData.telephone || "",
            adresse: clientData.adresse || "",
            codePostal: clientData.codePostal || "",
            ville: clientData.ville || "",
            nomSociete: clientData.nomSociete || null,
            siret: clientData.siret,
          },
        });
      }

      // Créer la procédure en brouillon
      const procedure = await prisma.procedure.create({
        data: {
          clientId: client.id,
          userId: user.id,
          status: ProcedureStatus.BROUILLONS,
          contexte: procedureData.contexte || "",
          dateFactureEchue: procedureData.dateFactureEchue 
            ? new Date(procedureData.dateFactureEchue) 
            : new Date(),
          montantDue: procedureData.montantDue !== null && procedureData.montantDue !== undefined 
            ? parseFloat(procedureData.montantDue.toString()) 
            : null,
          montantTTC: procedureData.montantTTC !== undefined 
            ? Boolean(procedureData.montantTTC) 
            : true,
          dateRelance: procedureData.dateRelance ? new Date(procedureData.dateRelance) : null,
          dateRelance2: procedureData.dateRelance2 ? new Date(procedureData.dateRelance2) : null,
          hasEcheancier: procedureData.hasEcheancier || false,
          echeancier: procedureData.echeancier && Array.isArray(procedureData.echeancier) && procedureData.echeancier.length > 0
            ? procedureData.echeancier.slice(0, 5)
            : undefined,
          documents: procedureData.documents && Array.isArray(procedureData.documents) && procedureData.documents.length > 0
            ? {
                create: procedureData.documents.map((doc: any) => ({
                  type: doc.type,
                  fileName: doc.fileName || "document",
                  filePath: doc.filePath,
                  fileSize: doc.fileSize || 0,
                  mimeType: doc.mimeType || "application/octet-stream",
                  numeroFacture: doc.numeroFacture || null,
                  dateFactureEchue: doc.dateFactureEchue ? new Date(doc.dateFactureEchue) : null,
                  montantDue: doc.montantDue ? parseFloat(doc.montantDue.toString()) : null,
                  montantTTC: doc.montantTTC !== undefined ? Boolean(doc.montantTTC) : null,
                })),
              }
            : undefined,
        },
      });
      finalProcedureId = procedure.id;
    }

    // Créer le PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalTTC * 100), // En centimes
      currency: "eur",
      customer: stripeCustomerId,
      description: `Mise en demeure${hasEcheancier ? " avec écheancier" : ""}`,
      metadata: {
        userId: user.id,
        procedureId: finalProcedureId || "",
        hasEcheancier: hasEcheancier ? "true" : "false",
        isSubscribed: isSubscribed ? "true" : "false",
      },
    });

    // Créer ou mettre à jour l'entrée Payment dans la base de données
    // Utiliser upsert car procedureId est unique
    if (finalProcedureId) {
      await prisma.payment.upsert({
        where: { procedureId: finalProcedureId },
        update: {
          stripePaymentIntentId: paymentIntent.id,
          amount: totalTTC,
          currency: "eur",
          status: PaymentStatus.PENDING,
          description: `Mise en demeure${hasEcheancier ? " avec écheancier" : ""}`,
          metadata: {
            paymentIntentId: paymentIntent.id,
            hasEcheancier: hasEcheancier,
            isSubscribed: isSubscribed,
          } as any,
        },
        create: {
          userId: user.id,
          procedureId: finalProcedureId,
          stripePaymentIntentId: paymentIntent.id,
          amount: totalTTC,
          currency: "eur",
          status: PaymentStatus.PENDING,
          description: `Mise en demeure${hasEcheancier ? " avec écheancier" : ""}`,
          metadata: {
            paymentIntentId: paymentIntent.id,
            hasEcheancier: hasEcheancier,
            isSubscribed: isSubscribed,
          } as any,
        },
      });
    } else {
      // Si pas de procedureId, créer un nouveau paiement sans contrainte
      await prisma.payment.create({
        data: {
          userId: user.id,
          procedureId: null,
          stripePaymentIntentId: paymentIntent.id,
          amount: totalTTC,
          currency: "eur",
          status: PaymentStatus.PENDING,
          description: `Mise en demeure${hasEcheancier ? " avec écheancier" : ""}`,
          metadata: {
            paymentIntentId: paymentIntent.id,
            hasEcheancier: hasEcheancier,
            isSubscribed: isSubscribed,
          } as any,
        },
      });
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      procedureId: finalProcedureId,
    });
  } catch (error) {
    console.error("Erreur lors de la création du paiement:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { ProcedureStatus, DocumentType } from "@/app/generated/prisma/enums";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-12-18.acacia",
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
    const {
      amount,
      currency = "eur",
      procedureData,
      hasFacturation,
      promoCode,
      procedureId,
      successUrl,
      cancelUrl,
    } = body;

    // Récupérer hasEcheancier depuis procedureData
    const hasEcheancier = procedureData?.hasEcheancier || false;

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
    }

    // Récupérer l'utilisateur
    let user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    let finalProcedureId = procedureId;

    // Si aucune procédure n'existe, créer un brouillon avec les données
    if (!finalProcedureId) {
      const { nom, prenom, siret, nomSociete, adresse, codePostal, ville, email, telephone, contexte, dateFactureEchue, montantDue, montantTTC, dateRelance, dateRelance2, documents, echeancier, hasEcheancier } = procedureData;

      // Créer ou récupérer le client
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

      // Créer la procédure en brouillon
      const procedure = await prisma.procedure.create({
        data: {
          clientId: client.id,
          userId: user.id,
          contexte,
          dateFactureEchue: dateFactureEchue ? new Date(dateFactureEchue) : new Date(),
          montantDue: montantDue !== null && montantDue !== undefined ? parseFloat(montantDue) : null,
          montantTTC: montantTTC !== undefined ? Boolean(montantTTC) : true,
          dateRelance: dateRelance ? new Date(dateRelance) : null,
          dateRelance2: dateRelance2 ? new Date(dateRelance2) : null,
          status: ProcedureStatus.BROUILLONS,
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
      });

      finalProcedureId = procedure.id;
    } else {
      // Si une procédure existe déjà, mettre à jour ses données
      const existingProcedure = await prisma.procedure.findUnique({
        where: { id: finalProcedureId },
        include: { client: true },
      });

      if (existingProcedure && existingProcedure.status === ProcedureStatus.BROUILLONS) {
        const { nom, prenom, siret, nomSociete, adresse, codePostal, ville, email, telephone, contexte, dateFactureEchue, montantDue, montantTTC, dateRelance, dateRelance2, documents, echeancier, hasEcheancier } = procedureData;

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
          where: { procedureId: finalProcedureId },
        });

        // Mettre à jour la procédure
        await prisma.procedure.update({
          where: { id: finalProcedureId },
          data: {
            clientId: client.id,
            contexte,
            dateFactureEchue: dateFactureEchue ? new Date(dateFactureEchue) : new Date(),
            montantDue: montantDue !== null && montantDue !== undefined ? parseFloat(montantDue) : null,
            montantTTC: montantTTC !== undefined ? Boolean(montantTTC) : true,
            dateRelance: dateRelance ? new Date(dateRelance) : null,
            dateRelance2: dateRelance2 ? new Date(dateRelance2) : null,
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
        });
      }
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

    // Créer une Checkout Session avec seulement l'ID de la procédure dans les métadonnées
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      mode: "payment", // Toujours utiliser le mode payment pour pouvoir mélanger abonnement et produits
      line_items: [],
      metadata: {
        userId: user.id,
        procedureId: finalProcedureId, // Seulement l'ID, pas toutes les données
        hasFacturation: hasFacturation ? "true" : "false",
      },
      success_url: successUrl ? `${successUrl}&session_id={CHECKOUT_SESSION_ID}` : `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard/new?payment=cancelled`,
    };

    // Si l'utilisateur prend l'abonnement, ajouter l'abonnement comme première ligne
    if (hasFacturation) {
      // Calculer le montant de l'abonnement (29 € HT)
      const subscriptionAmountHT = 29;
      const subscriptionAmountTTC = subscriptionAmountHT * 1.20;

      // Ajouter l'abonnement comme première ligne (paiement unique pour le premier mois)
      sessionParams.line_items.push({
        price_data: {
          currency: currency,
          product_data: {
            name: "Facturation mensuelle",
            description: "Abonnement mensuel (premier mois)",
          },
          unit_amount: Math.round(subscriptionAmountTTC * 100), // Convertir en centimes
        },
        quantity: 1,
      });

      // Calculer le montant pour la procédure (99 € HT avec abonnement)
      const procedureAmountHT = 99;
      const procedureAmountTTC = procedureAmountHT * 1.20;

      // Ajouter la procédure comme deuxième ligne
      sessionParams.line_items.push({
        price_data: {
          currency: currency,
          product_data: {
            name: "Mise en demeure",
            description: "Création de dossier avec mise en demeure",
          },
          unit_amount: Math.round(procedureAmountTTC * 100), // Convertir en centimes
        },
        quantity: 1,
      });

      // Si écheancier, il est gratuit avec l'abonnement, donc pas besoin de l'ajouter
    } else {
      // Pas d'abonnement, afficher chaque produit séparément
      // Mise en demeure : 179 € HT
      const miseEnDemeureHT = 179;
      const miseEnDemeureTTC = miseEnDemeureHT * 1.20;

      sessionParams.line_items.push({
        price_data: {
          currency: currency,
          product_data: {
            name: "Mise en demeure",
            description: "Création de dossier avec mise en demeure",
          },
          unit_amount: Math.round(miseEnDemeureTTC * 100), // Convertir en centimes
        },
        quantity: 1,
      });

      // Écheancier : 49 € HT (si activé)
      if (hasEcheancier) {
        const echeancierHT = 49;
        const echeancierTTC = echeancierHT * 1.20;

        sessionParams.line_items.push({
          price_data: {
            currency: currency,
            product_data: {
              name: "Écheancier de paiement",
              description: "Écheancier de paiement personnalisé",
            },
            unit_amount: Math.round(echeancierTTC * 100), // Convertir en centimes
          },
          quantity: 1,
        });
      }
    }

    // Ajouter le code promotionnel si fourni
    if (promoCode) {
      sessionParams.discounts = [{ coupon: promoCode }];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
      procedureId: finalProcedureId,
    });
  } catch (error) {
    console.error("Erreur lors de la création de la session de checkout:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


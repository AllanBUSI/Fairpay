import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";
import { ProcedureStatus, DocumentType } from "@/app/generated/prisma/enums";

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
    const {
      amount,
      currency = "eur",
      procedureData,
      hasFacturation,
      promoCode,
      procedureId,
      successUrl,
      cancelUrl,
      priceId,
      isSubscription,
    } = body;

    // Récupérer hasEcheancier depuis procedureData
    const hasEcheancier = procedureData?.hasEcheancier || false;

    // Si c'est un abonnement seul (sans procédure), gérer différemment
    if (isSubscription && priceId && !procedureData) {
      // Récupérer l'utilisateur
      let user = await prisma.user.findUnique({
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

      // Valider le code promotionnel si fourni
      let couponId: string | undefined;
      if (promoCode) {
        try {
          // Vérifier que le coupon existe dans Stripe
          const coupon = await stripe.coupons.retrieve(promoCode);
          if (coupon.valid) {
            couponId = promoCode;
          }
        } catch (err) {
          // Le coupon n'existe pas ou est invalide, on continue sans
          console.error("Code promotionnel invalide:", err);
        }
      }

      // Récupérer le produit associé au priceId pour obtenir/mettre à jour sa description
      try {
        const price = await stripe.prices.retrieve(priceId);
        if (price.product && typeof price.product === 'string') {
          const product = await stripe.products.retrieve(price.product);
          if (product && !product.deleted && product.description) {
            // Le produit existe et a une description, on peut l'utiliser si nécessaire
          }
        }
      } catch (err) {
        console.error("Erreur lors de la récupération du produit:", err);
      }

      // Créer une session de checkout en mode subscription avec description détaillée
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        customer: stripeCustomerId,
        payment_method_types: ["card"],
        mode: "subscription",
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        metadata: {
          userId: user.id,
          hasFacturation: "true",
          planType: "monthly",
          benefits: "Mise en demeure à 99€ HT, Écheancier gratuit, Accès prioritaire",
        },
        subscription_data: {
          description: `Abonnement mensuel FairPay - 29€ HT/mois

Avantages inclus :
• Mise en demeure à 99€ HT (au lieu de 179€ HT)
• Écheancier de paiement gratuit
• Accès prioritaire au réseau d'avocats
• Suivi personnalisé par un avocat dédié
• Conformité légale garantie`,
          metadata: {
            userId: user.id,
            plan: "monthly",
            priceHT: "29",
            benefits: JSON.stringify([
              "Mise en demeure à 99€ HT",
              "Écheancier gratuit",
              "Accès prioritaire au réseau d'avocats"
            ]),
          },
        },
        success_url: successUrl || `${process.env["NEXT_PUBLIC_APP_URL"] || "http://localhost:3000"}/dashboard/facturation?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${process.env["NEXT_PUBLIC_APP_URL"] || "http://localhost:3000"}/dashboard/onboarding?payment=cancelled`,
      };

      // Ajouter le coupon si valide
      if (couponId) {
        sessionParams.discounts = [{ coupon: couponId }];
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      return NextResponse.json({
        sessionId: session.id,
        url: session.url,
      });
    }

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
      const isParticulier = siret && siret.startsWith("PARTICULIER-");
      let client;
      
      if (isParticulier) {
        // Pour les particuliers, créer toujours un nouveau client car chaque particulier a un SIRET unique
        client = await prisma.client.create({
          data: {
            nom,
            prenom,
            siret,
            nomSociete: null, // Les particuliers n'ont pas de nom de société
            adresse: adresse || null,
            codePostal: codePostal || null,
            ville: ville || null,
            email: email || null,
            telephone: telephone || null,
          },
        });
      } else {
        // Pour les entreprises, chercher ou créer par SIRET
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
          hasEcheancier: !!hasEcheancier,
          echeancier: echeancier && Array.isArray(echeancier) && echeancier.length > 0
            ? echeancier.slice(0, 5)
            : undefined,
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
            hasEcheancier: Boolean(hasEcheancier),
            echeancier:
              echeancier && Array.isArray(echeancier) && echeancier.length > 0
                ? (echeancier.slice(0, 5) as any)
                : undefined,
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

    // Vérifier si l'utilisateur a déjà un abonnement actif
    let isUserSubscribed = false;
    if (user.stripeSubscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);
        isUserSubscribed = subscription.status === "active" || subscription.status === "trialing";
      } catch (err) {
        console.error("Erreur lors de la vérification de l'abonnement:", err);
      }
    }

    // Si l'utilisateur prend l'abonnement ET n'est pas déjà abonné, utiliser l'approche PaymentIntent + Subscription
    // Option 2 : Paiement initial (procédure) + Abonnement séparé
    // 1. Créer un PaymentIntent pour le paiement de la procédure
    // 2. Créer ensuite l'abonnement récurrent après le paiement réussi
    if (hasFacturation && !isUserSubscribed) {
      // Récupérer le priceId de l'abonnement
      const subscriptionPriceId = process.env["STRIPE_PRICE_ID_ABONNEMENT"];
      
      if (!subscriptionPriceId) {
        return NextResponse.json(
          { error: "Price ID d'abonnement non configuré" },
          { status: 500 }
        );
      }

      // Récupérer le prix depuis Stripe pour vérifier s'il est en HT ou TTC
      let subscriptionPriceHT = 29; // Prix HT par défaut
      try {
        const price = await stripe.prices.retrieve(subscriptionPriceId);
        // Le prix dans Stripe est en centimes, donc on divise par 100
        subscriptionPriceHT = (price.unit_amount || 2900) / 100;
      } catch (err) {
        console.error("Erreur lors de la récupération du prix d'abonnement:", err);
        // Utiliser le prix par défaut
      }

      // Calculer les montants en TTC
      const subscriptionPriceTTC = subscriptionPriceHT * 1.20;
      const procedureAmountHT = 99;
      const procedureAmountTTC = procedureAmountHT * 1.20;

      // Récupérer les informations de la procédure pour la description
      const procedure = await prisma.procedure.findUnique({
        where: { id: finalProcedureId },
        include: { client: true },
      });

      const procedureDescription = procedure 
        ? `Mise en demeure - ${procedure.client?.nomSociete || `${procedure.client?.prenom || ""} ${procedure.client?.nom || ""}`.trim() || "Procédure"}`
        : "Mise en demeure";

      // Calculer le montant total : procédure + premier mois d'abonnement
      // Créer une session Checkout en mode "payment" pour le paiement initial
      // Cela inclut la procédure + le premier mois d'abonnement
      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        customer: stripeCustomerId,
        payment_method_types: ["card"],
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "eur",
              product_data: {
                name: "Mise en demeure",
                description: procedureDescription,
              },
              unit_amount: Math.round(procedureAmountTTC * 100), // Prix TTC en centimes (118,80€)
            },
            quantity: 1,
          },
          {
            price_data: {
              currency: "eur",
              product_data: {
                name: "Abonnement mensuel FairPay (premier mois)",
                description: "Premier mois d'abonnement - Accès aux tarifs préférentiels et écheancier gratuit",
              },
              unit_amount: Math.round(subscriptionPriceTTC * 100), // Prix TTC en centimes (34,80€)
            },
            quantity: 1,
          },
        ],
        invoice_creation: {
          enabled: true,
        },
        metadata: {
          userId: user.id,
          procedureId: finalProcedureId,
          hasFacturation: "true",
          procedureAmountTTC: procedureAmountTTC.toString(),
          subscriptionPriceTTC: subscriptionPriceTTC.toString(),
          subscriptionPriceId: subscriptionPriceId,
          // Indiquer qu'il faut créer l'abonnement après le paiement
          createSubscriptionAfterPayment: "true",
        },
        success_url: successUrl ? `${successUrl}&session_id={CHECKOUT_SESSION_ID}` : `${process.env["NEXT_PUBLIC_APP_URL"] || "http://localhost:3000"}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${process.env["NEXT_PUBLIC_APP_URL"] || "http://localhost:3000"}/dashboard/new?payment=cancelled`,
      };
      
      const session = await stripe.checkout.sessions.create(sessionParams);

      return NextResponse.json({
        sessionId: session.id,
        url: session.url,
        procedureId: finalProcedureId,
      });
    }

    // Si pas d'abonnement ou utilisateur déjà abonné, créer une session en mode payment
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: stripeCustomerId,
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [],
      invoice_creation: {
        enabled: true,
      },
      metadata: {
        userId: user.id,
        procedureId: finalProcedureId,
        hasFacturation: hasFacturation ? "true" : "false",
      },
      success_url: successUrl ? `${successUrl}&session_id={CHECKOUT_SESSION_ID}` : `${process.env["NEXT_PUBLIC_APP_URL"] || "http://localhost:3000"}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env["NEXT_PUBLIC_APP_URL"] || "http://localhost:3000"}/dashboard/new?payment=cancelled`,
    };

    // Si l'utilisateur est déjà abonné, utiliser le prix avec abonnement
    if (isUserSubscribed) {
      // Pas d'abonnement dans cette commande
      // Mais si l'utilisateur est déjà abonné, utiliser le prix avec abonnement
      if (isUserSubscribed) {
        // Utilisateur déjà abonné : utiliser le prix avec abonnement (99 € HT)
        const procedureAmountHT = 99;
        const procedureAmountTTC = procedureAmountHT * 1.20;

        sessionParams.line_items?.push({
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

        // Écheancier gratuit avec abonnement existant
      } else {
        // Pas d'abonnement, afficher chaque produit séparément
        // Mise en demeure : 179 € HT
        const miseEnDemeureHT = 179;
        const miseEnDemeureTTC = miseEnDemeureHT * 1.20;

        sessionParams.line_items?.push({
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

          sessionParams.line_items?.push({
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



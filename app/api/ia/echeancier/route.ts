import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// Fonction pour convertir un montant en lettres
function convertirMontantEnLettres(montant: number): string {
  
  if (montant === 0) return "zéro";
  if (montant >= 1000) {
    const milliers = Math.floor(montant / 1000);
    const reste = montant % 1000;
    return `${convertirNombreEnLettres(milliers)} mille${reste > 0 ? ` ${convertirNombreEnLettres(reste)}` : ""}`;
  }
  return convertirNombreEnLettres(montant);
}

function convertirNombreEnLettres(n: number): string {
  const unite = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"];
  const dizaine = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];
  const special = ["dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
  
  if (n === 0) return "";
  if (n < 10) return unite[n] || "" ;
  if (n < 20) return special[n - 10] || "";
  if (n < 100) {
    const d = Math.floor(n / 10);
    const u = n % 10;
    if (d === 7 || d === 9) {
      return `${dizaine[d]}${u === 1 ? " et " : u > 1 ? "-" : ""}${u < 10 ? special[u] || unite[u] : ""}`;
    }
    return `${dizaine[d]}${u > 0 ? (u === 1 && d !== 8 ? " et " : "-") + unite[u] : ""}`;
  }
  if (n < 1000) {
    const c = Math.floor(n / 100);
    const reste = n % 100;
    return `${c > 1 ? unite[c] + " " : ""}cent${c > 1 && reste === 0 ? "s" : ""}${reste > 0 ? " " + convertirNombreEnLettres(reste) : ""}`;
  }
  return "";
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { procedureId } = body;

    if (!procedureId) {
      return NextResponse.json({ error: "procedureId manquant" }, { status: 400 });
    }

    const procedure = await prisma.procedure.findUnique({
      where: { id: procedureId },
      include: {
        client: {
          select: {
            id: true, nom: true, prenom: true, siret: true, nomSociete: true,
            adresse: true, codePostal: true, ville: true, email: true, telephone: true,
          },
        },
        user: {
          select: {
            id: true, nom: true, prenom: true, email: true, adresse: true,
            codePostal: true, ville: true, telephone: true, iban: true,
          },
        },
        avocat: {
          select: {
            id: true, nom: true, prenom: true, email: true, adresse: true,
            codePostal: true, ville: true, telephone: true,
          },
        },
        documents: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!procedure) {
      return NextResponse.json({ error: "Procédure introuvable" }, { status: 404 });
    }

    const client = procedure.client;
    const demandeur = procedure.user;
    const avocat = procedure.avocat;

    // Récupérer les informations de l'entreprise/cabinet de l'avocat
    let avocatCompany: {
      email: string | null;
      adresse: string | null;
      codePostal: string | null;
      ville: string | null;
      telephone: string | null;
      nomSociete: string;
      logoUrl: string | null;
    } | null = null;
    if (avocat) {
      avocatCompany = await prisma.company.findUnique({
        where: { userId: avocat.id },
        select: {
          nomSociete: true, adresse: true, codePostal: true, ville: true,
          telephone: true, email: true, logoUrl: true,
        },
      });
    }

    let creancierCompany: {
      email: string | null;
      adresse: string | null;
      codePostal: string | null;
      ville: string | null;
      telephone: string | null;
      nomSociete: string;
    } | null = null;
    if (demandeur) {
      creancierCompany = await prisma.company.findUnique({
        where: { userId: demandeur.id },
        select: {
          nomSociete: true, adresse: true, codePostal: true, ville: true,
          telephone: true, email: true,
        },
      });
    }

    // Récupérer l'écheancier
    let echeancier: Array<{ date: string; montant: number }> = [];
    if (procedure.echeancier) {
      if (typeof procedure.echeancier === 'string') {
        echeancier = JSON.parse(procedure.echeancier);
      } else if (Array.isArray(procedure.echeancier)) {
        echeancier = procedure.echeancier as Array<{ date: string; montant: number }>;
      }
    }

    if (echeancier.length === 0) {
      return NextResponse.json(
        { error: "Aucun écheancier trouvé pour cette procédure" },
        { status: 400 }
      );
    }

    // Récupérer les factures de la procédure
    const factures = procedure.documents.filter(doc => doc.type === "FACTURE");
    const premiereFacture = factures.length > 0 ? factures[0] : null;
    const numeroFacture = premiereFacture?.numeroFacture || "non renseigné";

    // Calculer le montant total
    const montantTotal = echeancier.reduce((sum, e) => sum + (e.montant || 0), 0);
    const montantTotalLettres = convertirMontantEnLettres(montantTotal);

    // Date actuelle formatée
    const dateActuelle = new Date();
    const dateFormatee = dateActuelle.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    const lieu = demandeur?.ville || avocat?.ville || "Lieu à préciser";

    // Informations du créancier - Toujours "Learni"
    const nomCreancier = "Learni";
    const qualiteCreancier = "société";
    const adresseCompleteCreancier = creancierCompany
      ? `${creancierCompany.adresse || ""}${creancierCompany.codePostal && creancierCompany.ville ? `, ${creancierCompany.codePostal} ${creancierCompany.ville}` : ""}`.trim()
      : `${demandeur?.adresse || ""}${demandeur?.codePostal && demandeur?.ville ? `, ${demandeur.codePostal} ${demandeur.ville}` : ""}`.trim();
    
    // Informations de l'avocat pour le retour
    const emailAvocat = avocatCompany?.email || avocat?.email || "";
    const adresseCompleteAvocat = avocatCompany
      ? `${avocatCompany.adresse || ""}${avocatCompany.codePostal && avocatCompany.ville ? `, ${avocatCompany.codePostal} ${avocatCompany.ville}` : ""}`.trim()
      : `${avocat?.adresse || ""}${avocat?.codePostal && avocat?.ville ? `, ${avocat.codePostal} ${avocat.ville}` : ""}`.trim();

    // Format de l'avocat
    const nomAvocat = avocat 
      ? `Me ${avocat.prenom || ""} ${(avocat.nom || "").toUpperCase()}`.trim()
      : "Me [Nom] [Prénom]";

    // Nom complet du destinataire
    const nomDestinataire = client.nomSociete || `${client.prenom} ${client.nom}`.trim();

    // Formater les échéances - s'assurer que toutes les dates sont le 5 du mois
    const echeancesFormatees = echeancier.map((e, index) => {
      const dateEcheance = new Date(e.date);
      // Forcer le jour à 5 pour toutes les échéances
      dateEcheance.setDate(5);
      const dateFormatee = dateEcheance.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
      return {
        numero: index + 1,
        date: dateFormatee,
        montant: e.montant,
        montantLettres: convertirMontantEnLettres(e.montant),
      };
    });

    // Génération du courrier d'écheancier
    const echeancierData = {
      echeancier: {
        meta: {
          date: dateFormatee,
          lieu: lieu,
        },
        avocat: {
          nom_complet: nomAvocat,
          qualite: "Avocate associée",
          email: avocatCompany?.email || avocat?.email || "",
          cabinet: avocatCompany?.nomSociete || "",
          adresse: avocatCompany?.adresse || avocat?.adresse || "",
          codePostal: avocatCompany?.codePostal || avocat?.codePostal || "",
          ville: avocatCompany?.ville || avocat?.ville || "",
          telephone: avocatCompany?.telephone || avocat?.telephone || "",
          logoUrl: avocatCompany?.logoUrl || null,
        },
        destinataire: {
          nom: client.nom,
          prenom: client.prenom,
          nom_complet: nomDestinataire,
          entreprise: client.nomSociete || null,
          siret: client.siret,
          adresse: client.adresse || "",
          codePostal: client.codePostal || null,
          ville: client.ville || null,
          email: client.email || "",
          telephone: client.telephone || "",
        },
        creancier: {
          nom: nomCreancier,
          qualite: qualiteCreancier,
          adresse: adresseCompleteCreancier,
        },
        objet: "Écheancier de paiement, par courrier recommandé avec accusé de réception",
        montant_total: {
          chiffres: montantTotal,
          lettres: montantTotalLettres,
        },
        echeances: echeancesFormatees,
        phrases: (() => {
          const phrases: string[] = [];

          phrases.push(`Par la présente, je vous adresse l'écheancier de paiement de la société Learni concernant la facture n°${numeroFacture}.`);

          phrases.push(`Il est convenu que vous vous engagez à régler la somme totale de ${montantTotal} euros, soit ${montantTotalLettres} euros, selon l'écheancier de paiement ci-dessous.`);

          phrases.push(`Vous êtes tenu de respecter scrupuleusement les dates d'échéance indiquées. Tout retard de paiement entraînera l'exigibilité immédiate de la totalité de la somme restant due, ainsi que l'application d'intérêts de retard au taux légal en vigueur.`);

          phrases.push(`Le présent écheancier est établi à titre amiable et ne préjuge pas des droits de la société Learni. En cas de non-respect d'une échéance, la société Learni se réserve le droit d'engager toute procédure judiciaire nécessaire pour recouvrer l'intégralité de sa créance.`);

          // Instructions pour le retour de l'écheancier signé
          if (emailAvocat || adresseCompleteAvocat) {
            phrases.push(`Le présent écheancier signé doit être renvoyé${emailAvocat ? ` par email à l'adresse suivante : ${emailAvocat}${adresseCompleteAvocat ? " ou" : ""}` : ""}${adresseCompleteAvocat ? ` par courrier recommandé avec accusé de réception à l'adresse suivante : ${adresseCompleteAvocat}` : ""}.`);
          }

          return phrases;
        })(),
        signature: {
          nom: creancierCompany 
            ? `${demandeur?.prenom || ""} ${demandeur?.nom || ""}`.trim() || nomCreancier
            : `${demandeur?.prenom || ""} ${demandeur?.nom || ""}`.trim() || nomCreancier,
          qualite: "Représentant légal de la société Learni",
        },
      },
    };

    return NextResponse.json(echeancierData, { status: 200 });
  } catch (error) {
    console.error("Erreur génération écheancier:", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération de l'écheancier" },
      { status: 500 }
    );
  }
}


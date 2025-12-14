import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

// Fonction pour convertir un montant en lettres (simplifié)
function convertirMontantEnLettres(montant: number): string {
  const unite = ["", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf"];
  const dizaine = ["", "", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];
  const special = ["dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf"];
  
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
  if (n < 10) return unite[n];
  if (n < 20) return special[n - 10];
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

/**
 * POST /api/ia
 * Génère une mise en demeure personnalisée à partir des données de la base de données.
 * Body attendu : { procedureId: string }
 */
export async function POST(request: NextRequest) {
  try {
    // Vérifier l'authentification
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

    // On récupère la procédure, le client, le créateur, l'avocat assigné et les documents
    const procedure = await prisma.procedure.findUnique({
      where: { id: procedureId },
      include: {
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
        user: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
            adresse: true,
            codePostal: true,
            ville: true,
            telephone: true,
            iban: true,
          },
        },
        avocat: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            email: true,
            adresse: true,
            codePostal: true,
            ville: true,
            telephone: true,
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

    // Récupération des principales correspondances
    const client = procedure.client;
    const demandeur = procedure.user;
    const avocat = procedure.avocat;
    const documents = procedure.documents;

    // Récupérer les informations de l'entreprise/cabinet de l'avocat
    let avocatCompany = null;
    if (avocat) {
      avocatCompany = await prisma.company.findUnique({
        where: { userId: avocat.id },
        select: {
          nomSociete: true,
          adresse: true,
          codePostal: true,
          ville: true,
          telephone: true,
          email: true,
          logoUrl: true,
        },
      });
    }

    // Récupérer les informations de l'entreprise du créancier (user)
    let creancierCompany = null;
    if (demandeur) {
      creancierCompany = await prisma.company.findUnique({
        where: { userId: demandeur.id },
        select: {
          nomSociete: true,
          adresse: true,
          codePostal: true,
          ville: true,
          telephone: true,
          email: true,
        },
      });
    }

    // Extraction de tous les documents factures
    const factures = documents.filter((doc: { type: string }) => doc.type === "FACTURE");
    
    // Calculer le montant total de toutes les factures (uniquement depuis les documents)
    const montantTotalFactures = factures.reduce((sum: number, facture: { montantDue?: number | null }) => {
      return sum + (facture.montantDue || 0);
    }, 0);
    
    // Utiliser uniquement le montant total des factures depuis les documents
    const montantChiffres = montantTotalFactures;
    const montantLettres = convertirMontantEnLettres(montantChiffres);
    
    // Préparer les informations des factures pour l'affichage (uniquement depuis les documents)
    const facturesInfo = factures.map((facture: { 
      numeroFacture?: string | null; 
      dateFactureEchue?: Date | string | null;
      montantDue?: number | null;
    }) => {
      const dateFacture = facture.dateFactureEchue
        ? new Date(facture.dateFactureEchue).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
        : null;
      return {
        numero: facture.numeroFacture || "non renseigné",
        date: dateFacture || "date non renseignée",
        montant: facture.montantDue || 0,
      };
    });
    
    // Pour l'objet et les mentions, utiliser uniquement les données des documents
    const premiereFacture = factures.length > 0 ? factures[0] : null;
    const numeroFacture = premiereFacture?.numeroFacture || `FACT-${procedure.id.slice(0, 8).toUpperCase()}`;
    const dateFacture = premiereFacture?.dateFactureEchue 
      ? new Date(premiereFacture.dateFactureEchue).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
      : "date à préciser";
    
    // Date actuelle formatée
    const dateActuelle = new Date();
    const dateFormatee = dateActuelle.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    const lieu = avocatCompany?.ville || avocat?.ville || "Lieu à préciser";
    
    // Nom complet du créancier
    const nomCreancier = creancierCompany?.nomSociete || `${demandeur?.prenom || ""} ${demandeur?.nom || ""}`.trim() || "Notre client";
    const qualiteCreancier = creancierCompany ? "société" : "personne physique";
    const adresseCreancier = creancierCompany?.adresse || demandeur?.adresse || "adresse à préciser";
    const adresseCompleteCreancier = creancierCompany
      ? `${creancierCompany.adresse || ""}${creancierCompany.codePostal && creancierCompany.ville ? `, ${creancierCompany.codePostal} ${creancierCompany.ville}` : ""}`.trim()
      : `${demandeur?.adresse || ""}${demandeur?.codePostal && demandeur?.ville ? `, ${demandeur.codePostal} ${demandeur.ville}` : ""}`.trim();

    // Format de l'avocat : "Me [Prénom] [NOM]"
    const nomAvocat = avocat 
      ? `Me ${avocat.prenom || ""} ${(avocat.nom || "").toUpperCase()}`.trim()
      : "Me [Nom] [Prénom]";

    // Nom complet du destinataire
    const nomDestinataire = client.nomSociete || `${client.prenom} ${client.nom}`.trim();
    const adresseCompleteDestinataire = `${client.adresse || ""}${client.codePostal && client.ville ? `, ${client.codePostal} ${client.ville}` : client.ville ? `, ${client.ville}` : ""}`.trim();

    // Génération selon le nouveau modèle
    const med = {
      mise_en_demeure: {
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
        facture: {
          numero: numeroFacture,
          date: dateFacture,
          montant: montantChiffres,
          montant_lettres: montantLettres,
        },
        creancier: {
          nom: nomCreancier,
          qualite: qualiteCreancier,
          adresse: adresseCompleteCreancier,
        },
        dateRelance: procedure.dateRelance 
          ? new Date(procedure.dateRelance).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
          : null,
        dateRelance2: procedure.dateRelance2 
          ? new Date(procedure.dateRelance2).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
          : null,
        objet: factures.length > 1 
          ? `Mise en demeure de payer les factures impayées, par courrier recommandé avec accusé de réception`
          : `Mise en demeure de payer la facture n° ${numeroFacture} du ${dateFacture}, par courrier recommandé avec accusé de réception`,
        phrases: (() => {
          const phrases: string[] = [];
          
          // Première phrase
          phrases.push(`Par la présente, je vous adresse une mise en demeure de paiement immédiat. Je représente ${nomCreancier}, en l'occurrence ${qualiteCreancier}, domiciliée à ${adresseCompleteCreancier}.`);
          
          // Phrase sur les factures
          if (factures.length === 1) {
            // Une seule facture : singulier
            phrases.push(`Il est constant et établi que vous êtes redevable envers notre mandant de la somme de ${montantChiffres} euros, soit ${montantLettres} euros, correspondant à la facture n° ${numeroFacture} émise en date du ${dateFacture}. Cette facture revêt le caractère d'un titre authentique attestant l'engagement de paiement du prestataire et constitue, à ce titre, une créance liquide et exigible.`);
          } else if (factures.length === 2) {
            // Deux factures : utiliser "et"
            const facture1 = facturesInfo[0];
            const facture2 = facturesInfo[1];
            phrases.push(`Il est constant et établi que vous êtes redevable envers notre mandant de la somme totale de ${montantChiffres} euros, soit ${montantLettres} euros, correspondant à la facture n° ${facture1.numero} du ${facture1.date} d'un montant de ${facture1.montant.toFixed(2)} euros et à la facture n° ${facture2.numero} du ${facture2.date} d'un montant de ${facture2.montant.toFixed(2)} euros. Ces factures revêtent le caractère de titres authentiques attestant l'engagement de paiement du prestataire et constituent, à ce titre, des créances liquides et exigibles.`);
          } else if (factures.length > 2) {
            // Trois factures ou plus : utiliser des virgules et "et" avant la dernière
            const facturesListe = facturesInfo.slice(0, -1).map(f => 
              `la facture n° ${f.numero} du ${f.date} d'un montant de ${f.montant.toFixed(2)} euros`
            ).join(", ");
            const derniereFacture = facturesInfo[facturesInfo.length - 1];
            phrases.push(`Il est constant et établi que vous êtes redevable envers notre mandant de la somme totale de ${montantChiffres} euros, soit ${montantLettres} euros, correspondant à ${facturesListe} et à la facture n° ${derniereFacture.numero} du ${derniereFacture.date} d'un montant de ${derniereFacture.montant.toFixed(2)} euros. Ces factures revêtent le caractère de titres authentiques attestant l'engagement de paiement du prestataire et constituent, à ce titre, des créances liquides et exigibles.`);
          } else {
            // Aucune facture
            phrases.push(`Il est constant et établi que vous êtes redevable envers notre mandant de la somme de ${montantChiffres} euros, soit ${montantLettres} euros. Cette créance revêt le caractère d'un titre authentique attestant l'engagement de paiement du prestataire et constitue, à ce titre, une créance liquide et exigible.`);
          }
          
          // Phrase sur les relances
          const dateRelance1 = procedure.dateRelance 
            ? new Date(procedure.dateRelance).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
            : null;
          const dateRelance2 = procedure.dateRelance2 
            ? new Date(procedure.dateRelance2).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
            : null;
          
          if (dateRelance1 && dateRelance2) {
            phrases.push(`Notre client a adressé à plusieurs reprises des demandes de paiement demeurées sans réponse de votre part. En date du ${dateRelance1}, une première relance amiable vous a été adressée, sans succès. En date du ${dateRelance2}, une seconde relance vous a été notifiée. Ces relances amiables n'ayant produit aucun effet, notre client se trouve contraint de faire valoir ses droits par la voie contentieuse.`);
          } else if (dateRelance1) {
            phrases.push(`Notre client a adressé à plusieurs reprises des demandes de paiement demeurées sans réponse de votre part. En date du ${dateRelance1}, une première relance amiable vous a été adressée, sans succès. Cette relance amiable n'ayant produit aucun effet, notre client se trouve contraint de faire valoir ses droits par la voie contentieuse.`);
          } else {
            phrases.push(`Notre client a adressé à plusieurs reprises des demandes de paiement demeurées sans réponse de votre part. Ces demandes n'ayant produit aucun effet, notre client se trouve contraint de faire valoir ses droits par la voie contentieuse.`);
          }
          
          // Phrase sur la mise en demeure
          phrases.push(`Vous êtes dès lors mis en demeure irrévocable de verser la somme intégrale de ${montantChiffres} euros sur le compte bancaire suivant ${demandeur?.iban || "[IBAN]"} ou par chèque à l'ordre de ${nomCreancier} dans un délai maximal de huit jours calendaires à compter de la réception de la présente lettre recommandée.`);
          
          // Phrase sur les conséquences
          phrases.push(`Passé ce délai, notre client s'autorisera à engager une action en justice sans autre avertissement préalable. Il sera alors demandé au tribunal, outre le paiement du principal, la condamnation au paiement des intérêts légaux du taux de ${(4.5 * 10).toFixed(1)}% l'an, ainsi que l'allocation d'une provision pour frais, dépens et honoraires d'avocat qui seront mis à votre charge.`);
          
          // Dernière phrase
          phrases.push(`Soyez avisé que tout retard dans le paiement amplifiera votre exposition juridique et financière. Nous vous conseillons vivement de régulariser immédiatement cette situation.`);
          
          return phrases;
        })(),
        signature: {
          nom: nomAvocat,
          qualite: "Avocate associée",
        },
      },
    };

    return NextResponse.json(med, { status: 200 });
  } catch (error) {
    console.error("Erreur génération mise en demeure IA:", error);
    return NextResponse.json(
      { error: "Erreur lors de la génération de la mise en demeure IA" },
      { status: 500 }
    );
  }
}

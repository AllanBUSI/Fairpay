import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProcedureStatus } from "@/app/generated/prisma/enums";

/**
 * Cron job pour vérifier les recommandés envoyés il y a 10 jours (email)
 * et passer le statut à INJONCTION_DE_PAIEMENT après 17 jours
 * 
 * Ce cron doit être appelé quotidiennement (ex: via Vercel Cron)
 */
export async function GET(request: NextRequest) {
  try {
    // Vérifier la clé secrète pour sécuriser le cron
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env["CRON_SECRET"]}`) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 401 }
      );
    }

    
    // 1. Envoyer l'email de suivi après 10 jours
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    tenDaysAgo.setHours(0, 0, 0, 0); // Début de la journée

    const tenDaysAgoEnd = new Date(tenDaysAgo);
    tenDaysAgoEnd.setHours(23, 59, 59, 999); // Fin de la journée

    // Récupérer les procédures avec dateEnvoiLRAR il y a 10 jours
    // et qui n'ont pas encore reçu le suivi
    const allProcedures = await prisma.procedure.findMany({
      where: {
        dateEnvoiLRAR: {
          gte: tenDaysAgo,
          lte: tenDaysAgoEnd,
        },
        status: ProcedureStatus.ENVOYE,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            prenom: true,
            nom: true,
          },
        },
        client: {
          select: {
            nom: true,
            prenom: true,
            nomSociete: true,
          },
        },
      },
    });

    // Filtrer les procédures qui n'ont pas encore reçu le suivi
    const procedures = allProcedures.filter(
      (p) => !p.commentaireLRAR || !p.commentaireLRAR.includes("[Suivi automatique envoyé le")
    );

    let emailsSent = 0;
    const errors: string[] = [];

    for (const procedure of procedures) {
      try {
        if (!procedure.user?.email) {
          errors.push(`Procédure ${procedure.id}: pas d'email utilisateur`);
          continue;
        }

        const emailSubject = `Suivi de votre recouvrement - Étape suivante recommandée`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0F172A;">Suivi de votre recouvrement</h2>
            <p>Bonjour ${procedure.user.prenom || ''} ${procedure.user.nom || ''},</p>
            <p>Il y a maintenant 10 jours que votre recommandé a été envoyé pour le dossier concernant <strong>${procedure.client.nomSociete || `${procedure.client.prenom} ${procedure.client.nom}`}</strong>.</p>
            
            <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #0F172A; margin-top: 0;">Prochaine étape recommandée</h3>
              <p>Si vous n'avez pas encore reçu de réponse du débiteur, nous vous recommandons de procéder à une <strong>demande auprès du tribunal de commerce</strong> avec :</p>
              <ul style="line-height: 1.8;">
                <li><strong>Injonction de payer</strong> : procédure simplifiée pour obtenir rapidement un titre exécutoire</li>
                <li><strong>Article 700</strong> : demande de remboursement intégral des frais d'avocat</li>
              </ul>
            </div>

            <p><strong>Avantages de cette démarche :</strong></p>
            <ul style="line-height: 1.8;">
              <li>Obtention d'un titre exécutoire rapidement</li>
              <li>Récupération des frais d'avocat via l'article 700</li>
              <li>Pression supplémentaire sur le débiteur</li>
            </ul>

            <p>Votre avocat peut vous accompagner dans cette démarche. N'hésitez pas à le contacter via votre espace FairPay.</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
              <p style="margin: 0;">
                <a href="${process.env["NEXT_PUBLIC_APP_URL"] || "http://localhost:3000"}/dashboard/${procedure.id}" 
                   style="background-color: #0F172A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Consulter mon dossier
                </a>
              </p>
            </div>

            <p style="margin-top: 30px; color: #6b7280; font-size: 12px;">
              Cet email a été envoyé automatiquement par FairPay.
            </p>
          </div>
        `;

        // Envoyer l'email
        const emailResponse = await fetch(
          `${process.env["NEXT_PUBLIC_APP_URL"] || "http://localhost:3000"}/api/send-email`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: procedure.user.email,
              subject: emailSubject,
              html: emailHtml,
            }),
          }
        );

        if (!emailResponse.ok) {
          errors.push(`Procédure ${procedure.id}: erreur envoi email`);
          continue;
        }

        // Marquer que le suivi a été envoyé (on pourrait ajouter un champ `followupSentAt`)
        // Pour l'instant, on met à jour le commentaireLRAR pour indiquer le suivi
        await prisma.procedure.update({
          where: { id: procedure.id },
          data: {
            commentaireLRAR: (procedure.commentaireLRAR || "") + `\n\n[Suivi automatique envoyé le ${new Date().toLocaleDateString("fr-FR")}]`,
          },
        });

        emailsSent++;
      } catch (error) {
        console.error(`Erreur pour la procédure ${procedure.id}:`, error);
        errors.push(`Procédure ${procedure.id}: ${error instanceof Error ? error.message : "Erreur inconnue"}`);
      }
    }

    // 2. Passer le statut à INJONCTION_DE_PAIEMENT après 17 jours
    // On vérifie les dossiers envoyés depuis au moins 17 jours (pas seulement exactement 17 jours)
    const seventeenDaysAgo = new Date();
    seventeenDaysAgo.setDate(seventeenDaysAgo.getDate() - 17);
    seventeenDaysAgo.setHours(0, 0, 0, 0); // Début de la journée

    // Récupérer les procédures avec dateEnvoiLRAR il y a au moins 17 jours et statut ENVOYE
    // qui ne sont pas déjà en INJONCTION_DE_PAIEMENT ou INJONCTION_DE_PAIEMENT_PAYER
    const proceduresToUpdate = await prisma.procedure.findMany({
      where: {
        dateEnvoiLRAR: {
          lte: seventeenDaysAgo, // Envoyé il y a au moins 17 jours
        },
        status: ProcedureStatus.ENVOYE,
      },
    });

    let statusUpdated = 0;
    for (const procedure of proceduresToUpdate) {
      try {
        await prisma.procedure.update({
          where: { id: procedure.id },
          data: {
            status: ProcedureStatus.INJONCTION_DE_PAIEMENT,
            updatedAt: new Date(),
          },
        });
        statusUpdated++;
        console.log(`✅ Statut mis à jour pour la procédure ${procedure.id}: ENVOYE → INJONCTION_DE_PAIEMENT`);
      } catch (error) {
        console.error(`Erreur lors de la mise à jour du statut pour la procédure ${procedure.id}:`, error);
        errors.push(`Procédure ${procedure.id}: erreur mise à jour statut`);
      }
    }

    return NextResponse.json(
      {
        message: "Cron exécuté avec succès",
        proceduresChecked: procedures.length,
        emailsSent,
        statusUpdated,
        errors: errors.length > 0 ? errors : undefined,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erreur lors de l'exécution du cron:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erreur serveur",
      },
      { status: 500 }
    );
  }
}


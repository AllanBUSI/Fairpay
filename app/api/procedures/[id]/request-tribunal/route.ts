import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole, ProcedureStatus } from "@/app/generated/prisma/enums";

/**
 * POST /api/procedures/[id]/request-tribunal
 * Permet à un utilisateur de demander une saisie du tribunal
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const procedureId = id;

    const body = await request.json();
    const { kbisFilePath, attestationFilePath } = body;

    // Vérifier l'authentification
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // Vérifier que la procédure existe
    const procedure = await prisma.procedure.findUnique({
      where: { id: procedureId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            prenom: true,
            nom: true,
          },
        },
        avocat: {
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

    if (!procedure) {
      return NextResponse.json(
        { error: "Procédure non trouvée" },
        { status: 404 }
      );
    }

    // Vérifier que c'est l'utilisateur propriétaire du dossier
    if (!user || user.role !== UserRole.USER || procedure.userId !== user.userId) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de faire cette demande" },
        { status: 403 }
      );
    }

    // Vérifier que le recommandé a été envoyé il y a au moins 10 jours
    if (!procedure.dateEnvoiLRAR) {
      return NextResponse.json(
        { error: "Le recommandé n'a pas encore été envoyé" },
        { status: 400 }
      );
    }

    const now = new Date();
    const dateEnvoi = new Date(procedure.dateEnvoiLRAR);
    const daysSinceEnvoi = Math.floor((now.getTime() - dateEnvoi.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSinceEnvoi < 10) {
      return NextResponse.json(
        { error: `Le recommandé a été envoyé il y a seulement ${daysSinceEnvoi} jour(s). Vous devez attendre 10 jours après l'envoi.` },
        { status: 400 }
      );
    }

    // Vérifier que le statut est ENVOYE ou INJONCTION_DE_PAIEMENT_PAYER (si déjà payé)
    if (procedure.status !== ProcedureStatus.ENVOYE && procedure.status !== ProcedureStatus.INJONCTION_DE_PAIEMENT_PAYER) {
      return NextResponse.json(
        { error: "Le dossier n'est pas dans le bon statut pour cette demande" },
        { status: 400 }
      );
    }

    // Vérifier que le Kbis a été fourni
    if (!kbisFilePath) {
      return NextResponse.json(
        { error: "Un Kbis de moins de 3 mois est requis" },
        { status: 400 }
      );
    }

    // Vérifier que l'attestation signée a été fournie
    if (!attestationFilePath) {
      return NextResponse.json(
        { error: "L'attestation sur l'honneur signée est requise" },
        { status: 400 }
      );
    }

    // Créer un document pour le Kbis
    // Note: fileSize et mimeType sont requis dans le schéma, on les met à 0/null par défaut
    await prisma.document.create({
      data: {
        procedureId: procedure.id,
        fileName: `KBIS-${procedure.id}-${Date.now()}.pdf`,
        filePath: kbisFilePath,
        type: "AUTRES_PREUVES",
        fileSize: 0, // Taille inconnue depuis l'URL
        mimeType: "application/pdf", // Par défaut PDF
      },
    });

    // Créer un document pour l'attestation signée
    await prisma.document.create({
      data: {
        procedureId: procedure.id,
        fileName: `ATTESTATION-SIGNEE-${procedure.id}-${Date.now()}.pdf`,
        filePath: attestationFilePath,
        type: "AUTRES_PREUVES",
        fileSize: 0, // Taille inconnue depuis l'URL
        mimeType: "application/pdf", // Par défaut PDF
      },
    });

    // Créer un commentaire pour marquer la demande
    if (procedure.user) {
      await prisma.comment.create({
        data: {
          procedureId: procedure.id,
          userId: procedure.user.id,
          content: `[DEMANDE TRIBUNAL] L'utilisateur a demandé une saisie du tribunal avec injonction de payer et article 700 pour le remboursement des frais d'avocat. Kbis et attestation sur l'honneur signée uploadés.`,
        },
      });
    }

    // Envoyer un email à l'utilisateur pour confirmer la demande
    if (procedure.user?.email) {
      try {
        const emailSubject = `Demande de saisie du tribunal enregistrée - FairPay`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0F172A;">Demande de saisie du tribunal enregistrée</h2>
            <p>Bonjour ${procedure.user.prenom || ''} ${procedure.user.nom || ''},</p>
            <p>Votre demande de <strong>saisie du tribunal</strong> pour le dossier concernant <strong>${procedure.client.nomSociete || `${procedure.client.prenom} ${procedure.client.nom}`}</strong> a bien été enregistrée.</p>
            
            <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #0F172A; margin-top: 0;">Votre demande comprend :</h3>
              <ul style="line-height: 1.8;">
                <li><strong>Injonction de payer</strong> : procédure simplifiée pour obtenir rapidement un titre exécutoire</li>
                <li><strong>Article 700</strong> : demande de remboursement intégral des frais d'avocat</li>
              </ul>
            </div>

            <p>Votre avocat va examiner votre demande et procéder aux démarches nécessaires. Vous serez informé de l'avancement de votre dossier.</p>
            
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

        await fetch(`${process.env["NEXT_PUBLIC_APP_URL"] || "http://localhost:3000"}/api/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: procedure.user.email,
            subject: emailSubject,
            html: emailHtml,
          }),
        });
      } catch (emailError) {
        console.error("Erreur lors de l'envoi de l'email:", emailError);
        // Ne pas faire échouer la requête si l'email échoue
      }
    }

    // Envoyer un email à l'avocat pour l'informer de la demande
    if (procedure.avocat?.email) {
      try {
        const emailSubject = `Demande de saisie du tribunal - Nouvelle demande client`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0F172A;">Nouvelle demande de saisie du tribunal</h2>
            <p>Bonjour ${procedure.avocat.prenom || ''} ${procedure.avocat.nom || ''},</p>
            <p>Votre client <strong>${procedure.user.prenom || ''} ${procedure.user.nom || ''}</strong> a demandé une <strong>saisie du tribunal</strong> pour le dossier concernant <strong>${procedure.client.nomSociete || `${procedure.client.prenom} ${procedure.client.nom}`}</strong>.</p>
            
            <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #0F172A; margin-top: 0;">Demande :</h3>
              <ul style="line-height: 1.8;">
                <li><strong>Injonction de payer</strong></li>
                <li><strong>Article 700</strong> pour le remboursement des frais d'avocat</li>
              </ul>
            </div>

            <p>Le recommandé a été envoyé le <strong>${new Date(procedure.dateEnvoiLRAR!).toLocaleDateString("fr-FR")}</strong> (il y a ${daysSinceEnvoi} jour(s)).</p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
              <p style="margin: 0;">
                <a href="${process.env["NEXT_PUBLIC_APP_URL"] || "http://localhost:3000"}/dashboard/${procedure.id}" 
                   style="background-color: #0F172A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Consulter le dossier
                </a>
              </p>
            </div>

            <p style="margin-top: 30px; color: #6b7280; font-size: 12px;">
              Cet email a été envoyé automatiquement par FairPay.
            </p>
          </div>
        `;

        await fetch(`${process.env["NEXT_PUBLIC_APP_URL"] || "http://localhost:3000"}/api/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: procedure.avocat.email,
            subject: emailSubject,
            html: emailHtml,
          }),
        });
      } catch (emailError) {
        console.error("Erreur lors de l'envoi de l'email à l'avocat:", emailError);
        // Ne pas faire échouer la requête si l'email échoue
      }
    }

    return NextResponse.json(
      {
        message: "Demande de saisie du tribunal enregistrée avec succès",
        procedure: {
          id: procedure.id,
          status: procedure.status,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erreur lors de la demande de saisie du tribunal:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


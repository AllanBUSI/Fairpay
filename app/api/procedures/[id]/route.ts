import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { canViewDossier, canValidateDossier } from "@/lib/permissions";
import { DossierAcceptation, UserRole, ProcedureStatus } from "@/app/generated/prisma/enums";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Vérifier l'authentification JWT
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const procedureId = id;

    // Récupérer la procédure avec toutes ses informations
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
        documents: {
          orderBy: {
            createdAt: "desc",
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
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

    // Vérifier les permissions : les USER ne peuvent voir que leurs propres dossiers
    if (user.role === UserRole.USER && procedure.userId !== user.userId) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de consulter ce dossier" },
        { status: 403 }
      );
    }

    // Vérifier les permissions générales pour les autres rôles
    if (user.role !== UserRole.USER && !canViewDossier(user.role)) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de consulter ce dossier" },
        { status: 403 }
      );
    }

    // S'assurer que la procédure a bien un client
    if (!procedure.client) {
      console.error("Procédure sans client:", procedureId);
      return NextResponse.json(
        { error: "Procédure invalide : client manquant" },
        { status: 500 }
      );
    }

    return NextResponse.json({ procedure }, { status: 200 });
  } catch (error) {
    console.error("Erreur lors de la récupération de la procédure:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    return NextResponse.json(
      { error: `Erreur lors de la récupération de la procédure: ${errorMessage}` },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/procedures/[id] - Met à jour une procédure (validation pour les avocats)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const procedureId = id;
    const body = await request.json();
    const { acceptation, status, analysed, miseEnDemeure, avocatId, echeancier, dateRelance, dateRelance2 } = body;

    // Vérifier que la procédure existe et récupérer les données nécessaires
    const existingProcedure = await prisma.procedure.findUnique({
      where: { id: procedureId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        client: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            nomSociete: true,
          },
        },
      },
    });

    if (!existingProcedure) {
      return NextResponse.json(
        { error: "Procédure non trouvée" },
        { status: 404 }
      );
    }

    // Vérifier les permissions : USER peut modifier le statut de ses propres dossiers
    // AVOCAT peut modifier uniquement les dossiers qui lui sont assignés ou les nouveaux dossiers non assignés
    if (user.role === UserRole.USER && existingProcedure.userId !== user.userId) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de modifier ce dossier" },
        { status: 403 }
      );
    }
    
    if (user.role === UserRole.AVOCAT) {
      // Un avocat ne peut modifier que les dossiers qui lui sont assignés ou les nouveaux dossiers non assignés
      if (existingProcedure.avocatId !== null && existingProcedure.avocatId !== user.userId) {
        return NextResponse.json(
          { error: "Ce dossier est assigné à un autre avocat" },
          { status: 403 }
        );
      }
    }

    // Construire les données à mettre à jour
    const updateData: any = {};

    // Si on met à jour l'acceptation (seulement pour les avocats)
    if (acceptation !== undefined) {
      if (!canValidateDossier(user.role)) {
        return NextResponse.json(
          { error: "Vous n'avez pas la permission de valider ce dossier" },
          { status: 403 }
        );
      }

      const validAcceptations: DossierAcceptation[] = [
        DossierAcceptation.PAS_ENCORE_CHOISI,
        DossierAcceptation.ACCEPTE,
        DossierAcceptation.REFUSE,
      ];

      if (!validAcceptations.includes(acceptation as DossierAcceptation)) {
        return NextResponse.json(
          { error: "Valeur d'acceptation invalide" },
          { status: 400 }
        );
      }

      updateData.acceptation = acceptation as DossierAcceptation;
    }

    // Si on met à jour le statut
    if (status !== undefined) {
      const validStatuses = ["NOUVEAU", "EN_COURS", "RESOLU", "ANNULE", "EN_ATTENTE_REPONSE", "EN_ATTENTE_RETOUR", "LRAR", "LRAR_ECHEANCIER", "LRAR_FINI", "ENVOYE", "INJONCTION_DE_PAIEMENT", "INJONCTION_DE_PAIEMENT_PAYER", "INJONCTION_DE_PAIEMENT_FINI"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: "Statut invalide" },
          { status: 400 }
        );
      }
      
      // Vérifier les permissions : USER ne peut mettre que RESOLU
      if (user.role === UserRole.USER && status !== "RESOLU") {
        return NextResponse.json(
          { error: "Vous ne pouvez que mettre le dossier en résolu" },
          { status: 403 }
        );
      }
      
      updateData.status = status;
    }

    // Si on met à jour l'analyse (seulement pour les avocats)
    if (analysed !== undefined) {
      if (user.role !== UserRole.AVOCAT) {
        return NextResponse.json(
          { error: "Seuls les avocats peuvent marquer un dossier comme analysé" },
          { status: 403 }
        );
      }
      updateData.analysed = analysed;
    }

    // Si on met à jour la mise en demeure (seulement pour les avocats)
    let shouldNotifyMiseEnDemeure = false;
    if (miseEnDemeure !== undefined) {
      if (user.role !== UserRole.AVOCAT) {
        return NextResponse.json(
          { error: "Seuls les avocats peuvent écrire la mise en demeure" },
          { status: 403 }
        );
      }
      // Notifier si la mise en demeure est enregistrée (elle n'existait pas avant ou elle change)
      if (!existingProcedure.miseEnDemeure || existingProcedure.miseEnDemeure !== miseEnDemeure) {
        shouldNotifyMiseEnDemeure = true;
      }
      updateData.miseEnDemeure = miseEnDemeure;
    }

    // Si on assigne le dossier à un avocat (prendre le dossier)
    let shouldNotifyAcceptance = false;
    if (avocatId !== undefined) {
      if (user.role !== UserRole.AVOCAT) {
        return NextResponse.json(
          { error: "Seuls les avocats peuvent prendre un dossier" },
          { status: 403 }
        );
      }
      // Vérifier que le dossier n'est pas déjà assigné à un autre avocat
      if (existingProcedure.avocatId !== null && existingProcedure.avocatId !== user.userId) {
        return NextResponse.json(
          { error: "Ce dossier est déjà assigné à un autre avocat" },
          { status: 403 }
        );
      }
      // Notifier si l'avocat accepte le dossier (il n'était pas assigné avant)
      if (existingProcedure.avocatId === null && avocatId === user.userId) {
        shouldNotifyAcceptance = true;
      }
      updateData.avocatId = avocatId === user.userId ? user.userId : null;
    }

    // Si on met à jour les dates de relance
    if (dateRelance !== undefined) {
      updateData.dateRelance = dateRelance ? new Date(dateRelance) : null;
    }

    if (dateRelance2 !== undefined) {
      updateData.dateRelance2 = dateRelance2 ? new Date(dateRelance2) : null;
    }

    // Si on met à jour l'écheancier (seulement pour les avocats)
    let shouldNotifyEcheancier = false;
    if (echeancier !== undefined) {
      if (user.role !== UserRole.AVOCAT) {
        return NextResponse.json(
          { error: "Seuls les avocats peuvent créer un écheancier" },
          { status: 403 }
        );
      }
      // Notifier si l'écheancier est créé ou modifié
      const existingEcheancier = existingProcedure?.echeancier;
      const newEcheancier = Array.isArray(echeancier) ? echeancier : (echeancier ? JSON.parse(JSON.stringify(echeancier)) : null);
      
      if (!existingEcheancier && newEcheancier && Array.isArray(newEcheancier) && newEcheancier.length > 0) {
        // Écheancier créé
        shouldNotifyEcheancier = true;
      } else if (existingEcheancier && newEcheancier && Array.isArray(newEcheancier) && newEcheancier.length > 0) {
        // Écheancier modifié (comparaison simple)
        const existingStr = JSON.stringify(existingEcheancier);
        const newStr = JSON.stringify(newEcheancier);
        if (existingStr !== newStr) {
          shouldNotifyEcheancier = true;
        }
      }
      
      updateData.echeancier = newEcheancier && Array.isArray(newEcheancier) && newEcheancier.length > 0
        ? newEcheancier.slice(0, 5) // Limiter à 5 échéances
        : null;
    }

    // Récupérer les informations de l'utilisateur et de l'avocat avant la mise à jour pour l'email
    const procedureBeforeUpdate = await prisma.procedure.findUnique({
      where: { id: procedureId },
      select: {
        status: true,
        userId: true,
        avocatId: true,
        miseEnDemeure: true,
        echeancier: true,
        montantDue: true,
        user: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
        client: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            nomSociete: true,
          },
        },
        avocat: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // Mettre à jour la procédure
    const procedure = await prisma.procedure.update({
      where: { id: procedureId },
      data: updateData,
      include: {
        client: {
          select: {
            id: true,
            nom: true,
            prenom: true,
            siret: true,
            nomSociete: true,
            email: true,
            telephone: true,
          },
        },
        documents: {
          orderBy: {
            createdAt: "desc",
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                role: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    // Envoyer des emails de notification à l'utilisateur
    if (procedureBeforeUpdate && procedureBeforeUpdate.user.email) {
      // 1. Email quand l'avocat accepte le dossier
      if (shouldNotifyAcceptance) {
        try {
          const emailSubject = `Votre dossier a été accepté par un avocat - FairPay`;
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #0F172A;">Votre dossier a été accepté</h2>
              <p>Bonjour,</p>
              <p>Nous avons le plaisir de vous informer qu'un avocat a accepté de prendre en charge votre dossier.</p>
              <p>Votre dossier est maintenant en cours de traitement. Vous serez tenu informé de l'avancement régulièrement.</p>
              <p>Vous pouvez consulter les détails de votre dossier directement depuis votre espace FairPay.</p>
              <p style="margin-top: 30px; color: #6b7280; font-size: 12px;">
                Cet email a été envoyé automatiquement par FairPay.
              </p>
            </div>
          `;

          fetch(`${process.env["NEXT_PUBLIC_APP_URL"] || "http://localhost:3000"}/api/send-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: procedureBeforeUpdate.user.email,
              subject: emailSubject,
              html: emailHtml,
            }),
          }).catch((err) => {
            console.error("Erreur lors de l'envoi de l'email d'acceptation:", err);
          });
        } catch (emailError) {
          console.error("Erreur lors de l'envoi de l'email d'acceptation:", emailError);
        }
      }

      // 2. Email quand l'avocat enregistre la mise en demeure
      if (shouldNotifyMiseEnDemeure) {
        try {
          const emailSubject = `Mise en demeure enregistrée - FairPay`;
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #0F172A;">Mise en demeure enregistrée</h2>
              <p>Bonjour,</p>
              <p>Votre avocat a enregistré la mise en demeure pour votre dossier.</p>
              <p>La mise en demeure est maintenant disponible dans votre espace FairPay. Vous pouvez la consulter et la télécharger à tout moment.</p>
              <p>Vous pouvez consulter les détails de votre dossier directement depuis votre espace FairPay.</p>
              <p style="margin-top: 30px; color: #6b7280; font-size: 12px;">
                Cet email a été envoyé automatiquement par FairPay.
              </p>
            </div>
          `;

          fetch(`${process.env["NEXT_PUBLIC_APP_URL"] || "http://localhost:3000"}/api/send-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: procedureBeforeUpdate.user.email,
              subject: emailSubject,
              html: emailHtml,
            }),
          }).catch((err) => {
            console.error("Erreur lors de l'envoi de l'email de mise en demeure:", err);
          });
        } catch (emailError) {
          console.error("Erreur lors de l'envoi de l'email de mise en demeure:", emailError);
        }
      }

      // 3. Email quand l'écheancier est créé
      if (shouldNotifyEcheancier) {
        try {
          const emailSubject = `Écheancier de paiement créé - FairPay`;
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #0F172A;">Écheancier de paiement créé</h2>
              <p>Bonjour,</p>
              <p>Votre avocat a créé un écheancier de paiement pour votre dossier.</p>
              <p>L'écheancier est maintenant disponible dans votre espace FairPay. Vous pouvez le consulter et le télécharger à tout moment.</p>
              <p>Vous pouvez consulter les détails de votre dossier directement depuis votre espace FairPay.</p>
              <p style="margin-top: 30px; color: #6b7280; font-size: 12px;">
                Cet email a été envoyé automatiquement par FairPay.
              </p>
            </div>
          `;

          fetch(`${process.env["NEXT_PUBLIC_APP_URL"] || "http://localhost:3000"}/api/send-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: procedureBeforeUpdate.user.email,
              subject: emailSubject,
              html: emailHtml,
            }),
          }).catch((err) => {
            console.error("Erreur lors de l'envoi de l'email d'écheancier:", err);
          });
        } catch (emailError) {
          console.error("Erreur lors de l'envoi de l'email d'écheancier:", emailError);
        }
      }

      // 4. Email spécifique pour INJONCTION_DE_PAIEMENT_FINI
      if (status === "INJONCTION_DE_PAIEMENT_FINI" && procedureBeforeUpdate?.user?.email) {
        try {
          const clientName = procedureBeforeUpdate.client?.nomSociete || 
            `${procedureBeforeUpdate.client?.prenom || ""} ${procedureBeforeUpdate.client?.nom || ""}`.trim() || 
            "Client";
          
          const emailSubject = `Votre injonction de payer a été envoyée au tribunal - FairPay`;
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background-color: #0F172A; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
                <h1 style="margin: 0; font-size: 24px;">FairPay</h1>
              </div>
              <div style="background-color: #ffffff; padding: 30px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 8px 8px;">
                <h2 style="color: #0F172A; margin-top: 0;">Votre injonction de payer a été envoyée au tribunal</h2>
                <p style="color: #374151; line-height: 1.6;">Bonjour,</p>
                <p style="color: #374151; line-height: 1.6;">
                  Nous avons le plaisir de vous informer que votre injonction de payer pour le dossier concernant <strong>${clientName}</strong> a été envoyée au tribunal.
                </p>
                <div style="background-color: #F3F4F6; padding: 15px; border-radius: 6px; margin: 20px 0;">
                  <p style="margin: 0; color: #374151; font-size: 14px;">
                    <strong>Dossier ID :</strong> ${procedureId.slice(0, 8)}...
                  </p>
                  ${procedureBeforeUpdate.montantDue ? `
                    <p style="margin: 5px 0 0 0; color: #374151; font-size: 14px;">
                      <strong>Montant dû :</strong> ${procedureBeforeUpdate.montantDue.toFixed(2)} €
                    </p>
                  ` : ""}
                </div>
                <p style="color: #374151; line-height: 1.6;">
                  Votre dossier est maintenant en cours de traitement par le tribunal. Vous serez informé(e) de toute évolution concernant cette procédure.
                </p>
                <p style="color: #374151; line-height: 1.6;">
                  Vous pouvez consulter les détails de votre dossier directement depuis votre espace FairPay.
                </p>
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
                  <p style="margin: 0; color: #6b7280; font-size: 12px; line-height: 1.5;">
                    Cet email a été envoyé automatiquement par FairPay.<br>
                    Si vous avez des questions, n'hésitez pas à nous contacter.
                  </p>
                </div>
              </div>
            </div>
          `;

          await fetch(`${process.env["NEXT_PUBLIC_APP_URL"] || "http://localhost:3000"}/api/send-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              to: procedureBeforeUpdate.user.email,
              subject: emailSubject,
              html: emailHtml,
            }),
          }).catch((err) => {
            console.error("Erreur lors de l'envoi de l'email d'injonction:", err);
          });
        } catch (emailError) {
          console.error("Erreur lors de l'envoi de l'email d'injonction:", emailError);
        }
      }
      // 5. Email si l'avocat change le statut (autres statuts)
      else if (status !== undefined && user.role === UserRole.AVOCAT && status !== "INJONCTION_DE_PAIEMENT_FINI") {
        try {
          const statusLabels: Record<string, string> = {
            NOUVEAU: "Nouveau",
            EN_COURS: "En cours",
            RESOLU: "Résolu",
            ANNULE: "Annulé",
            EN_ATTENTE_REPONSE: "En attente d'examen",
            EN_ATTENTE_RETOUR: "En attente de réponse",
            LRAR: "LRAR",
            LRAR_ECHEANCIER: "LRAR avec écheancier",
            LRAR_FINI: "LRAR terminé",
          };

          const newStatusLabel = statusLabels[status] || status;
          const oldStatusLabel = statusLabels[procedureBeforeUpdate?.status || ""] || procedureBeforeUpdate?.status || "";

          const emailSubject = `Mise à jour du statut de votre dossier - FairPay`;
          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #0F172A;">Mise à jour du statut de votre dossier</h2>
              <p>Bonjour,</p>
              <p>Votre avocat a mis à jour le statut de votre dossier.</p>
              <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Ancien statut :</strong> ${oldStatusLabel}</p>
                <p style="margin: 10px 0 0 0;"><strong>Nouveau statut :</strong> ${newStatusLabel}</p>
              </div>
              <p>Vous pouvez consulter les détails de votre dossier directement depuis votre espace FairPay.</p>
              <p style="margin-top: 30px; color: #6b7280; font-size: 12px;">
                Cet email a été envoyé automatiquement par FairPay.
              </p>
            </div>
          `;

          if (procedureBeforeUpdate?.user?.email) {
            fetch(`${process.env["NEXT_PUBLIC_APP_URL"] || "http://localhost:3000"}/api/send-email`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                to: procedureBeforeUpdate.user.email,
                subject: emailSubject,
                html: emailHtml,
              }),
            }).catch((err) => {
              console.error("Erreur lors de l'envoi de l'email de notification:", err);
            });
          }
        } catch (emailError) {
          console.error("Erreur lors de l'envoi de l'email:", emailError);
        }
      }
    }

    return NextResponse.json({ procedure }, { status: 200 });
  } catch (error) {
    console.error("Erreur lors de la mise à jour de la procédure:", error);
    return NextResponse.json(
      { error: "Erreur lors de la mise à jour de la procédure" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/procedures/[id] - Supprime un brouillon
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    if (!user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const procedureId = id;

    // Vérifier que la procédure existe
    const existingProcedure = await prisma.procedure.findUnique({
      where: { id: procedureId },
      select: { 
        userId: true, 
        status: true,
        documents: {
          select: { id: true }
        }
      },
    });

    if (!existingProcedure) {
      return NextResponse.json(
        { error: "Procédure non trouvée" },
        { status: 404 }
      );
    }

    // Vérifier que c'est un brouillon
    if (existingProcedure.status !== ProcedureStatus.BROUILLONS) {
      return NextResponse.json(
        { error: "Seuls les brouillons peuvent être supprimés" },
        { status: 400 }
      );
    }

    // Vérifier les permissions : USER ne peut supprimer que ses propres brouillons
    if (user.role === UserRole.USER && existingProcedure.userId !== user.userId) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission de supprimer ce brouillon" },
        { status: 403 }
      );
    }

    // Supprimer les documents associés
    if (existingProcedure.documents && existingProcedure.documents.length > 0) {
      await prisma.document.deleteMany({
        where: { procedureId },
      });
    }

    // Supprimer la procédure
    await prisma.procedure.delete({
      where: { id: procedureId },
    });

    return NextResponse.json({ message: "Brouillon supprimé avec succès" }, { status: 200 });
  } catch (error) {
    console.error("Erreur lors de la suppression du brouillon:", error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression du brouillon" },
      { status: 500 }
    );
  }
}

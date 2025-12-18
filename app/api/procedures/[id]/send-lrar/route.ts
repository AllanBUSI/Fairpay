import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UserRole, ProcedureStatus } from "@/app/generated/prisma/enums";

export async function POST(
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
    const { penalites, commentaireLRAR } = body;

    // Vérifier que la procédure existe
    const procedure = await prisma.procedure.findUnique({
      where: { id: procedureId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
        avocat: {
          select: {
            id: true,
            email: true,
          },
        },
        client: {
          select: {
            id: true,
            email: true,
            nom: true,
            prenom: true,
            nomSociete: true,
          },
        },
        documents: {
          select: {
            id: true,
            fileName: true,
            type: true,
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

    // Vérifier que c'est un avocat et que le dossier lui appartient
    if (user.role !== UserRole.AVOCAT || procedure.avocatId !== user.userId) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission d'envoyer ce recommandé" },
        { status: 403 }
      );
    }

    // Vérifier qu'un document fusionné existe
    const hasMergedDocument = procedure.documents?.some(doc => 
      doc.fileName.toLowerCase().includes("fusionné") || 
      doc.fileName.toLowerCase().includes("merged") ||
      doc.fileName.toLowerCase().startsWith("merged-") ||
      (doc.type === "AUTRES_PREUVES" && doc.fileName.toLowerCase().includes("document fusionné"))
    );

    if (!hasMergedDocument) {
      return NextResponse.json(
        { error: "Aucun document fusionné trouvé. Le document doit être fusionné avant d'être envoyé." },
        { status: 400 }
      );
    }

    // Vérifier que le recommandé n'a pas déjà été envoyé
    if (procedure.dateEnvoiLRAR) {
      return NextResponse.json(
        { error: "Le recommandé a déjà été envoyé" },
        { status: 400 }
      );
    }

    // Mettre à jour la procédure
    const updatedProcedure = await prisma.procedure.update({
      where: { id: procedureId },
      data: {
        penalites: penalites ? parseFloat(penalites) : 0,
        commentaireLRAR: commentaireLRAR || null,
        dateEnvoiLRAR: new Date(),
        status: ProcedureStatus.ENVOYE,
      },
    });

    // Envoyer un email à l'utilisateur (créateur du dossier)
    if (procedure.user?.email) {
      try {
        const emailSubject = `Votre recommandé a été envoyé - FairPay`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0F172A;">Votre recommandé a été envoyé</h2>
            <p>Bonjour,</p>
            <p>Nous avons le plaisir de vous informer que votre recommandé a été envoyé pour le dossier <strong>${procedureId.slice(0, 8)}</strong>.</p>
            ${penalites ? `<p><strong>Pénalités dues :</strong> ${penalites} €</p>` : ""}
            ${commentaireLRAR ? `<p><strong>Commentaire de l'avocat :</strong> ${commentaireLRAR}</p>` : ""}
            <p>Vous pouvez consulter les détails de votre dossier directement depuis votre espace FairPay.</p>
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
        console.error("Erreur lors de l'envoi de l'email à l'utilisateur:", emailError);
        // Ne pas faire échouer la requête si l'email échoue
      }
    }

    // Envoyer un email au client mauvais payeur
    if (procedure.client?.email) {
      try {
        const clientName = procedure.client.nomSociete || `${procedure.client.prenom} ${procedure.client.nom}`;
        const emailSubject = `Mise en demeure - Recouvrement de créance`;
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #0F172A;">Mise en demeure</h2>
            <p>Bonjour ${clientName},</p>
            <p>Nous vous informons qu'une mise en demeure vous a été adressée par recommandé avec accusé de réception concernant le recouvrement d'une créance.</p>
            <p>Nous vous invitons à régulariser votre situation dans les plus brefs délais.</p>
            ${penalites ? `<p><strong>Pénalités de retard :</strong> ${penalites} €</p>` : ""}
            <p>Pour toute question, vous pouvez nous contacter.</p>
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
            to: procedure.client.email,
            subject: emailSubject,
            html: emailHtml,
          }),
        });
      } catch (emailError) {
        console.error("Erreur lors de l'envoi de l'email au client:", emailError);
        // Ne pas faire échouer la requête si l'email échoue
      }
    }

    return NextResponse.json(
      { 
        procedure: updatedProcedure,
        message: "Recommandé envoyé avec succès" 
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Erreur lors de l'envoi du recommandé:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


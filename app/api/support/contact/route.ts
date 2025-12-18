import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend"; // Import nommé depuis resend

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
    const { email, subject, message } = body;

    if (!email || !subject || !message) {
      return NextResponse.json(
        { error: "Tous les champs sont requis" },
        { status: 400 }
      );
    }

    // Récupérer les informations de l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Utilisateur non trouvé" },
        { status: 404 }
      );
    }

    // Email de support (à configurer dans les variables d'environnement)
    const supportEmail = process.env["SUPPORT_EMAIL"] || "support@fairpay.fr";

    // Vérifier si RESEND_API_KEY est configuré
    const RESEND_API_KEY = process.env["RESEND_API_KEY"];
    
    if (!RESEND_API_KEY) {
      console.log("Email de support (RESEND_API_KEY non configuré):", {
        from: email,
        to: supportEmail,
        subject,
        message: message.substring(0, 200) + "...",
      });
      
      return NextResponse.json({
        success: true,
        message: "Votre message a été enregistré. Nous vous répondrons bientôt.",
      });
    }

    // Envoyer l'email au support
    const emailSubject = `[Support] ${subject}`;
    const emailBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0F172A;">Nouvelle demande de support</h2>
        
        <div style="background-color: #F9FAFB; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>De:</strong> ${user.prenom || ""} ${user.nom || ""} (${email})</p>
          <p><strong>Email utilisateur:</strong> ${user.email}</p>
          <p><strong>ID utilisateur:</strong> ${user.id}</p>
          <p><strong>Sujet:</strong> ${subject}</p>
        </div>
        
        <div style="background-color: #FFFFFF; padding: 20px; border: 1px solid #E5E7EB; border-radius: 8px;">
          <h3 style="color: #0F172A; margin-top: 0;">Message:</h3>
          <p style="white-space: pre-wrap; color: #374151;">${message}</p>
        </div>
        
        <p style="color: #6B7280; font-size: 12px; margin-top: 20px;">
          Ce message a été envoyé depuis le formulaire de contact de FairPay.
        </p>
      </div>
    `;

    try {
      const resend = new Resend(RESEND_API_KEY);
      
      const { error } = await resend.emails.send({
        from: process.env["EMAIL_FROM"] || "FairPay Support <noreply@fairpay.fr>",
        to: supportEmail,
        replyTo: email,
        subject: emailSubject,
        html: emailBody,
      });

      if (error) {
        console.error("Erreur Resend:", error);
        throw new Error("Erreur lors de l'envoi de l'email via Resend");
      }

      console.log(`✅ Email de support envoyé pour l'utilisateur ${user.id}`);

      return NextResponse.json({
        success: true,
        message: "Votre message a été envoyé avec succès",
      });
    } catch (emailError) {
      console.error("Erreur lors de l'envoi de l'email:", emailError);
      return NextResponse.json(
        { error: "Erreur lors de l'envoi de l'email" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Erreur lors de l'envoi du message de support:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


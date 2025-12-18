import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, subject, html, text }: EmailData = body;

    if (!to || !subject || !html) {
      return NextResponse.json(
        { error: "Les champs 'to', 'subject' et 'html' sont requis" },
        { status: 400 }
      );
    }

    // Utiliser Resend si disponible
    const RESEND_API_KEY = process.env["RESEND_API_KEY"];
    
    if (RESEND_API_KEY) {
      try {
        const resend = new Resend(RESEND_API_KEY);
        
        const { data, error } = await resend.emails.send({
          from: process.env["EMAIL_FROM"] || "FairPay <noreply@fairpay.fr>",
          to: [to],
          subject,
          html,
          text: text || html.replace(/<[^>]*>/g, ""), // Extraire le texte du HTML si text n'est pas fourni
        });

        if (error) {
          console.error("Erreur Resend:", error);
          throw new Error("Erreur lors de l'envoi de l'email via Resend");
        }

        return NextResponse.json({ success: true, id: data?.id }, { status: 200 });
      } catch (resendError) {
        console.error("Erreur Resend:", resendError);
        throw resendError;
      }
    } else {
      // Fallback : logger l'email si Resend n'est pas configuré
      console.log("Email à envoyer (RESEND_API_KEY non configuré):", {
        to,
        subject,
        html: html.substring(0, 200) + "...", // Limiter la taille du log
      });
      
      // En production, vous devriez configurer RESEND_API_KEY dans vos variables d'environnement
      return NextResponse.json(
        { 
          success: true, 
          message: "Email loggé (RESEND_API_KEY non configuré)",
          email: { to, subject }
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'email:", error);
    return NextResponse.json(
      { error: "Erreur lors de l'envoi de l'email" },
      { status: 500 }
    );
  }
}


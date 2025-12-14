import { Resend } from "resend";

/**
 * Envoie un email avec un code de vérification à 6 chiffres
 */
export async function sendVerificationCode(email: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not configured. " +
      "Please add it to your .env file: RESEND_API_KEY=re_your_api_key"
    );
  }

  const resend = new Resend(apiKey);

  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
    to: email,
    subject: "Votre code de vérification",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Code de vérification</h2>
        <p>Bonjour,</p>
        <p>Votre code de vérification est :</p>
        <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0;">
          <h1 style="color: #0070f3; font-size: 32px; letter-spacing: 5px; margin: 0;">${code}</h1>
        </div>
        <p>Ce code est valide pendant 10 minutes.</p>
        <p>Si vous n'avez pas demandé ce code, vous pouvez ignorer cet email.</p>
      </div>
    `,
  });
}


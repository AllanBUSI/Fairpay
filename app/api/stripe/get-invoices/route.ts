import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-11-17.clover",
});

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 });
    }

    // Récupérer l'utilisateur
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });
    }

    if (!user.stripeCustomerId) {
      return NextResponse.json({ invoices: [] });
    }

    // Récupérer les factures Stripe pour ce client (tous les statuts)
    const invoices = await stripe.invoices.list({
      customer: user.stripeCustomerId,
      limit: 100,
      expand: ["data.subscription"],
    });

    console.log(`📄 Récupération des factures pour le client ${user.stripeCustomerId}: ${invoices.data.length} facture(s) trouvée(s)`);
    
    // Log des détails de chaque facture pour déboguer
    invoices.data.forEach((inv, index) => {
      console.log(`  Facture ${index + 1}: ID=${inv.id}, Status=${inv.status}, Amount=${inv.amount_paid || inv.total}, Number=${inv.number}`);
    });

    // Formater les factures pour l'affichage
    const formattedInvoices = invoices.data.map((invoice) => {
      const description = invoice.description || 
                         invoice.lines.data[0]?.description || 
                         (invoice.lines.data.length > 0 ? invoice.lines.data.map((line: any) => line.description).join(", ") : "Facture");
      
      // Calculer le montant : utiliser amount_paid si disponible, sinon total, sinon subtotal
      let amount = 0;
      if (invoice.amount_paid > 0) {
        amount = invoice.amount_paid / 100;
      } else if (invoice.total > 0) {
        amount = invoice.total / 100;
      } else if (invoice.subtotal > 0) {
        amount = invoice.subtotal / 100;
      }

      return {
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        amount: amount,
        currency: invoice.currency.toUpperCase(),
        created: new Date(invoice.created * 1000).toISOString(),
        dueDate: invoice.due_date ? new Date(invoice.due_date * 1000).toISOString() : null,
        hostedInvoiceUrl: invoice.hosted_invoice_url,
        invoicePdf: invoice.invoice_pdf,
        description: description,
        subscriptionId: (invoice as any).subscription
          ? (typeof (invoice as any).subscription === 'string'
              ? (invoice as any).subscription
              : (invoice as any).subscription.id)
          : null,
        periodStart: invoice.period_start ? new Date(invoice.period_start * 1000).toISOString() : null,
        periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000).toISOString() : null,
      };
    });

    console.log(`✅ Factures formatées: ${formattedInvoices.length} facture(s)`);

    return NextResponse.json({ invoices: formattedInvoices });
  } catch (error) {
    console.error("Erreur lors de la récupération des factures:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}


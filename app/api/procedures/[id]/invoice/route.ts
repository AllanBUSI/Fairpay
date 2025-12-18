import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

const stripe = new Stripe(process.env["STRIPE_SECRET_KEY"] || "", {
  apiVersion: "2025-11-17.clover",
});

export async function GET(
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

    // Récupérer la procédure avec le paiement
    const procedure = await prisma.procedure.findUnique({
      where: { id: procedureId },
      include: {
        payment: true,
        user: {
          select: {
            stripeCustomerId: true,
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

    // Vérifier que l'utilisateur est propriétaire de la procédure
    if (procedure.userId !== user.userId) {
      return NextResponse.json(
        { error: "Vous n'avez pas la permission" },
        { status: 403 }
      );
    }

    // Vérifier qu'il y a un paiement réussi
    if (!procedure.payment || procedure.payment.status !== "SUCCEEDED") {
      return NextResponse.json(
        { error: "Aucun paiement réussi pour cette procédure" },
        { status: 400 }
      );
    }

    if (!procedure.user?.stripeCustomerId) {
      return NextResponse.json(
        { error: "Client Stripe non trouvé" },
        { status: 404 }
      );
    }

    // Récupérer la facture directement via les IDs du paiement (stripePaymentIntentId ou stripeChargeId)
    let invoice: Stripe.Invoice | null = null;

    try {
      const payment = procedure.payment;
      
      // 1. Utiliser directement le stripePaymentIntentId pour trouver la facture
      if (payment.stripePaymentIntentId) {
        try {
          // Récupérer le PaymentIntent pour voir s'il a une facture associée
          const paymentIntent = await stripe.paymentIntents.retrieve(payment.stripePaymentIntentId);
          // Le PaymentIntent peut avoir une invoice_id
          if (
            typeof paymentIntent === 'object' &&
            paymentIntent !== null &&
            'invoice' in paymentIntent &&
            paymentIntent.invoice
          ) {
            invoice = await stripe.invoices.retrieve(paymentIntent.invoice as string);
            console.log(`✅ Facture trouvée via PaymentIntent.invoice: ${invoice.id}`);
          } else {
            // Si pas de facture directe, lister les factures et filtrer par payment_intent
            const invoices = await stripe.invoices.list({
              customer: procedure.user.stripeCustomerId,
              limit: 100,
            });
            // TypeScript correction: 'payment_intent' is not part of Invoice type, so cast as any
            invoice = invoices.data.find(
              (inv: any) =>
                typeof inv.payment_intent === "string" &&
                inv.payment_intent === payment.stripePaymentIntentId
            ) || null;

            if (invoice) {
              console.log(`✅ Facture trouvée via filtrage manuel PaymentIntent (${payment.stripePaymentIntentId}): ${invoice.id}`);
            }
          }
        } catch (err) {
          console.error("Erreur lors de la recherche via PaymentIntent:", err);
        }
      }

      // 2. Si pas trouvée, utiliser le stripeChargeId
      if (!invoice && payment.stripeChargeId) {
        try {
          // Récupérer le Charge
          const charge = await stripe.charges.retrieve(payment.stripeChargeId);
          
          // Le Charge peut avoir un payment_intent qui peut avoir une facture
          if (charge.payment_intent && typeof charge.payment_intent === 'string') {
            // Récupérer le PaymentIntent pour voir s'il a une facture
            const paymentIntentResponse = await stripe.paymentIntents.retrieve(charge.payment_intent);

            // Stripe types: 'retrieve' returns Response<PaymentIntent> in some client libraries,
            // so defensively check for 'invoice' property.
            const paymentIntent = typeof paymentIntentResponse === "object" && paymentIntentResponse !== null && "invoice" in paymentIntentResponse
              ? paymentIntentResponse
              : null;

            if (paymentIntent && paymentIntent.invoice) {
              invoice = await stripe.invoices.retrieve(paymentIntent.invoice as string);
              console.log(`✅ Facture trouvée via Charge -> PaymentIntent.invoice: ${invoice.id}`);
            } else {
              // Lister les factures et filtrer manuellement
              const invoices = await stripe.invoices.list({
                customer: procedure.user.stripeCustomerId,
                limit: 100,
              });

              // TypeScript correction: Need to access 'payment_intent' via 'raw' or use type assertion to avoid TS error
              invoice = invoices.data.find(
                (inv: any) =>
                  typeof inv.payment_intent === "string" &&
                  inv.payment_intent === charge.payment_intent
              ) || null;

              if (invoice) {
                console.log(`✅ Facture trouvée via Charge -> filtrage manuel: ${invoice.id}`);
              }
            }
          }
        } catch (err) {
          console.error("Erreur lors de la recherche via Charge:", err);
        }
      }

      // 3. Si une facture est trouvée, récupérer le PDF directement
      if (invoice) {
        // Récupérer la facture à jour pour avoir les URLs les plus récentes
        try {
          const updatedInvoice = await stripe.invoices.retrieve(invoice.id);
          
          // Prioriser invoice_pdf (PDF direct) plutôt que hosted_invoice_url (page web)
          const invoicePdfUrl = updatedInvoice.invoice_pdf;
          
          if (invoicePdfUrl) {
            // Télécharger le PDF depuis Stripe et le retourner directement
            try {
              const pdfResponse = await fetch(invoicePdfUrl);
              if (pdfResponse.ok) {
                const pdfBlob = await pdfResponse.blob();
                const pdfBuffer = await pdfBlob.arrayBuffer();
                
                // Retourner le PDF en tant que fichier à télécharger
                return new NextResponse(pdfBuffer, {
                  headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="facture-${updatedInvoice.number || updatedInvoice.id}.pdf"`,
                  },
                });
              }
            } catch (pdfError) {
              console.error("Erreur lors du téléchargement du PDF:", pdfError);
              // Si le téléchargement échoue, retourner l'URL en fallback
            }
            
            // Fallback : retourner l'URL du PDF
            return NextResponse.json({
              invoiceUrl: invoicePdfUrl,
              invoiceId: updatedInvoice.id,
              invoiceNumber: updatedInvoice.number,
              status: updatedInvoice.status,
              isPdf: true,
            });
          }
          
          // Si pas de PDF, utiliser hosted_invoice_url en dernier recours
          const hostedUrl = updatedInvoice.hosted_invoice_url;
          if (hostedUrl) {
            return NextResponse.json({
              invoiceUrl: hostedUrl,
              invoiceId: updatedInvoice.id,
              invoiceNumber: updatedInvoice.number,
              status: updatedInvoice.status,
              isPdf: false,
            });
          }
        } catch (retrieveError) {
          console.error("Erreur lors de la récupération de la facture:", retrieveError);
          // Essayer avec l'invoice original
          const invoicePdfUrl = invoice.invoice_pdf;
          if (invoicePdfUrl) {
            try {
              const pdfResponse = await fetch(invoicePdfUrl);
              if (pdfResponse.ok) {
                const pdfBlob = await pdfResponse.blob();
                const pdfBuffer = await pdfBlob.arrayBuffer();
                
                return new NextResponse(pdfBuffer, {
                  headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="facture-${invoice.number || invoice.id}.pdf"`,
                  },
                });
              }
            } catch (pdfError) {
              console.error("Erreur lors du téléchargement du PDF:", pdfError);
            }
            
            return NextResponse.json({
              invoiceUrl: invoicePdfUrl,
              invoiceId: invoice.id,
              invoiceNumber: invoice.number,
              status: invoice.status,
              isPdf: true,
            });
          }
          
          const hostedUrl = invoice.hosted_invoice_url;
          if (hostedUrl) {
            return NextResponse.json({
              invoiceUrl: hostedUrl,
              invoiceId: invoice.id,
              invoiceNumber: invoice.number,
              status: invoice.status,
              isPdf: false,
            });
          }
        }
      }
    } catch (stripeError) {
      console.error("Erreur lors de la récupération de la facture via les IDs du paiement:", stripeError);
    }

    // Si pas de facture Stripe, créer une facture simple
    try {
      const newInvoice = await stripe.invoices.create({
        customer: procedure.user.stripeCustomerId,
        collection_method: "charge_automatically",
        auto_advance: false,
        description: procedure.payment.description || `Facture pour procédure ${procedureId}`,
        metadata: {
          procedureId: procedureId,
          paymentId: procedure.payment.id,
        },
      });

      // Ajouter l'item de facture
      await stripe.invoiceItems.create({
        customer: procedure.user.stripeCustomerId,
        invoice: newInvoice.id,
        amount: Math.round(procedure.payment.amount * 100), // Convertir en centimes
        currency: procedure.payment.currency || "eur",
        description: procedure.payment.description || `Paiement pour procédure ${procedureId}`,
      });

      // Finaliser la facture
      const finalizedInvoice = await stripe.invoices.finalizeInvoice(newInvoice.id);

      // Prioriser le PDF
      const invoicePdfUrl = finalizedInvoice.invoice_pdf;
      if (invoicePdfUrl) {
        try {
          const pdfResponse = await fetch(invoicePdfUrl);
          if (pdfResponse.ok) {
            const pdfBlob = await pdfResponse.blob();
            const pdfBuffer = await pdfBlob.arrayBuffer();
            
            return new NextResponse(pdfBuffer, {
              headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="facture-${finalizedInvoice.number || finalizedInvoice.id}.pdf"`,
              },
            });
          }
        } catch (pdfError) {
          console.error("Erreur lors du téléchargement du PDF:", pdfError);
        }
        
        return NextResponse.json({
          invoiceUrl: invoicePdfUrl,
          invoiceId: finalizedInvoice.id,
          invoiceNumber: finalizedInvoice.number,
          isPdf: true,
        });
      }
      
      // Fallback sur hosted_invoice_url
      const hostedUrl = finalizedInvoice.hosted_invoice_url;
      if (hostedUrl) {
        return NextResponse.json({
          invoiceUrl: hostedUrl,
          invoiceId: finalizedInvoice.id,
          invoiceNumber: finalizedInvoice.number,
          isPdf: false,
        });
      }
    } catch (createError) {
      console.error("Erreur lors de la création de la facture:", createError);
    }

    // Si tout échoue, retourner une erreur
    return NextResponse.json(
      { error: "Impossible de récupérer ou créer la facture. Veuillez contacter le support." },
      { status: 500 }
    );
  } catch (error) {
    console.error("Erreur lors de la récupération de la facture:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur serveur" },
      { status: 500 }
    );
  }
}

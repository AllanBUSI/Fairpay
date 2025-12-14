"use client";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");

interface StripePaymentFormProps {
  amount: number;
  onSuccess: () => void;
  onError: (error: string) => void;
  procedureData?: any;
  hasFacturation?: boolean;
  isSubscription?: boolean;
  priceId?: string;
  promoCode?: string | null;
  procedureId?: string | null;
  priceIds?: {
    miseEnDemeure: string | null;
    echeancier: string | null;
  };
}

function PaymentForm({
  amount,
  onSuccess,
  onError,
  procedureData,
  hasFacturation = false,
  isSubscription = false,
  priceId,
  promoCode,
  procedureId,
  priceIds,
}: Omit<StripePaymentFormProps, "amount"> & { amount: number }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardElementReady, setCardElementReady] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      console.error("Stripe ou Elements non initialisés:", { stripe: !!stripe, elements: !!elements });
      setError("Le formulaire de paiement n'est pas prêt. Veuillez réessayer.");
      return;
    }

    setProcessing(true);
    setError(null);

    try {
      let clientSecret: string;

      if (isSubscription && priceId) {
        // Créer une facturation
        const token = localStorage.getItem("token");
        const response = await fetch("/api/stripe/create-subscription", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ priceId }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Erreur lors de la création de la facturation");
        }
        clientSecret = data.clientSecret;
      } else {
        // Créer un PaymentIntent
        const token = localStorage.getItem("token");
        const response = await fetch("/api/stripe/create-payment-intent", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            amount,
            currency: "eur",
            procedureData,
            hasFacturation,
            promoCode: promoCode || undefined,
            procedureId: procedureId || undefined,
            priceIds: priceIds || undefined,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          console.error("Erreur API create-payment-intent:", data);
          throw new Error(data.error || "Erreur lors de la création du paiement");
        }
        if (!data.clientSecret) {
          console.error("ClientSecret manquant dans la réponse:", data);
          throw new Error("Erreur: secret de paiement manquant");
        }
        clientSecret = data.clientSecret;
      }

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error("Élément de carte non trouvé");
      }

      // Pour les abonnements, on utilise aussi confirmCardPayment car Stripe crée un PaymentIntent
      const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
          },
        }
      );

      if (confirmError) {
        setError(confirmError.message || "Erreur lors du paiement");
        onError(confirmError.message || "Erreur lors du paiement");
      } else if (paymentIntent && paymentIntent.status === "succeeded") {
        // Créer la procédure immédiatement après paiement réussi
        if (procedureData && !isSubscription) {
          try {
            const token = localStorage.getItem("token");
            const createResponse = await fetch("/api/procedures/create-after-payment", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                paymentIntentId: paymentIntent.id,
                procedureData,
                existingProcedureId: procedureId || undefined,
              }),
            });

            if (!createResponse.ok) {
              const errorData = await createResponse.json();
              console.error("Erreur lors de la création de la procédure:", errorData);
              // Ne pas bloquer le succès du paiement, la procédure sera créée via le webhook
            }
          } catch (err) {
            console.error("Erreur lors de la création de la procédure:", err);
            // Ne pas bloquer le succès du paiement, la procédure sera créée via le webhook
          }
        }
        onSuccess();
      } else if (paymentIntent && paymentIntent.status === "processing") {
        // Pour les abonnements, le statut peut être "processing"
        onSuccess();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Une erreur est survenue";
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: "16px",
        color: "#424770",
        "::placeholder": {
          color: "#aab7c4",
        },
      },
      invalid: {
        color: "#9e2146",
      },
    },
  };

  useEffect(() => {
    if (stripe && elements) {
      // Marquer comme prêt dès que Stripe et Elements sont disponibles
      setCardElementReady(true);
    }
  }, [stripe, elements]);

  if (!stripe || !elements) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Initialisation du formulaire de paiement...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border p-4">
        <Label className="mb-2 block">Informations de carte</Label>
        <div className="p-3 border rounded-md bg-white min-h-[50px]" id="card-element-container">
          <CardElement 
            options={cardElementOptions}
            onReady={() => {
              console.log("CardElement is ready");
              setCardElementReady(true);
            }}
            onChange={(e) => {
              if (e.error) {
                setError(e.error.message);
              } else {
                setError(null);
              }
            }}
          />
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
      </div>

      <Button
        type="submit"
        disabled={!stripe || !cardElementReady || processing}
        className="w-full"
      >
        {processing 
          ? "Traitement..." 
          : !stripe 
            ? "Chargement..." 
            : !cardElementReady 
              ? "Initialisation..." 
              : `Payer ${amount.toFixed(2)} €`}
      </Button>
    </form>
  );
}

export function StripePaymentForm(props: StripePaymentFormProps) {
  const [stripeLoaded, setStripeLoaded] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);

  useEffect(() => {
    const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey || publishableKey === "" || publishableKey.includes("your_stripe")) {
      setStripeError("Clé Stripe non configurée. Veuillez configurer NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY dans votre fichier .env.local");
      setStripeLoaded(true);
      return;
    }

    stripePromise.then((stripe) => {
      if (stripe) {
        setStripeLoaded(true);
      } else {
        setStripeError("Impossible de charger Stripe");
        setStripeLoaded(true);
      }
    }).catch((err) => {
      console.error("Erreur lors du chargement de Stripe:", err);
      setStripeError(`Erreur lors du chargement de Stripe: ${err instanceof Error ? err.message : "Erreur inconnue"}`);
      setStripeLoaded(true);
    });
  }, []);

  if (!stripeLoaded) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Chargement du formulaire de paiement...</p>
      </div>
    );
  }

  if (stripeError) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <p className="text-red-600 font-semibold mb-2">Erreur de configuration</p>
          <p className="text-sm text-red-600">{stripeError}</p>
        </div>
      </div>
    );
  }

  return (
    <Elements 
      stripe={stripePromise}
      options={{
        appearance: {
          theme: 'stripe',
        },
      }}
    >
      <PaymentForm {...props} />
    </Elements>
  );
}


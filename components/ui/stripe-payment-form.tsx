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
  clientSecret?: string | null; // ClientSecret optionnel si déjà créé
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
  clientSecret: providedClientSecret,
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

      // Si un clientSecret est déjà fourni, l'utiliser directement
      if (providedClientSecret) {
        clientSecret = providedClientSecret;
      }
      // Si c'est un abonnement avec paiement (hasFacturation), utiliser la nouvelle route
      else if (hasFacturation && !isSubscription) {
        const token = localStorage.getItem("token");
        const response = await fetch("/api/stripe/create-subscription-with-payment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            procedureData,
            procedureId: procedureId || undefined,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Erreur lors de la création de l'abonnement et du paiement");
        }
        
        if (!data.clientSecret) {
          throw new Error("Erreur: secret de paiement manquant");
        }
        
        clientSecret = data.clientSecret;
      } else if (isSubscription && priceId) {
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
        
        if (!data.clientSecret) {
          throw new Error("Erreur: secret de paiement manquant pour l'abonnement");
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
        const token = localStorage.getItem("token");
        
        // Si hasFacturation est true, confirmer le paiement et mettre à jour la procédure
        if (hasFacturation && procedureId) {
          try {
            console.log(`📧 Confirmation du paiement avec abonnement pour la procédure ${procedureId}`);
            const confirmResponse = await fetch("/api/stripe/confirm-subscription-payment", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                paymentIntentId: paymentIntent.id,
                procedureId,
              }),
            });

            if (!confirmResponse.ok) {
              const errorData = await confirmResponse.json();
              console.error("❌ Erreur lors de la confirmation du paiement:", errorData);
              // Si la confirmation échoue, ne pas continuer - le statut restera en BROUILLONS
              throw new Error(errorData.error || "Erreur lors de la confirmation du paiement. Le dossier reste en brouillon.");
            } else {
              const successData = await confirmResponse.json();
              console.log("✅ Confirmation du paiement avec abonnement réussie:", successData);
              // Le statut a été mis à jour à NOUVEAU dans l'API
            }
          } catch (err) {
            console.error("❌ Erreur lors de la confirmation du paiement:", err);
            // Si la confirmation échoue, ne pas appeler onSuccess - le statut reste en BROUILLONS
            setError(err instanceof Error ? err.message : "Erreur lors de la confirmation du paiement. Le dossier reste en brouillon.");
            onError(err instanceof Error ? err.message : "Erreur lors de la confirmation du paiement");
            return; // Ne pas continuer si la confirmation échoue
          }
        }
        // Si un clientSecret est fourni sans procedureId, c'est peut-être un retry de paiement ou d'abonnement
        else if (providedClientSecret && !procedureId && !hasFacturation) {
          // Vérifier si c'est un retry d'abonnement via les métadonnées
          const isSubscriptionRetry = (paymentIntent as any).metadata?.["isSubscriptionRetry"] === "true";
          
          if (isSubscriptionRetry) {
            try {
              const subscriptionId = (paymentIntent as any).metadata?.["subscriptionId"];
              if (subscriptionId) {
                const confirmResponse = await fetch("/api/subscriptions/confirm-retry-payment", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    paymentIntentId: paymentIntent.id,
                    subscriptionId,
                  }),
                });

                if (!confirmResponse.ok) {
                  const errorData = await confirmResponse.json();
                  console.error("❌ Erreur lors de la confirmation du paiement d'abonnement:", errorData);
                  throw new Error(errorData.error || "Erreur lors de la confirmation du paiement");
                } else {
                  const successData = await confirmResponse.json();
                  console.log("✅ Confirmation du paiement d'abonnement réussie:", successData);
                }
              }
            } catch (err) {
              console.error("❌ Erreur lors de la confirmation du paiement d'abonnement:", err);
              setError(err instanceof Error ? err.message : "Erreur lors de la confirmation du paiement");
              onError(err instanceof Error ? err.message : "Erreur lors de la confirmation du paiement");
              return;
            }
          } else {
            // C'est un retry de paiement simple, utiliser confirm-payment-simple
            // Récupérer le procedureId depuis les métadonnées du PaymentIntent si c'est un retry
            const retryProcedureId = (paymentIntent as any).metadata?.["procedureId"] || null;
            
            try {
              const confirmResponse = await fetch("/api/stripe/confirm-payment-simple", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                  paymentIntentId: paymentIntent.id,
                  procedureId: retryProcedureId,
                }),
              });

              if (!confirmResponse.ok) {
                const errorData = await confirmResponse.json();
                console.error("❌ Erreur lors de la confirmation du paiement:", errorData);
                throw new Error(errorData.error || "Erreur lors de la confirmation du paiement");
              } else {
                const successData = await confirmResponse.json();
                console.log("✅ Confirmation du paiement réussie:", successData);
              }
            } catch (err) {
              console.error("❌ Erreur lors de la confirmation du paiement:", err);
              setError(err instanceof Error ? err.message : "Erreur lors de la confirmation du paiement");
              onError(err instanceof Error ? err.message : "Erreur lors de la confirmation du paiement");
              return;
            }
          }
        }
        // Si un clientSecret est fourni et qu'on a un procedureId, c'est un paiement simple ou une injonction
        else if (providedClientSecret && procedureId && !hasFacturation) {
          // Vérifier si c'est une injonction (via les métadonnées du PaymentIntent)
          const isInjonctionFromMetadata = (paymentIntent as any).metadata?.["isInjonction"] === "true";
          
          // Vérifier aussi le statut actuel de la procédure pour être sûr
          let isInjonctionFromProcedure = false;
          try {
            const procedureResponse = await fetch(`/api/procedures/${procedureId}`, {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });
            if (procedureResponse.ok) {
              const procedureData = await procedureResponse.json();
              isInjonctionFromProcedure = procedureData.status === "INJONCTION_DE_PAIEMENT" || 
                                          procedureData.status === "INJONCTION_DE_PAIEMENT_PAYER";
            }
          } catch (err) {
            console.warn("Impossible de vérifier le statut de la procédure:", err);
          }
          
          const isInjonction = isInjonctionFromMetadata || isInjonctionFromProcedure;
          
          console.log(`🔍 Type de paiement détecté: ${isInjonction ? "INJONCTION" : "SIMPLE"}`);
          console.log(`📋 PaymentIntent metadata:`, (paymentIntent as any).metadata);
          console.log(`📋 isInjonctionFromMetadata: ${isInjonctionFromMetadata}, isInjonctionFromProcedure: ${isInjonctionFromProcedure}`);
          
          try {
            const confirmEndpoint = isInjonction 
              ? "/api/stripe/confirm-injonction-payment"
              : "/api/stripe/confirm-payment-simple";
            
            console.log(`📞 Appel de la route de confirmation: ${confirmEndpoint}`);
            
            // Récupérer le procedureId depuis les métadonnées si c'est un retry
            const retryProcedureId = (paymentIntent as any).metadata?.["procedureId"] || procedureId;
            
            const confirmResponse = await fetch(confirmEndpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                paymentIntentId: paymentIntent.id,
                procedureId: retryProcedureId,
              }),
            });

            if (!confirmResponse.ok) {
              const errorData = await confirmResponse.json();
              console.error("❌ Erreur lors de la confirmation du paiement:", errorData);
              // Si c'est une injonction et que la route simple a été appelée par erreur, réessayer avec la bonne route
              if (errorData.isInjonction && !isInjonction) {
                console.log("🔄 Réessai avec la route d'injonction...");
                const retryResponse = await fetch("/api/stripe/confirm-injonction-payment", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    paymentIntentId: paymentIntent.id,
                    procedureId,
                  }),
                });
                if (retryResponse.ok) {
                  const retryData = await retryResponse.json();
                  console.log("✅ Confirmation du paiement d'injonction réussie après réessai:", retryData);
                }
              }
            } else {
              const successData = await confirmResponse.json();
              console.log("✅ Confirmation du paiement réussie:", successData);
            }
          } catch (err) {
            console.error("❌ Erreur lors de la confirmation du paiement:", err);
            // Ne pas bloquer le succès du paiement, la procédure sera mise à jour via le webhook
          }
        }
        // Si hasFacturation est false et qu'on a procedureData, créer la procédure immédiatement après paiement réussi
        else if (procedureData && !isSubscription && !hasFacturation && !providedClientSecret) {
          try {
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
        // Appeler onSuccess seulement si la confirmation a réussi (ou si ce n'est pas un paiement avec abonnement)
        onSuccess();
      } else if (paymentIntent && paymentIntent.status === "processing") {
        // Pour les abonnements, le statut peut être "processing"
        // Dans ce cas, ne pas appeler onSuccess car le paiement n'est pas encore confirmé
        // Le statut restera en BROUILLONS jusqu'à confirmation
        console.log("⏳ Paiement en cours de traitement. Le statut restera en BROUILLONS jusqu'à confirmation.");
        setError("Le paiement est en cours de traitement. Vous serez notifié lorsque le paiement sera confirmé.");
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


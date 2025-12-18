"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CreditCard, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StripePaymentForm } from "@/components/ui/stripe-payment-form";
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "");

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  createdAt: string;
  stripePaymentIntentId: string | null;
}

interface Subscription {
  id: string;
  status: string;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string;
}

export default function PaiementRequisPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [failedPayments, setFailedPayments] = useState<Payment[]>([]);
  const [unpaidSubscriptions, setUnpaidSubscriptions] = useState<Subscription[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);

  useEffect(() => {
    checkUnpaid();
  }, []);

  const checkUnpaid = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/payments/check-unpaid", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setFailedPayments(data.failedPayments || []);
        setUnpaidSubscriptions(data.unpaidSubscriptions || []);
        
        // Si plus d'impayés, rediriger vers le dashboard
        if (!data.hasUnpaid) {
          router.push("/dashboard");
        }
      } else {
        setError("Erreur lors de la vérification des impayés");
      }
    } catch (err) {
      setError("Erreur lors de la vérification des impayés");
    } finally {
      setLoading(false);
    }
  };

  const handleRetryPayment = async (payment: Payment) => {
    try {
      setProcessingPayment(true);
      setError(null);
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      // Créer un nouveau PaymentIntent pour retry le paiement
      const response = await fetch("/api/payments/retry-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paymentId: payment.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors de la création du paiement");
      }

      const data = await response.json();
      setSelectedPayment(payment);
      setSelectedSubscription(null);
      setPaymentClientSecret(data.clientSecret);
      setPaymentAmount(payment.amount);
      setShowPaymentModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la tentative de paiement");
      console.error("Erreur lors de la tentative de paiement:", err);
    } finally {
      setProcessingPayment(false);
    }
  };

  const handlePaymentSuccess = async () => {
    setShowPaymentModal(false);
    setSelectedPayment(null);
    setSelectedSubscription(null);
    setPaymentClientSecret(null);
    setPaymentAmount(0);
    // Recharger les impayés
    await checkUnpaid();
  };

  const handlePaymentError = (error: string) => {
    setError(error);
  };

  const handleRetrySubscription = async (subscription: Subscription) => {
    try {
      setProcessingPayment(true);
      setError(null);
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      // Créer un PaymentIntent pour régulariser l'abonnement
      const response = await fetch("/api/subscriptions/retry-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          subscriptionId: subscription.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors de la création du paiement");
      }

      const data = await response.json();
      setSelectedSubscription(subscription);
      setPaymentClientSecret(data.clientSecret);
      // Pour l'abonnement, on utilise le prix mensuel (34,80€ TTC)
      setPaymentAmount(34.80);
      setShowPaymentModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la tentative de paiement");
      console.error("Erreur lors de la tentative de paiement:", err);
    } finally {
      setProcessingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Vérification des paiements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <CardTitle>Paiement requis</CardTitle>
          </div>
          <CardDescription>
            Vous avez des paiements en attente ou en échec. Veuillez les régulariser pour continuer à utiliser FairPay.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Erreur</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Paiements en échec */}
          {failedPayments.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Paiements en échec
              </h3>
              <div className="space-y-3">
                {failedPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="border rounded-lg p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium">
                        {payment.description || "Paiement"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {payment.amount.toFixed(2)} {payment.currency.toUpperCase()} •{" "}
                        {new Date(payment.createdAt).toLocaleDateString("fr-FR")}
                      </p>
                      <p className="text-xs text-destructive mt-1">
                        Statut: {payment.status === "FAILED" ? "Échec" : "En attente"}
                      </p>
                    </div>
                    <Button
                      onClick={() => handleRetryPayment(payment)}
                      variant="outline"
                      disabled={processingPayment}
                    >
                      {processingPayment ? "Traitement..." : "Payer maintenant"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Abonnements en impayé */}
          {unpaidSubscriptions.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Abonnements en impayé
              </h3>
              <div className="space-y-3">
                {unpaidSubscriptions.map((subscription) => (
                  <div
                    key={subscription.id}
                    className="border rounded-lg p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium">Abonnement mensuel</p>
                      <p className="text-sm text-muted-foreground">
                        Période se terminant le{" "}
                        {new Date(subscription.currentPeriodEnd).toLocaleDateString("fr-FR")}
                      </p>
                      <p className="text-xs text-destructive mt-1">
                        Statut:{" "}
                        {subscription.status === "PAST_DUE"
                          ? "En retard"
                          : subscription.status === "UNPAID"
                          ? "Impayé"
                          : subscription.status}
                      </p>
                    </div>
                    <Button
                      onClick={() => handleRetrySubscription(subscription)}
                      variant="default"
                      disabled={processingPayment}
                    >
                      {processingPayment ? "Traitement..." : "Régulariser"}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Message si aucun impayé trouvé */}
          {failedPayments.length === 0 && unpaidSubscriptions.length === 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Aucun impayé trouvé</AlertTitle>
              <AlertDescription>
                Vous allez être redirigé vers le dashboard.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button onClick={checkUnpaid} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
            {failedPayments.length === 0 && unpaidSubscriptions.length === 0 && (
              <Button onClick={() => router.push("/dashboard")}>
                Retour au dashboard
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal de paiement */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Paiement</DialogTitle>
            <DialogDescription>
              {selectedPayment && (
                <>
                  Montant à payer : {selectedPayment.amount.toFixed(2)} {selectedPayment.currency.toUpperCase()}
                </>
              )}
              {selectedSubscription && (
                <>
                  Montant à payer : {paymentAmount.toFixed(2)} € TTC (Abonnement mensuel)
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {paymentClientSecret && (selectedPayment || selectedSubscription) && (
            <Elements stripe={stripePromise}>
              <StripePaymentForm
                amount={paymentAmount}
                onSuccess={handlePaymentSuccess}
                onError={handlePaymentError}
                clientSecret={paymentClientSecret}
                procedureId={null}
              />
            </Elements>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


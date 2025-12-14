"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard, FileText, X, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StripePaymentForm } from "@/components/ui/stripe-payment-form";

interface Subscription {
  id: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
}

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  createdAt: string;
  procedure: {
    id: string;
    status: string;
  } | null;
}

interface PaymentMethod {
  id: string;
  card: {
    brand: string;
    last4: string;
    exp_month: number;
    exp_year: number;
  };
}

interface StripeInvoice {
  id: string;
  number: string | null;
  status: string;
  amount: number;
  currency: string;
  created: string;
  dueDate: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  description: string;
  subscriptionId: string | null;
  periodStart: string | null;
  periodEnd: string | null;
}

export default function FacturationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showSubscribeDialog, setShowSubscribeDialog] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [priceId, setPriceId] = useState<string | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [invoices, setInvoices] = useState<StripeInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [error, setError] = useState("");

  // Calculer isActive et isCanceled avant le return conditionnel
  const isActive = subscription && (subscription.status === "ACTIVE" || subscription.status === "TRIALING");
  const isCanceled = subscription && subscription.cancelAtPeriodEnd;

  useEffect(() => {
    fetchData();
    fetchPriceId();
  }, []);

  useEffect(() => {
    const subscriptionIsActive = subscription && (subscription.status === "ACTIVE" || subscription.status === "TRIALING");
    if (subscription && subscriptionIsActive) {
      fetchPaymentMethods();
    }
  }, [subscription]);

  // Debug logs - un seul useEffect
  useEffect(() => {
    if (!loading) {
      console.log("État actuel - subscription:", subscription);
      console.log("État actuel - payments:", payments);
      console.log("État actuel - isActive:", isActive);
      console.log("État actuel - payments.length:", payments.length);
    }
  }, [subscription, payments, isActive, loading]);

  const fetchPriceId = async () => {
    try {
      const response = await fetch("/api/stripe/get-price-id");
      if (response.ok) {
        const data = await response.json();
        if (data.priceId) {
          setPriceId(data.priceId);
        } else {
          console.error("Price ID non trouvé dans la réponse:", data);
          setError("Configuration Stripe incomplète. Veuillez contacter le support.");
        }
      } else {
        const errorData = await response.json();
        console.error("Erreur lors de la récupération du Price ID:", errorData);
        setError(errorData.error || "Erreur lors du chargement de la configuration de paiement");
      }
    } catch (err) {
      console.error("Erreur lors de la récupération du Price ID:", err);
      setError("Impossible de charger la configuration de paiement. Vérifiez votre connexion.");
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch("/api/stripe/get-payment-methods", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPaymentMethods(data.paymentMethods || []);
      }
    } catch (err) {
      console.error("Erreur lors de la récupération des méthodes de paiement:", err);
    }
  };

  const getCardBrandName = (brand: string) => {
    const brands: Record<string, string> = {
      visa: "Visa",
      mastercard: "Mastercard",
      amex: "American Express",
      discover: "Discover",
      jcb: "JCB",
      diners: "Diners Club",
      unionpay: "UnionPay",
    };
    return brands[brand.toLowerCase()] || brand;
  };

  const fetchInvoices = async (token: string) => {
    setLoadingInvoices(true);
    try {
      const response = await fetch("/api/stripe/get-invoices", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log("📄 Factures reçues:", data.invoices);
        setInvoices(data.invoices || []);
      } else {
        const errorData = await response.json();
        console.error("Erreur lors de la récupération des factures Stripe:", errorData);
        setError(errorData.error || "Erreur lors de la récupération des factures");
      }
    } catch (err) {
      console.error("Erreur lors de la récupération des factures:", err);
      setError("Erreur lors de la récupération des factures");
    } finally {
      setLoadingInvoices(false);
    }
  };

  const getInvoiceStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      paid: "Payée",
      open: "Ouverte",
      void: "Annulée",
      uncollectible: "Impayable",
      draft: "Brouillon",
    };
    return labels[status] || status;
  };

  const getInvoiceStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      paid: "text-green-600 bg-green-100",
      open: "text-yellow-600 bg-yellow-100",
      void: "text-gray-600 bg-gray-100",
      uncollectible: "text-red-600 bg-red-100",
      draft: "text-blue-600 bg-blue-100",
    };
    return colors[status] || "text-gray-600 bg-gray-100";
  };

  const fetchData = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      // Créer les factures manquantes pour les paiements existants
      try {
        const createInvoicesResponse = await fetch("/api/stripe/create-missing-invoices", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        if (createInvoicesResponse.ok) {
          const createData = await createInvoicesResponse.json();
          console.log("✅ Factures créées:", createData);
          if (createData.created > 0) {
            // Attendre un peu pour que Stripe traite les factures
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } else {
          const errorData = await createInvoicesResponse.json();
          console.error("Erreur lors de la création des factures manquantes:", errorData);
        }
      } catch (e) {
        // Ignorer les erreurs, on continue quand même
        console.error("Erreur lors de la création des factures manquantes:", e);
      }

      // Récupérer la facturation (vérifie directement dans Stripe et synchronise)
      const subResponse = await fetch("/api/stripe/check-subscription", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (subResponse.ok) {
        const subData = await subResponse.json();
        console.log("Données d'abonnement reçues:", subData);
        setSubscription(subData.subscription || null);
      } else {
        // Si l'API check-subscription échoue, essayer l'ancienne API
        const fallbackResponse = await fetch("/api/user/subscription", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          console.log("Données d'abonnement reçues (fallback):", fallbackData);
          setSubscription(fallbackData.subscription || null);
        } else {
          const errorData = await fallbackResponse.json();
          console.error("Erreur lors de la récupération de l'abonnement:", errorData);
          if (fallbackResponse.status !== 404) {
            setError(errorData.error || "Erreur lors du chargement de l'abonnement");
          }
        }
      }

      // Récupérer les paiements
      const paymentsResponse = await fetch("/api/user/payments", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (paymentsResponse.ok) {
        const paymentsData = await paymentsResponse.json();
        console.log("Données de paiements reçues:", paymentsData);
        setPayments(paymentsData.payments || []);
      } else {
        const errorData = await paymentsResponse.json();
        console.error("Erreur lors de la récupération des paiements:", errorData);
        if (paymentsResponse.status !== 404) {
          setError(errorData.error || "Erreur lors du chargement des paiements");
        }
      }

      // Récupérer les factures Stripe
      await fetchInvoices(token);
    } catch (err) {
      console.error("Erreur:", err);
      setError("Une erreur est survenue lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelFacturation = async () => {
    setCanceling(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/stripe/cancel-subscription", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setShowCancelDialog(false);
        fetchData(); // Rafraîchir les données
      } else {
        setError(data.error || "Erreur lors de l'annulation");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setCanceling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-4" />
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Facturation et factures</h1>
          <p className="mt-2 text-muted-foreground">
            Gérez votre facturation et consultez votre historique de paiements
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Section Facturation */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <CreditCard className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-semibold">Facturation</h2>
            </div>

            {!subscription ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <X className="h-5 w-5 text-gray-600" />
                    <p className="font-semibold text-gray-900">Non abonné</p>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Vous n'avez pas de facturation active. Souscrivez pour bénéficier de tarifs préférentiels.
                  </p>
                  <Button onClick={() => setShowSubscribeDialog(true)}>
                    Souscrire à la facturation
                  </Button>
                </div>
              </div>
            ) : !isActive ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <X className="h-5 w-5 text-yellow-600" />
                    <p className="font-semibold text-yellow-900">Abonnement inactif</p>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Statut: <span className="font-medium">{subscription.status}</span>
                  </p>
                  {subscription.canceledAt && (
                    <p className="text-sm text-muted-foreground mb-4">
                      Annulé le: {new Date(subscription.canceledAt).toLocaleDateString("fr-FR")}
                    </p>
                  )}
                  <Button onClick={() => setShowSubscribeDialog(true)}>
                    Réactiver la facturation
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-semibold text-green-900">Abonné</p>
                        <p className="text-sm text-muted-foreground">Facturation mensuelle - 29 € HT / mois</p>
                      </div>
                    </div>
                    <span className="px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-800">
                      {subscription.status === "TRIALING" ? "Essai" : "Actif"}
                    </span>
                  </div>
                </div>

                {isCanceled ? (
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                    <p className="text-sm text-yellow-800">
                      Votre facturation sera annulée le{" "}
                      {new Date(subscription.currentPeriodEnd).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-muted-foreground">
                      <p>
                        Période actuelle: du{" "}
                        {new Date(subscription.currentPeriodStart).toLocaleDateString("fr-FR")} au{" "}
                        {new Date(subscription.currentPeriodEnd).toLocaleDateString("fr-FR")}
                      </p>
                    </div>

                    {/* Carte bancaire enregistrée */}
                    {paymentMethods.length > 0 && (
                      <div className="rounded-lg border bg-muted/50 p-4">
                        <p className="text-sm font-medium mb-3">Carte bancaire enregistrée</p>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <CreditCard className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <p className="font-semibold">
                                  {getCardBrandName(paymentMethods[0].card.brand)} •••• {paymentMethods[0].card.last4}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Expire le {String(paymentMethods[0].card.exp_month).padStart(2, '0')}/{paymentMethods[0].card.exp_year}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <Button
                      variant="outline"
                      onClick={() => setShowCancelDialog(true)}
                      className="w-full"
                    >
                      Annuler la facturation
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Section Factures */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-semibold">Historique des paiements</h2>
            </div>

            {!loading && payments.length === 0 ? (
              <div className="space-y-2">
                <p className="text-muted-foreground">Aucun paiement pour le moment.</p>
                <p className="text-xs text-muted-foreground">
                  Vos paiements apparaîtront ici une fois effectués.
                </p>
              </div>
            ) : loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex-1">
                      <p className="font-medium">
                        {payment.description || "Paiement de dossier"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(payment.createdAt).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </p>
                      {payment.procedure && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Dossier: {payment.procedure.id.slice(0, 8)}...
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {payment.amount.toFixed(2)} {payment.currency.toUpperCase()}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        {payment.status === "SUCCEEDED" ? (
                          <>
                            <Check className="h-4 w-4 text-green-600" />
                            <span className="text-xs text-green-600">Payé</span>
                          </>
                        ) : payment.status === "FAILED" ? (
                          <>
                            <X className="h-4 w-4 text-red-600" />
                            <span className="text-xs text-red-600">Échoué</span>
                          </>
                        ) : (
                          <span className="text-xs text-yellow-600">En attente</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section Factures Stripe */}
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <FileText className="h-6 w-6 text-primary" />
                <h2 className="text-xl font-semibold">Factures Stripe</h2>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const token = localStorage.getItem("token");
                    if (!token) return;

                    const response = await fetch("/api/stripe/create-portal-session", {
                      method: "POST",
                      headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        returnUrl: window.location.href,
                      }),
                    });

                    if (response.ok) {
                      const data = await response.json();
                      if (data.url) {
                        window.location.href = data.url;
                      }
                    } else {
                      setError("Impossible d'accéder au portail Stripe");
                    }
                  } catch (e) {
                    console.error("Erreur:", e);
                    setError("Erreur lors de l'accès au portail Stripe");
                  }
                }}
              >
                Voir sur Stripe
              </Button>
            </div>

            {loadingInvoices ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : invoices.length === 0 ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-muted-foreground">Aucune facture Stripe pour le moment.</p>
                  <p className="text-xs text-muted-foreground">
                    Vos factures d'abonnement apparaîtront ici.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={async () => {
                    try {
                      const token = localStorage.getItem("token");
                      if (!token) return;

                      const response = await fetch("/api/stripe/create-portal-session", {
                        method: "POST",
                        headers: {
                          Authorization: `Bearer ${token}`,
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          returnUrl: window.location.href,
                        }),
                      });

                      if (response.ok) {
                        const data = await response.json();
                        if (data.url) {
                          window.location.href = data.url;
                        }
                      } else {
                        setError("Impossible d'accéder au portail Stripe");
                      }
                    } catch (e) {
                      console.error("Erreur:", e);
                      setError("Erreur lors de l'accès au portail Stripe");
                    }
                  }}
                >
                  Voir mes factures sur Stripe
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">
                          {invoice.number || invoice.id.slice(0, 8)}
                        </p>
                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getInvoiceStatusColor(invoice.status)}`}>
                          {getInvoiceStatusLabel(invoice.status)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {invoice.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(invoice.created).toLocaleDateString("fr-FR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                        {invoice.periodStart && invoice.periodEnd && (
                          <span className="ml-2">
                            (Période: {new Date(invoice.periodStart).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })} - {new Date(invoice.periodEnd).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })})
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <p className="font-semibold">
                          {invoice.amount.toFixed(2)} {invoice.currency}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        {invoice.hostedInvoiceUrl && (
                          <a
                            href={invoice.hostedInvoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline"
                            title="Voir la facture"
                          >
                            Voir
                          </a>
                        )}
                        {invoice.invoicePdf && (
                          <a
                            href={invoice.invoicePdf}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline"
                            title="Télécharger le PDF"
                          >
                            PDF
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Dialog de souscription */}
        <Dialog open={showSubscribeDialog} onOpenChange={setShowSubscribeDialog}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Souscrire à la facturation mensuelle</DialogTitle>
              <DialogDescription>
                Bénéficiez de tarifs préférentiels : 99 € HT pour la mise en demeure et écheancier gratuit
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold text-lg">Facturation mensuelle</p>
                    <p className="text-sm text-muted-foreground">29 € HT / mois</p>
                  </div>
                  <p className="font-bold text-xl text-green-600">29 € HT</p>
                </div>
                <ul className="mt-3 space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>Mise en demeure à 99 € HT (au lieu de 179 € HT)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>Écheancier gratuit</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>Économies jusqu'à 105 € par dossier</span>
                  </li>
                </ul>
              </div>
              
              {priceId ? (
                <StripePaymentForm
                  amount={29 * 1.20} // 29 € HT + TVA = 34.80 € TTC
                  isSubscription={true}
                  priceId={priceId}
                  onSuccess={async () => {
                    setShowSubscribeDialog(false);
                    setLoading(true);
                    
                    // Vérifier directement l'abonnement dans Stripe (plus rapide que d'attendre le webhook)
                    const token = localStorage.getItem("token");
                    if (token) {
                      // Essayer plusieurs fois avec un délai pour s'assurer que l'abonnement est créé
                      for (let i = 0; i < 5; i++) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                        const checkResponse = await fetch("/api/stripe/check-subscription", {
                          headers: {
                            Authorization: `Bearer ${token}`,
                          },
                        });
                        
                        if (checkResponse.ok) {
                          const checkData = await checkResponse.json();
                          if (checkData.subscription) {
                            setSubscription(checkData.subscription);
                            // Rafraîchir aussi les méthodes de paiement
                            const paymentMethodsResponse = await fetch("/api/stripe/get-payment-methods", {
                              headers: {
                                Authorization: `Bearer ${token}`,
                              },
                            });
                            if (paymentMethodsResponse.ok) {
                              const paymentMethodsData = await paymentMethodsResponse.json();
                              setPaymentMethods(paymentMethodsData.paymentMethods || []);
                            }
                            break;
                          }
                        }
                      }
                      
                      // Rafraîchir toutes les données
                      await fetchData();
                    }
                    
                    setLoading(false);
                  }}
                  onError={(error) => {
                    setError(error);
                  }}
                />
              ) : error ? (
                <div className="text-center py-4">
                  <p className="text-sm text-red-600 mb-4">{error}</p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setError("");
                      fetchPriceId();
                    }}
                  >
                    Réessayer
                  </Button>
                </div>
              ) : (
                <div className="text-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
                  <p className="text-sm text-muted-foreground">Chargement du formulaire de paiement...</p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Dialog d'annulation */}
        <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Annuler la facturation</DialogTitle>
              <DialogDescription>
                Êtes-vous sûr de vouloir annuler votre facturation ? Vous continuerez à bénéficier
                de la facturation jusqu'à la fin de la période en cours.
              </DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowCancelDialog(false)}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                onClick={handleCancelFacturation}
                disabled={canceling}
                className="flex-1"
              >
                {canceling ? "Annulation..." : "Confirmer l'annulation"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}


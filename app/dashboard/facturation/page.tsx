"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, CreditCard, FileText, Receipt, CheckCircle2, AlertCircle } from "lucide-react";

interface Subscription {
  id: string;
  stripeSubscriptionId: string;
  stripePriceId: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Invoice {
  id: string;
  amount?: number;
  currency?: string;
  status: string;
  created?: number;
  invoice_pdf: string | null;
  hosted_invoice_url: string | null;
  description: string | null;
  subscriptionId?: string | null;
  number?: string | null;
}

export default function FacturationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [accessingPortal, setAccessingPortal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      // Récupérer les factures Stripe (abonnements et achats)
      const invoicesResponse = await fetch("/api/stripe/get-invoices", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (invoicesResponse.ok) {
        const invoicesData = await invoicesResponse.json();
        // Filtrer les factures en attente (statut "open")
        const filteredInvoices = (invoicesData.invoices || []).filter(
          (invoice: Invoice) => invoice.status !== "open"
        );
        setInvoices(filteredInvoices);
        console.log(`📄 Factures récupérées:`, filteredInvoices.length);
      } else {
        const errorData = await invoicesResponse.json();
        console.error("Erreur lors de la récupération des factures:", errorData);
      }

      // Récupérer l'abonnement actif
      const subscriptionResponse = await fetch("/api/stripe/check-subscription", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (subscriptionResponse.ok) {
        const subscriptionData = await subscriptionResponse.json();
        if (subscriptionData.subscription) {
          setSubscription(subscriptionData.subscription);
          console.log(`📦 Abonnement récupéré:`, subscriptionData.subscription);
        }
      } else {
        const errorData = await subscriptionResponse.json();
        console.error("Erreur lors de la récupération de l'abonnement:", errorData);
      }
    } catch (err) {
      console.error("Erreur:", err);
      setError("Une erreur est survenue lors du chargement des données");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return "Date invalide";
      }
      return date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch (error) {
      return "Date invalide";
    }
  };

  const handleAccessStripePortal = async () => {
    setAccessingPortal(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

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
        } else {
          setErrorMessage("URL du portail Stripe non disponible");
          setShowErrorModal(true);
        }
      } else {
        const errorData = await response.json();
        setErrorMessage(errorData.error || "Impossible d'accéder au portail Stripe");
        setShowErrorModal(true);
      }
    } catch (e) {
      console.error("Erreur:", e);
      setErrorMessage("Erreur lors de l'accès au portail Stripe");
      setShowErrorModal(true);
    } finally {
      setAccessingPortal(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#0F172A] mx-auto mb-4" />
          <p className="text-[#0F172A]/70">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ">
      {/* Header */}
      <div className="border-b border-[#E5E7EB] ">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#0F172A] flex items-center gap-3">
                <Receipt className="h-8 w-8 text-[#0F172A]" />
                Facturation
              </h1>
              <p className="text-sm text-[#0F172A]/70 mt-1 font-light">
                Gérez votre abonnement et consultez vos factures
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-8 max-w-4xl">
        <div className="space-y-6">
          {/* Abonnement actif */}
          <div className="rounded-xl border border-[#E5E7EB] p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Mon abonnement
            </h2>
            <div className="rounded-lg border border-[#E5E7EB] bg-white p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="font-semibold text-[#0F172A] text-lg">Abonnement Premium</p>
                  <p className="text-sm text-[#0F172A]/60 mt-1">34,80€ TTC / mois</p>
                </div>
                <span className={`px-4 py-2 text-sm font-medium rounded-full ${subscription && (subscription.status === "ACTIVE" || subscription.status === "TRIALING")
                    ? "text-green-800"
                    : "text-gray-800"
                  }`}>
                  {subscription && (subscription.status === "ACTIVE" || subscription.status === "TRIALING")
                    ? "Actif"
                    : "Non actif"}
                </span>
              </div>
              <div className="pt-4 border-t border-[#E5E7EB]">
                <Button
                  onClick={handleAccessStripePortal}
                  disabled={accessingPortal}
                  className="w-full bg-[#0F172A] hover:bg-[#0F172A]/90 text-white"
                >
                  {accessingPortal ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Chargement...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Accéder aux factures Stripe
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Liste des factures */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Mes factures
            </h2>

            {invoices.length === 0 ? (
              <p className="text-sm text-[#0F172A]/60 text-center py-8">
                Aucune facture disponible
              </p>
            ) : (
              <div className="space-y-3">
                {invoices.map((invoice) => {
                  const createdTimestamp = invoice.created;
                  return (
                  <div
                    key={invoice.id}
                    className="border border-[#E5E7EB] rounded-lg p-4 hover:bg-[#F9FAFB] transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="font-semibold text-[#0F172A]">
                            {invoice.description || (invoice.subscriptionId ? "Abonnement Premium" : "Achat")}
                          </p>
                          <span className={`px-2 py-1 text-xs font-medium rounded ${invoice.status === "paid"
                              ? "bg-green-100 text-green-800"
                              : invoice.status === "open"
                                ? "bg-yellow-100 text-yellow-800"
                                : invoice.status === "draft"
                                  ? "text-gray-800"
                                  : "bg-red-100 text-red-800"
                            }`}>
                            {invoice.status === "paid" ? "Payée" :
                              invoice.status === "open" ? "En attente" :
                                invoice.status === "draft" ? "Brouillon" : "Impayée"}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[#0F172A]/60">
                          {invoice.number && (
                            <span>N° {invoice.number}</span>
                          )}
                          {invoice.amount !== undefined && invoice.currency && (
                            <span>
                              {invoice.amount.toFixed(2)} {invoice.currency}
                            </span>
                          )}
                          {createdTimestamp !== undefined && createdTimestamp !== null && createdTimestamp > 0 && (
                            <span>
                              {formatDate(new Date(createdTimestamp * 1000).toISOString())}
                            </span>
                          )}
                          {invoice.subscriptionId && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              Abonnement
                            </span>
                          )}
                          {!invoice.subscriptionId && (
                            <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                              Achat unique
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 self-start sm:self-center">
                        {invoice.hosted_invoice_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(invoice.hosted_invoice_url || undefined, "_blank")}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Voir
                          </Button>
                        )}
                        {invoice.invoice_pdf && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(invoice.invoice_pdf || undefined, "_blank")}
                          >
                            <Receipt className="h-4 w-4 mr-2" />
                            PDF
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Modal de succès */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              Succès
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-[#0F172A]">{successMessage}</p>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setShowSuccessModal(false)}
              className="bg-[#16A34A] hover:bg-[#16A34A]/90 text-white"
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal d'erreur */}
      <Dialog open={showErrorModal} onOpenChange={setShowErrorModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Erreur
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-[#0F172A]">{errorMessage}</p>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setShowErrorModal(false)}
              variant="outline"
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

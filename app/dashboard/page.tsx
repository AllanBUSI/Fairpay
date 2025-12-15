"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ProcedureStatus, UserRole } from "@/app/generated/prisma/enums";
import { FileText, CheckCircle } from "lucide-react";

type ProcedureStatusType = "NOUVEAU" | "EN_COURS" | "RESOLU" | "ANNULE" | "EN_ATTENTE_REPONSE" | "EN_ATTENTE_RETOUR" | "LRAR" | "LRAR_ECHEANCIER" | "all";

interface Client {
  id: string;
  nom: string;
  prenom: string;
  siret: string;
  nomSociete: string | null;
}

interface Procedure {
  id: string;
  contexte: string;
  dateFactureEchue: string | null;
  status: ProcedureStatusType;
  createdAt: string;
  updatedAt: string;
  client: Client;
  numeroFacture: string | null;
}

const statusLabels: Record<ProcedureStatusType, string> = {
  NOUVEAU: "Nouveau",
  EN_COURS: "En cours",
  RESOLU: "Résolu",
  ANNULE: "Annulé",
  EN_ATTENTE_REPONSE: "En attente d'examen",
  EN_ATTENTE_RETOUR: "En attente de réponse",
  LRAR: "LRAR",
  LRAR_ECHEANCIER: "LRAR avec écheancier",
  all: "Toutes",
};

const statusColors: Record<ProcedureStatusType, string> = {
  NOUVEAU: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400",
  EN_COURS: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
  RESOLU: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
  ANNULE: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
  EN_ATTENTE_REPONSE: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
  EN_ATTENTE_RETOUR: "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400",
  LRAR: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400",
  LRAR_ECHEANCIER: "bg-teal-100 text-teal-800 dark:bg-teal-900/20 dark:text-teal-400",
  all: "",
};

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [allProcedures, setAllProcedures] = useState<Procedure[]>([]); // Pour calculer les compteurs
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProcedureStatusType>("all");
  const [error, setError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  useEffect(() => {
    // Charger toutes les procédures pour calculer les compteurs
    fetchAllProcedures();
    fetchProcedures(activeTab);
    // Vérifier si on revient d'un paiement réussi
    const paymentStatus = searchParams?.get("payment");
    const sessionId = searchParams?.get("session_id");
    
    if (paymentStatus === "success" && sessionId) {
      setPaymentSuccess(true);
      // Vérifier le statut de la session et mettre à jour si nécessaire
      checkSessionStatus(sessionId);
      // Recharger les procédures après un court délai pour laisser le temps au webhook
      setTimeout(() => {
        fetchAllProcedures();
        fetchProcedures(activeTab);
      }, 2000);
      // Masquer le message après 5 secondes
      setTimeout(() => {
        setPaymentSuccess(false);
        router.replace("/dashboard");
      }, 5000);
    } else if (paymentStatus === "success") {
      setPaymentSuccess(true);
      // Recharger les procédures pour afficher la nouvelle
      fetchAllProcedures();
      fetchProcedures(activeTab);
      // Masquer le message après 5 secondes
      setTimeout(() => {
        setPaymentSuccess(false);
        router.replace("/dashboard");
      }, 5000);
    }
  }, [activeTab, searchParams, router]);

  const fetchAllProcedures = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        return;
      }

      const response = await fetch("/api/procedures", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      const data = await response.json();

      if (response.ok) {
        const proceduresData = data.procedures || [];
        const proceduresWithStatus = proceduresData.map((p: any) => ({
          ...p,
          status: p.status || "NOUVEAU",
        }));
        setAllProcedures(proceduresWithStatus);
      }
    } catch (err) {
      console.error("Erreur lors du chargement de toutes les procédures:", err);
    }
  };

  const checkSessionStatus = async (sessionId: string) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch("/api/stripe/check-session-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId }),
      });

      const data = await response.json();
      console.log("Réponse check-session-status:", data);
      if (data.success) {
        console.log(`Procédure ${data.procedureId} mise à jour avec succès, statut: ${data.status}`);
        // Recharger les procédures après la mise à jour
        setTimeout(() => {
          fetchProcedures(activeTab);
        }, 500);
        // Recharger à nouveau après un délai plus long pour s'assurer
        setTimeout(() => {
          fetchProcedures(activeTab);
        }, 2000);
      } else {
        console.log("Échec de la mise à jour:", data);
      }
    } catch (error) {
      console.error("Erreur lors de la vérification du statut:", error);
    }
  };

  const fetchProcedures = async (status: ProcedureStatusType) => {
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const url = status === "all" 
        ? "/api/procedures" 
        : `/api/procedures?status=${status}`;
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          router.push("/login");
          return;
        }
        throw new Error(data.error || "Erreur lors du chargement");
      }

      const proceduresData = data.procedures || [];
      // S'assurer que chaque procédure a un statut
      const proceduresWithStatus = proceduresData.map((p: any) => ({
        ...p,
        status: p.status || "NOUVEAU",
      }));
      setProcedures(proceduresWithStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };


  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "Non renseigné";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Date invalide";
      return date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch (error) {
      return "Date invalide";
    }
  };

  const tabs: ProcedureStatusType[] = ["all", "NOUVEAU", "EN_COURS", "EN_ATTENTE_REPONSE", "EN_ATTENTE_RETOUR", "RESOLU", "ANNULE"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                  Gestion des procédures
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Message de succès du paiement */}
        {paymentSuccess && (
          <div className="mb-6 rounded-lg border-2 border-green-200 bg-green-50 p-4 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div className="flex-1">
              <p className="font-semibold text-green-900">Paiement réussi !</p>
              <p className="text-sm text-green-700">Votre dossier a été créé avec succès.</p>
            </div>
          </div>
        )}
        {/* Stats Cards */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{procedures.length}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">En cours</p>
                <p className="text-2xl font-bold text-blue-600">
                  {procedures.filter((p) => p.status === "EN_COURS").length}
                </p>
              </div>
              <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/20" />
            </div>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">En attente d'examen</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {procedures.filter((p) => p.status === "EN_ATTENTE_REPONSE").length}
                </p>
              </div>
              <div className="h-8 w-8 rounded-full bg-yellow-100 dark:bg-yellow-900/20" />
            </div>
          </div>
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Résolu</p>
                <p className="text-2xl font-bold text-green-600">
                  {procedures.filter((p) => p.status === "RESOLU").length}
                </p>
              </div>
              <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/20" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 rounded-lg border bg-card p-1 shadow-sm">
          <nav className="flex space-x-1">
            {tabs.map((tab) => {
              // Calculer le nombre de procédures pour ce statut
              let count = 0;
              if (tab === "all") {
                count = allProcedures.length;
              } else {
                count = allProcedures.filter((p) => p.status === tab).length;
              }

              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    activeTab === tab
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span>{statusLabels[tab]}</span>
                  {count > 0 && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        activeTab === tab
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted-foreground/20 text-muted-foreground"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Chargement...</div>
          </div>
        ) : procedures.length === 0 ? (
          <div className="rounded-lg border bg-card p-12 text-center shadow-sm">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">Aucune procédure</p>
            <p className="text-sm text-muted-foreground">
              Aucune procédure trouvée pour ce statut.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {procedures.map((procedure) => (
              <Link
                key={procedure.id}
                href={`/dashboard/${procedure.id}`}
                className="group rounded-lg border bg-card p-6 shadow-sm transition-all hover:shadow-md cursor-pointer"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-1">
                      {procedure.client?.nomSociete || `${procedure.client?.prenom || ""} ${procedure.client?.nom || ""}`.trim() || "Client non renseigné"}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      SIRET: {procedure.client?.siret || "Non renseigné"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      statusColors[procedure.status] || statusColors.NOUVEAU
                    }`}
                  >
                    {statusLabels[procedure.status] || "Nouveau"}
                  </span>
                </div>
                <p className="mb-4 line-clamp-3 text-sm text-muted-foreground">
                  {procedure.contexte}
                </p>
                <div className="flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
                  <div>
                    <span className="font-medium">Facture échue:</span>{" "}
                    {formatDate(procedure.dateFactureEchue)}
                  </div>
                  <div>
                    <span className="font-medium">Créée:</span>{" "}
                    {formatDate(procedure.createdAt)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

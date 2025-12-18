"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Scale, FileText, Loader2, CheckCircle2 } from "lucide-react";

/**
 * Interface pour une procédure
 */
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
  dateFactureEchue: string;
  status: string;
  createdAt: string;
  client: Client;
  dateEnvoiLRAR?: string | null;
}

/**
 * Page pour afficher toutes les injonctions de paiement pour les avocats et juristes
 * Affiche les dossiers en statut INJONCTION_DE_PAIEMENT et INJONCTION_DE_PAIEMENT_PAYER
 */
export default function InjonctionsPage() {
  const router = useRouter();
  const [proceduresAPayer, setProceduresAPayer] = useState<Procedure[]>([]);
  const [proceduresPayees, setProceduresPayees] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"a-payer" | "payees">("a-payer");

  useEffect(() => {
    fetchProcedures();
  }, []);

  /**
   * Récupère toutes les procédures d'injonction (à payer et payées)
   */
  const fetchProcedures = async () => {
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      // Récupérer les injonctions à payer
      const responseAPayer = await fetch("/api/procedures?status=INJONCTION_DE_PAIEMENT", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Récupérer les injonctions payées
      const responsePayees = await fetch("/api/procedures?status=INJONCTION_DE_PAIEMENT_PAYER", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!responseAPayer.ok || !responsePayees.ok) {
        if (responseAPayer.status === 401 || responsePayees.status === 401) {
          localStorage.removeItem("token");
          router.push("/login");
          return;
        }
        throw new Error("Erreur lors du chargement");
      }

      const dataAPayer = await responseAPayer.json();
      const dataPayees = await responsePayees.json();

      setProceduresAPayer(dataAPayer.procedures || []);
      setProceduresPayees(dataPayees.procedures || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Formate une date au format français
   */
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "Non renseigné";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return "Date invalide";
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
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-[#E5E7EB] bg-white">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#0F172A] flex items-center gap-3">
                <Scale className="h-8 w-8 text-[#0F172A]" />
                Injonctions de paiement
              </h1>
              <p className="text-sm text-[#0F172A]/70 mt-1 font-light">
                Dossiers éligibles pour une injonction de paiement (17 jours après l'envoi de la mise en demeure)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Onglets */}
        <div className="mb-6 rounded-xl border border-[#E5E7EB] bg-white p-1 shadow-sm overflow-hidden">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab("a-payer")}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                activeTab === "a-payer"
                  ? "bg-[#0F172A] text-white shadow-sm"
                  : "text-[#0F172A]/70 hover:bg-[#E5E7EB] hover:text-[#0F172A]"
              }`}
            >
              À payer ({proceduresAPayer.length})
            </button>
            <button
              onClick={() => setActiveTab("payees")}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                activeTab === "payees"
                  ? "bg-[#0F172A] text-white shadow-sm"
                  : "text-[#0F172A]/70 hover:bg-[#E5E7EB] hover:text-[#0F172A]"
              }`}
            >
              Payés ({proceduresPayees.length})
            </button>
          </div>
        </div>

        {/* Contenu de l'onglet "À payer" */}
        {activeTab === "a-payer" && (
          <>
            {proceduresAPayer.length === 0 ? (
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-12 text-center shadow-sm">
                <Scale className="h-12 w-12 text-[#0F172A]/40 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-[#0F172A] mb-2">
                  Aucune injonction en attente de paiement
                </h3>
                <p className="text-sm text-[#0F172A]/70">
                  Vous n'avez pas de dossiers en attente de paiement pour le moment.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {proceduresAPayer.map((procedure) => (
                  <div
                    key={procedure.id}
                    className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="rounded-full bg-amber-100 p-2">
                            <Scale className="h-5 w-5 text-amber-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-[#0F172A]">
                              {procedure.client.nomSociete || `${procedure.client.prenom} ${procedure.client.nom}`}
                            </h3>
                            <p className="text-xs text-[#0F172A]/60">
                              Dossier ID: {procedure.id.slice(0, 8)}...
                            </p>
                          </div>
                        </div>
                      </div>
                      <span className="rounded-full px-2.5 py-1 text-xs font-medium bg-amber-100 text-amber-800">
                        En attente
                      </span>
                    </div>

                    <p className="mb-4 line-clamp-3 text-sm text-[#0F172A]/70">
                      {procedure.contexte}
                    </p>

                    <div className="mb-4 space-y-2 text-xs text-[#0F172A]/60">
                      <div className="flex items-center justify-between">
                        <span>Date d'envoi LRAR:</span>
                        <span className="font-medium">{formatDate(procedure.dateEnvoiLRAR)}</span>
                      </div>
                    </div>

                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => router.push(`/dashboard/injonctions/${procedure.id}`)}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Voir le dossier
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Contenu de l'onglet "Payés" */}
        {activeTab === "payees" && (
          <>
            {proceduresPayees.length === 0 ? (
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-12 text-center shadow-sm">
                <CheckCircle2 className="h-12 w-12 text-[#0F172A]/40 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-[#0F172A] mb-2">
                  Aucune injonction payée
                </h3>
                <p className="text-sm text-[#0F172A]/70">
                  Vous n'avez pas encore de dossiers d'injonction de paiement réglés.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {proceduresPayees.map((procedure) => (
                  <div
                    key={procedure.id}
                    className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="rounded-full bg-green-100 p-2">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-[#0F172A]">
                              {procedure.client.nomSociete || `${procedure.client.prenom} ${procedure.client.nom}`}
                            </h3>
                            <p className="text-xs text-[#0F172A]/60">
                              Dossier ID: {procedure.id.slice(0, 8)}...
                            </p>
                          </div>
                        </div>
                      </div>
                      <span className="rounded-full px-2.5 py-1 text-xs font-medium bg-green-100 text-green-800">
                        Payé
                      </span>
                    </div>

                    <p className="mb-4 line-clamp-3 text-sm text-[#0F172A]/70">
                      {procedure.contexte}
                    </p>

                    <div className="mb-4 space-y-2 text-xs text-[#0F172A]/60">
                      <div className="flex items-center justify-between">
                        <span>Date d'envoi LRAR:</span>
                        <span className="font-medium">{formatDate(procedure.dateEnvoiLRAR)}</span>
                      </div>
                    </div>

                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => router.push(`/dashboard/injonctions/${procedure.id}`)}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Voir le dossier
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, CheckCircle2, XCircle, Eye, AlertCircle } from "lucide-react";
import { UserRole, ProcedureStatus, DossierAcceptation } from "@/app/generated/prisma/enums";

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
  status: ProcedureStatus;
  createdAt: string;
  acceptation: DossierAcceptation;
  avocatId: string | null;
  montantDue: number | null;
  client: Client;
}

interface User {
  id: string;
  email: string;
  role: UserRole;
}

export default function NouveauxPage() {
  const router = useRouter();
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [processing, setProcessing] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchUser();
    fetchProcedures();
  }, []);

  const fetchUser = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/user", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else if (response.status === 401) {
        localStorage.removeItem("token");
        router.push("/login");
      }
    } catch (err) {
      console.error("Erreur lors de la récupération de l'utilisateur:", err);
    }
  };

  const fetchProcedures = async () => {
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/procedures?status=NOUVEAU", {
        headers: { Authorization: `Bearer ${token}` },
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

      setProcedures(data.procedures || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (procedureId: string) => {
    if (!user) return;

    setProcessing((prev) => ({ ...prev, [procedureId]: true }));
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch(`/api/procedures/${procedureId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          avocatId: user.id,
          acceptation: DossierAcceptation.ACCEPTE,
          status: ProcedureStatus.EN_ATTENTE_REPONSE,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de l'acceptation");
      }

      // Recharger les procédures
      await fetchProcedures();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setProcessing((prev) => ({ ...prev, [procedureId]: false }));
    }
  };

  const handleRefuse = async (procedureId: string) => {
    if (!user) return;

    setProcessing((prev) => ({ ...prev, [procedureId]: true }));
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch(`/api/procedures/${procedureId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          acceptation: DossierAcceptation.REFUSE,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors du refus");
      }

      // Recharger les procédures
      await fetchProcedures();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setProcessing((prev) => ({ ...prev, [procedureId]: false }));
    }
  };

  const formatDate = (dateString: string) => {
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

  // Filtrer les procédures : seulement celles non assignées ou assignées à cet avocat
  const availableProcedures = procedures.filter(
    (p) => !p.avocatId || p.avocatId === user?.id
  );

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-[#E5E7EB] bg-white">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#0F172A] flex items-center gap-3">
                <FileText className="h-8 w-8 text-[#0F172A]" />
                Nouveaux dossiers
              </h1>
              <p className="text-sm text-[#0F172A]/70 mt-1 font-light">
                Dossiers en attente d'acceptation
              </p>
            </div>
            <Button
              variant="outline"
              onClick={fetchProcedures}
              className="flex items-center gap-2"
            >
              <Loader2 className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Actualiser
            </Button>
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

        {availableProcedures.length === 0 ? (
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-12 text-center shadow-sm">
            <FileText className="h-12 w-12 text-[#0F172A]/40 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[#0F172A] mb-2">
              Aucun nouveau dossier
            </h3>
            <p className="text-sm text-[#0F172A]/70">
              Il n'y a actuellement aucun nouveau dossier en attente d'acceptation.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {availableProcedures.map((procedure) => {
              const isAssigned = procedure.avocatId === user?.id;
              const isAccepted = procedure.acceptation === DossierAcceptation.ACCEPTE;
              const isRefused = procedure.acceptation === DossierAcceptation.REFUSE;

              return (
                <div
                  key={procedure.id}
                  className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="mb-4 flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`rounded-full p-2 ${
                          isAccepted
                            ? "bg-green-100"
                            : isRefused
                            ? "bg-red-100"
                            : "bg-blue-100"
                        }`}>
                          {isAccepted ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : isRefused ? (
                            <XCircle className="h-5 w-5 text-red-600" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-blue-600" />
                          )}
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
                    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      isAccepted
                        ? "bg-green-100 text-green-800"
                        : isRefused
                        ? "bg-red-100 text-red-800"
                        : "bg-blue-100 text-blue-800"
                    }`}>
                      {isAccepted
                        ? "Accepté"
                        : isRefused
                        ? "Refusé"
                        : isAssigned
                        ? "Assigné"
                        : "Disponible"}
                    </span>
                  </div>

                  <p className="mb-4 line-clamp-3 text-sm text-[#0F172A]/70">
                    {procedure.contexte}
                  </p>

                  <div className="mb-4 space-y-2 text-xs text-[#0F172A]/60">
                    <div className="flex items-center justify-between">
                      <span>Montant dû:</span>
                      <span className="font-medium">
                        {procedure.montantDue ? `${procedure.montantDue.toFixed(2)} €` : "N/A"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Facture échue:</span>
                      <span className="font-medium">{formatDate(procedure.dateFactureEchue)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Créé le:</span>
                      <span className="font-medium">{formatDate(procedure.createdAt)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Link href={`/dashboard/${procedure.id}`}>
                      <Button variant="outline" className="w-full">
                        <Eye className="mr-2 h-4 w-4" />
                        Voir le dossier
                      </Button>
                    </Link>
                    {!isAccepted && !isRefused && (
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleAccept(procedure.id)}
                          disabled={processing[procedure.id]}
                          className="flex-1 bg-[#16A34A] hover:bg-[#16A34A]/90 text-white"
                        >
                          {processing[procedure.id] ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Traitement...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="mr-2 h-4 w-4" />
                              Accepter
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() => handleRefuse(procedure.id)}
                          disabled={processing[procedure.id]}
                          variant="outline"
                          className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                        >
                          {processing[procedure.id] ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Traitement...
                            </>
                          ) : (
                            <>
                              <XCircle className="mr-2 h-4 w-4" />
                              Refuser
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, AlertCircle, Trash2 } from "lucide-react";

interface Procedure {
  id: string;
  status: string;
  contexte: string;
  montantDue: number | null;
  createdAt: string;
  client: {
    nom: string;
    prenom: string;
    nomSociete: string | null;
  } | null;
  paymentStatus: string | null;
}

export default function BrouillonsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchBrouillons();
  }, []);

  const fetchBrouillons = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/procedures?status=BROUILLONS", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProcedures(data.procedures || []);
      } else if (response.status === 401) {
        localStorage.removeItem("token");
        router.push("/login");
      } else {
        setError("Erreur lors du chargement des brouillons");
      }
    } catch (err) {
      console.error("Erreur:", err);
      setError("Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };


  const handleDelete = async (procedureId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce brouillon ? Cette action est irréversible.")) {
      return;
    }

    setDeletingId(procedureId);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch(`/api/procedures/${procedureId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        // Retirer le brouillon de la liste
        setProcedures(procedures.filter((p) => p.id !== procedureId));
      } else {
        const data = await response.json();
        setError(data.error || "Erreur lors de la suppression du brouillon");
      }
    } catch (err) {
      setError("Erreur lors de la suppression du brouillon");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-4" />
          <p className="text-muted-foreground">Chargement des brouillons...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Brouillons</h1>
            {procedures.length > 0 && (
              <span className="rounded-full bg-yellow-100 text-yellow-800 px-3 py-1 text-sm font-semibold">
                {procedures.length}
              </span>
            )}
          </div>
          <p className="mt-2 text-muted-foreground">
            Dossiers en attente de paiement ou dont le paiement a échoué
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        )}

        {procedures.length === 0 ? (
          <div className="rounded-lg border bg-card p-12 text-center shadow-sm">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun brouillon</h3>
            <p className="text-muted-foreground mb-6">
              Vous n'avez aucun dossier en brouillon pour le moment.
            </p>
            <Button onClick={() => router.push("/dashboard/new")}>
              Créer un nouveau dossier
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {procedures.map((procedure) => (
              <div
                key={procedure.id}
                className="rounded-lg border bg-card p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="flex-1 w-full">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold">
                        {procedure.client?.nomSociete || `${procedure.client?.prenom || ""} ${procedure.client?.nom || ""}`.trim() || "Client non renseigné"}
                      </h3>
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                        Brouillon
                      </span>
                      {procedure.paymentStatus === "FAILED" && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                          Paiement échoué
                        </span>
                      )}
                      {!procedure.paymentStatus && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                          Non payé
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                      {procedure.contexte}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        Montant: {procedure.montantDue ? `${procedure.montantDue.toFixed(2)} €` : "N/A"}
                      </span>
                      <span>
                        Créé le: {new Date(procedure.createdAt).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <Button
                      variant="outline"
                      className="flex-1 md:flex-none"
                      onClick={() => router.push(`/dashboard/${procedure.id}`)}
                    >
                      Voir
                    </Button>
                    <Button
                      className="flex-1 md:flex-none"
                      onClick={() => router.push(`/dashboard/new?id=${procedure.id}`)}
                    >
                      Compléter et payer
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleDelete(procedure.id)}
                      disabled={deletingId === procedure.id}
                      className="flex-1 md:flex-none text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      {deletingId === procedure.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Suppression...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Supprimer
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


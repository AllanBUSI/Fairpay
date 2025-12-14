"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, User, Briefcase } from "lucide-react";
import Link from "next/link";
import { UserRole } from "@/app/generated/prisma/enums";

interface Client {
  id: string;
  nom: string;
  prenom: string;
  siret: string;
}

interface Procedure {
  id: string;
  contexte: string;
  dateFactureEchue: string;
  status: string;
  createdAt: string;
  client: Client;
}

interface User {
  id: string;
  email: string;
  role: UserRole;
}

export default function NouveauxDossiersPage() {
  const router = useRouter();
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [takingDossier, setTakingDossier] = useState<string | null>(null);

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
        headers: {
          Authorization: `Bearer ${token}`,
        },
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

      setProcedures(data.procedures || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  const handleTakeDossier = async (procedureId: string) => {
    if (!user || user.role !== UserRole.AVOCAT) return;

    setTakingDossier(procedureId);
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
          status: "EN_ATTENTE_REPONSE",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la prise du dossier");
      }

      // Rafraîchir la liste
      await fetchProcedures();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setTakingDossier(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="text-muted-foreground">Chargement...</div>
        </div>
      </div>
    );
  }

  if (user && user.role !== UserRole.AVOCAT) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="rounded-lg border bg-card p-6 shadow-sm">
            <p className="text-destructive">Vous n'avez pas accès à cette page.</p>
            <Link href="/dashboard">
              <Button variant="outline" className="mt-4">
                Retour au dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Nouveaux dossiers</h1>
                <p className="text-sm text-muted-foreground">
                  {procedures.length} {procedures.length > 1 ? "dossiers disponibles" : "dossier disponible"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {procedures.length === 0 ? (
          <div className="rounded-lg border bg-card p-12 text-center shadow-sm">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucun nouveau dossier</h3>
            <p className="text-sm text-muted-foreground">
              Il n'y a actuellement aucun nouveau dossier disponible.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {procedures.map((procedure) => (
              <div
                key={procedure.id}
                className="group relative rounded-lg border bg-card p-6 shadow-sm transition-all hover:shadow-md"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-1">
                      {procedure.client.prenom} {procedure.client.nom}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      SIRET: {procedure.client.siret}
                    </p>
                  </div>
                  <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-800 dark:bg-purple-900/20 dark:text-purple-400">
                    Nouveau
                  </span>
                </div>

                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {procedure.contexte}
                </p>

                <div className="space-y-2 border-t pt-4">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Facture échue:</span>
                    <span className="font-medium">{formatDate(procedure.dateFactureEchue)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Créée:</span>
                    <span className="font-medium">{formatDate(procedure.createdAt)}</span>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <Link href={`/dashboard/${procedure.id}`} className="flex-1">
                    <Button variant="outline" className="w-full" size="sm">
                      <FileText className="mr-2 h-4 w-4" />
                      Voir le dossier
                    </Button>
                  </Link>
                  {user && user.role === UserRole.AVOCAT && (
                    <Button
                      onClick={() => handleTakeDossier(procedure.id)}
                      disabled={takingDossier === procedure.id}
                      className="flex-1"
                      size="sm"
                    >
                      <Briefcase className="mr-2 h-4 w-4" />
                      {takingDossier === procedure.id ? "En cours..." : "Prendre"}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


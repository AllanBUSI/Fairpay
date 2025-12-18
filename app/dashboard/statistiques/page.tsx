"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  FileText,
  CheckCircle2,
  Clock,
  Loader2,
  Calendar,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import Link from "next/link";
import { ProcedureStatus } from "@/app/generated/prisma/enums";

interface Statistics {
  statusCounts: { status: string; count: number }[];
  totalProcedures: number;
  totalAmount: number;
  totalResolved: number;
  totalResolvedAmount: number;
  totalPayments: number;
  paymentsCount: number;
  amountsByStatus: { status: string; amount: number }[];
  resolutionRate: number;
  avgResolutionDays: number;
  dailyStats: { date: string; count: number; amount: number }[];
  monthlyStats: { month: string; count: number; amount: number; resolved: number }[];
  recentPayments: any[];
  recentProcedures: any[];
}

const statusLabels: Record<string, string> = {
  NOUVEAU: "Nouveau",
  EN_COURS: "En cours",
  RESOLU: "Résolu",
  ANNULE: "Annulé",
  EN_ATTENTE_REPONSE: "En attente de réponse",
  EN_ATTENTE_RETOUR: "En attente de retour",
  LRAR_FINI: "LRAR terminé",
  ENVOYE: "Envoyé",
  INJONCTION_DE_PAIEMENT: "Injonction de paiement",
  INJONCTION_DE_PAIEMENT_PAYER: "Injonction payée",
};

const statusColors: Record<string, string> = {
  NOUVEAU: "bg-blue-100 text-blue-800",
  EN_COURS: "bg-yellow-100 text-yellow-800",
  RESOLU: "bg-green-100 text-green-800",
  ANNULE: "bg-red-100 text-red-800",
  EN_ATTENTE_REPONSE: "bg-orange-100 text-orange-800",
  EN_ATTENTE_RETOUR: "bg-purple-100 text-purple-800",
  LRAR_FINI: "bg-indigo-100 text-indigo-800",
  ENVOYE: "bg-teal-100 text-teal-800",
  INJONCTION_DE_PAIEMENT: "bg-amber-100 text-amber-800",
  INJONCTION_DE_PAIEMENT_PAYER: "bg-emerald-100 text-emerald-800",
};

export default function StatistiquesPage() {
  const router = useRouter();
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchStatistics();
  }, []);

  const fetchStatistics = async () => {
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/statistics", {
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

      setStatistics(data.statistics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#0F172A] mx-auto mb-4" />
          <p className="text-[#0F172A]/70">Chargement des statistiques...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={fetchStatistics}>Réessayer</Button>
        </div>
      </div>
    );
  }

  if (!statistics) {
    return null;
  }

  // Calculer les montants en attente
  const pendingAmount = statistics.totalAmount - statistics.totalResolvedAmount;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-[#E5E7EB] bg-white">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#0F172A] flex items-center gap-3">
                <BarChart3 className="h-8 w-8 text-[#0F172A]" />
                Statistiques
              </h1>
              <p className="text-sm text-[#0F172A]/70 mt-1 font-light">
                Vue d'ensemble de votre activité
              </p>
            </div>
            <Button
              variant="outline"
              onClick={fetchStatistics}
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
        {/* Cartes de statistiques principales */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
          {/* Total des procédures */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F172A]/70 mb-1">Total des dossiers</p>
                <p className="text-2xl font-bold text-[#0F172A]">
                  {statistics.totalProcedures}
                </p>
              </div>
              <div className="rounded-full bg-blue-100 p-3">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Montant total */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F172A]/70 mb-1">Montant total</p>
                <p className="text-2xl font-bold text-[#0F172A]">
                  {formatCurrency(statistics.totalAmount)}
                </p>
              </div>
              <div className="rounded-full bg-green-100 p-3">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          {/* Montant récupéré */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F172A]/70 mb-1">Montant récupéré</p>
                <p className="text-2xl font-bold text-[#0F172A]">
                  {formatCurrency(statistics.totalResolvedAmount)}
                </p>
                <p className="text-xs text-[#0F172A]/60 mt-1">
                  {statistics.totalResolved} dossiers résolus
                </p>
              </div>
              <div className="rounded-full bg-emerald-100 p-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </div>

          {/* Taux de résolution */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F172A]/70 mb-1">Taux de résolution</p>
                <p className="text-2xl font-bold text-[#0F172A]">
                  {statistics.resolutionRate.toFixed(1)}%
                </p>
                <p className="text-xs text-[#0F172A]/60 mt-1">
                  {statistics.avgResolutionDays.toFixed(1)} jours en moyenne
                </p>
              </div>
              <div className="rounded-full bg-purple-100 p-3">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Deuxième ligne de cartes */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
          {/* Montant en attente */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F172A]/70 mb-1">Montant en attente</p>
                <p className="text-2xl font-bold text-[#0F172A]">
                  {formatCurrency(pendingAmount)}
                </p>
              </div>
              <div className="rounded-full bg-amber-100 p-3">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
            </div>
          </div>

          {/* Paiements effectués */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F172A]/70 mb-1">Paiements effectués</p>
                <p className="text-2xl font-bold text-[#0F172A]">
                  {formatCurrency(statistics.totalPayments)}
                </p>
                <p className="text-xs text-[#0F172A]/60 mt-1">
                  {statistics.paymentsCount} transactions
                </p>
              </div>
              <div className="rounded-full bg-indigo-100 p-3">
                <DollarSign className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
          </div>

          {/* Dossiers résolus */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[#0F172A]/70 mb-1">Dossiers résolus</p>
                <p className="text-2xl font-bold text-[#0F172A]">
                  {statistics.totalResolved}
                </p>
                <p className="text-xs text-[#0F172A]/60 mt-1">
                  sur {statistics.totalProcedures} au total
                </p>
              </div>
              <div className="rounded-full bg-green-100 p-3">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Graphiques et tableaux */}
        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          {/* Répartition par statut */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Répartition par statut
            </h2>
            <div className="space-y-3">
              {statistics.statusCounts
                .sort((a, b) => b.count - a.count)
                .map((item) => (
                  <div key={item.status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          statusColors[item.status] || "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {statusLabels[item.status] || item.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-[#2563EB] h-2 rounded-full"
                          style={{
                            width: `${
                              (item.count / statistics.totalProcedures) * 100
                            }%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-[#0F172A] w-12 text-right">
                        {item.count}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Montants par statut */}
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Montants par statut
            </h2>
            <div className="space-y-3">
              {statistics.amountsByStatus
                .filter((item) => item.amount > 0)
                .sort((a, b) => b.amount - a.amount)
                .map((item) => (
                  <div key={item.status} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-1">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          statusColors[item.status] || "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {statusLabels[item.status] || item.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-32 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-[#16A34A] h-2 rounded-full"
                          style={{
                            width: `${
                              statistics.totalAmount > 0
                                ? (item.amount / statistics.totalAmount) * 100
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-semibold text-[#0F172A] w-24 text-right">
                        {formatCurrency(item.amount)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* Évolution mensuelle */}
        {statistics.monthlyStats.length > 0 && (
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm mb-8">
            <h2 className="text-lg font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Évolution mensuelle (6 derniers mois)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#E5E7EB]">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-[#0F172A]">
                      Mois
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-[#0F172A]">
                      Dossiers créés
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-[#0F172A]">
                      Montant total
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-[#0F172A]">
                      Résolus
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {statistics.monthlyStats.map((stat) => (
                    <tr key={stat.month} className="border-b border-[#E5E7EB] hover:bg-gray-50">
                      <td className="py-3 px-4 text-sm text-[#0F172A]">
                        {new Date(stat.month + "-01").toLocaleDateString("fr-FR", {
                          month: "long",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-[#0F172A] font-medium">
                        {stat.count}
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-[#0F172A] font-medium">
                        {formatCurrency(stat.amount)}
                      </td>
                      <td className="py-3 px-4 text-sm text-right text-[#0F172A] font-medium">
                        <span className="text-green-600">{stat.resolved}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Dernières procédures */}
        {statistics.recentProcedures.length > 0 && (
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm mb-8">
            <h2 className="text-lg font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Dernières procédures (7 derniers jours)
            </h2>
            <div className="space-y-3">
              {statistics.recentProcedures.map((procedure) => (
                <Link
                  key={procedure.id}
                  href={`/dashboard/${procedure.id}`}
                  className="block p-4 rounded-lg border border-[#E5E7EB] hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#0F172A] mb-1">
                        {procedure.client.nomSociete ||
                          `${procedure.client.prenom} ${procedure.client.nom}`}
                      </p>
                      <p className="text-xs text-[#0F172A]/60 line-clamp-1">
                        {procedure.contexte}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-[#0F172A]">
                          {formatCurrency(procedure.montantDue || 0)}
                        </p>
                        <p className="text-xs text-[#0F172A]/60">
                          {formatDate(procedure.createdAt)}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          statusColors[procedure.status] || "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {statusLabels[procedure.status] || procedure.status}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Paiements récents */}
        {statistics.recentPayments.length > 0 && (
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Paiements récents
            </h2>
            <div className="space-y-3">
              {statistics.recentPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="p-4 rounded-lg border border-[#E5E7EB] bg-green-50/50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-[#0F172A] mb-1">
                        {payment.description || "Paiement"}
                      </p>
                      {payment.procedure && (
                        <p className="text-xs text-[#0F172A]/60 line-clamp-1">
                          {payment.procedure.contexte}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-green-600">
                          {formatCurrency(payment.amount)}
                        </p>
                        <p className="text-xs text-[#0F172A]/60">
                          {formatDate(payment.createdAt)}
                        </p>
                      </div>
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


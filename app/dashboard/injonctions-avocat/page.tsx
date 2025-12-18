"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Scale, FileText, Loader2, Eye, Download, File, Image as ImageIcon, Calendar, Euro, CheckCircle } from "lucide-react";
import { UserRole } from "@/app/generated/prisma/enums";
import { DocumentViewer } from "@/components/ui/document-viewer";

/**
 * Interface pour une procédure avec tous les détails
 */
interface Client {
  id: string;
  nom: string;
  prenom: string;
  siret: string;
  nomSociete: string | null;
  adresse: string | null;
  email: string | null;
  telephone: string | null;
}

interface Document {
  id: string;
  type: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

interface Procedure {
  id: string;
  contexte: string;
  dateFactureEchue: string;
  montantDue: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  dateEnvoiLRAR: string | null;
  client: Client;
  documents: Document[];
  avocatId: string | null;
}

interface InjonctionFiles {
  kbisFilePath: string | null;
  attestationFilePath: string | null;
}

interface User {
  id: string;
  email: string;
  role: UserRole;
}

const documentTypeLabels: Record<string, string> = {
  FACTURE: "Facture",
  DEVIS: "Devis",
  CONTRAT: "Contrat",
  EMAIL: "Email",
  WHATSAPP_SMS: "WhatsApp/SMS",
  AUTRES_PREUVES: "Autres preuves",
};

const statusLabels: Record<string, string> = {
  INJONCTION_DE_PAIEMENT: "À faire",
  INJONCTION_DE_PAIEMENT_PAYER: "Payée",
  INJONCTION_DE_PAIEMENT_FINI: "Fini",
};

const statusColors: Record<string, string> = {
  INJONCTION_DE_PAIEMENT: "bg-amber-100 text-amber-800 border-amber-200",
  INJONCTION_DE_PAIEMENT_PAYER: "bg-amber-100 text-amber-800 border-amber-200",
  INJONCTION_DE_PAIEMENT_FINI: "bg-blue-100 text-blue-800 border-blue-200",
};

function formatDate(dateString: string | null): string {
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
}

function formatAmount(amount: number | null): string {
  if (amount === null) return "Non renseigné";
  return `${amount.toFixed(2)} €`;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

function isPDF(mimeType: string): boolean {
  return mimeType === "application/pdf" || mimeType.includes("pdf");
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

/**
 * Page dédiée pour les avocats et juristes pour voir toutes les injonctions de paiement
 * avec tous les documents disponibles
 */
export default function InjonctionsAvocatPage() {
  const router = useRouter();
  const [proceduresAFaire, setProceduresAFaire] = useState<Procedure[]>([]);
  const [proceduresFini, setProceduresFini] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"a-faire" | "fini">("a-faire");
  const [user, setUser] = useState<User | null>(null);
  const [expandedProcedure, setExpandedProcedure] = useState<string | null>(null);
  const [injonctionFiles, setInjonctionFiles] = useState<Record<string, InjonctionFiles>>({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [procedureToMarkAsDone, setProcedureToMarkAsDone] = useState<string | null>(null);
  const [markingAsDone, setMarkingAsDone] = useState(false);

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

  /**
   * Récupère toutes les procédures d'injonction avec tous les détails
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

      // Récupérer les injonctions à faire (INJONCTION_DE_PAIEMENT et INJONCTION_DE_PAIEMENT_PAYER)
      const responseAFaire1 = await fetch("/api/procedures?status=INJONCTION_DE_PAIEMENT", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const responseAFaire2 = await fetch("/api/procedures?status=INJONCTION_DE_PAIEMENT_PAYER", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Récupérer les injonctions finies (INJONCTION_DE_PAIEMENT_FINI)
      const responseFini = await fetch("/api/procedures?status=INJONCTION_DE_PAIEMENT_FINI", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      let proceduresAFaireData: any[] = [];
      if (responseAFaire1.ok) {
        const dataAFaire1 = await responseAFaire1.json();
        proceduresAFaireData = [...proceduresAFaireData, ...(dataAFaire1.procedures || [])];
      }
      if (responseAFaire2.ok) {
        const dataAFaire2 = await responseAFaire2.json();
        proceduresAFaireData = [...proceduresAFaireData, ...(dataAFaire2.procedures || [])];
      }

      let proceduresFiniData: any[] = [];
      if (responseFini.ok) {
        const dataFini = await responseFini.json();
        proceduresFiniData = dataFini.procedures || [];
      }

      if ((!responseAFaire1.ok && responseAFaire1.status !== 404) || (!responseAFaire2.ok && responseAFaire2.status !== 404)) {
        if (responseAFaire1.status === 401 || responseAFaire2.status === 401) {
          localStorage.removeItem("token");
          router.push("/login");
          return;
        }
        throw new Error("Erreur lors du chargement");
      }

      // Récupérer les détails complets pour chaque procédure
      const proceduresAFaireWithDetails = await Promise.all(
        proceduresAFaireData.map(async (p: any) => {
          const detailResponse = await fetch(`/api/procedures/${p.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (detailResponse.ok) {
            const detailData = await detailResponse.json();
            return detailData.procedure;
          }
          return p;
        })
      );

      const proceduresFiniWithDetails = await Promise.all(
        proceduresFiniData.map(async (p: any) => {
          const detailResponse = await fetch(`/api/procedures/${p.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (detailResponse.ok) {
            const detailData = await detailResponse.json();
            return detailData.procedure;
          }
          return p;
        })
      );

      setProceduresAFaire(proceduresAFaireWithDetails);
      setProceduresFini(proceduresFiniWithDetails);

      // Récupérer les fichiers d'injonction pour toutes les procédures
      const allProcedures = [...proceduresAFaireWithDetails, ...proceduresFiniWithDetails];
      const filesMap: Record<string, InjonctionFiles> = {};
      
      await Promise.all(
        allProcedures.map(async (p: Procedure) => {
          const filesResponse = await fetch(`/api/procedures/${p.id}/injonction-files`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (filesResponse.ok) {
            const filesData = await filesResponse.json();
            filesMap[p.id] = filesData;
          }
        })
      );

      setInjonctionFiles(filesMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = async (procedureId: string) => {
    if (expandedProcedure === procedureId) {
      setExpandedProcedure(null);
    } else {
      setExpandedProcedure(procedureId);
      // Charger les fichiers d'injonction si pas déjà chargés
      if (!injonctionFiles[procedureId]) {
        try {
          const token = localStorage.getItem("token");
          if (!token) return;

          const filesResponse = await fetch(`/api/procedures/${procedureId}/injonction-files`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (filesResponse.ok) {
            const filesData = await filesResponse.json();
            setInjonctionFiles((prev) => ({
              ...prev,
              [procedureId]: filesData,
            }));
          }
        } catch (err) {
          console.error("Erreur lors du chargement des fichiers:", err);
        }
      }
    }
  };

  const handleMarkAsDone = (procedureId: string) => {
    setProcedureToMarkAsDone(procedureId);
    setShowConfirmModal(true);
  };

  const confirmMarkAsDone = async () => {
    if (!procedureToMarkAsDone) return;

    setMarkingAsDone(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      // Changer le statut (l'email sera envoyé automatiquement par l'API)
      const response = await fetch(`/api/procedures/${procedureToMarkAsDone}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: "INJONCTION_DE_PAIEMENT_FINI",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors du changement de statut");
      }

      // Recharger les procédures
      await fetchProcedures();
      setShowConfirmModal(false);
      setProcedureToMarkAsDone(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setMarkingAsDone(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#0F172A] mx-auto mb-4" />
          <p className="text-[#0F172A]/70">Chargement des injonctions...</p>
        </div>
      </div>
    );
  }

  const procedures = activeTab === "a-faire" ? proceduresAFaire : proceduresFini;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-[#E5E7EB] bg-white">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-[#0F172A] flex items-center gap-3">
                <Scale className="h-8 w-8 text-amber-600" />
                Injonctions de paiement
              </h1>
              <p className="text-sm text-[#0F172A]/70 mt-1 font-light">
                Vue complète de tous les dossiers d'injonction avec documents disponibles
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
              onClick={() => setActiveTab("a-faire")}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                activeTab === "a-faire"
                  ? "bg-[#0F172A] text-white shadow-sm"
                  : "text-[#0F172A]/70 hover:bg-[#E5E7EB] hover:text-[#0F172A]"
              }`}
            >
              À faire ({proceduresAFaire.length})
            </button>
            <button
              onClick={() => setActiveTab("fini")}
              className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                activeTab === "fini"
                  ? "bg-[#0F172A] text-white shadow-sm"
                  : "text-[#0F172A]/70 hover:bg-[#E5E7EB] hover:text-[#0F172A]"
              }`}
            >
              Fini ({proceduresFini.length})
            </button>
          </div>
        </div>

        {/* Liste des procédures */}
        {procedures.length === 0 ? (
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-12 text-center shadow-sm">
            <Scale className="h-12 w-12 text-[#0F172A]/40 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[#0F172A] mb-2">
              Aucune injonction {activeTab === "a-faire" ? "à faire" : "finie"}
            </h3>
            <p className="text-sm text-[#0F172A]/70">
              {activeTab === "a-faire"
                ? "Vous n'avez pas de dossiers d'injonction à traiter pour le moment."
                : "Vous n'avez pas encore de dossiers d'injonction terminés."}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {procedures.map((procedure) => {
              const isExpanded = expandedProcedure === procedure.id;
              const files = injonctionFiles[procedure.id];
              const isAssigned = procedure.avocatId === user?.id;

              return (
                <div
                  key={procedure.id}
                  className="rounded-xl border border-[#E5E7EB] bg-white shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* En-tête de la procédure */}
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`rounded-full p-2 ${
                            procedure.status === "INJONCTION_DE_PAIEMENT_FINI"
                              ? "bg-blue-100"
                              : "bg-amber-100"
                          }`}>
                            <Scale className={`h-5 w-5 ${
                              procedure.status === "INJONCTION_DE_PAIEMENT_FINI"
                                ? "text-blue-600"
                                : "text-amber-600"
                            }`} />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-[#0F172A]">
                              {procedure.client.nomSociete || `${procedure.client.prenom} ${procedure.client.nom}`}
                            </h3>
                            <p className="text-xs text-[#0F172A]/60">
                              Dossier ID: {procedure.id.slice(0, 8)}... • SIRET: {procedure.client.siret}
                            </p>
                          </div>
                          <span className={`rounded-full px-3 py-1 text-xs font-medium border ${
                            statusColors[procedure.status] || "bg-gray-100 text-gray-800 border-gray-200"
                          }`}>
                            {statusLabels[procedure.status] || procedure.status}
                          </span>
                        </div>
                        {isAssigned && (
                          <div className="ml-11 mb-2">
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              <FileText className="h-3 w-3" />
                              Dossier assigné
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Informations principales */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-4 w-4 text-[#0F172A]/60" />
                        <div>
                          <p className="text-xs text-[#0F172A]/60">Date facture échue</p>
                          <p className="font-medium text-[#0F172A]">{formatDate(procedure.dateFactureEchue)}</p>
                        </div>
                      </div>
                      {procedure.montantDue !== null && (
                        <div className="flex items-center gap-2 text-sm">
                          <Euro className="h-4 w-4 text-[#0F172A]/60" />
                          <div>
                            <p className="text-xs text-[#0F172A]/60">Montant dû</p>
                            <p className="font-medium text-[#0F172A]">{formatAmount(procedure.montantDue)}</p>
                          </div>
                        </div>
                      )}
                      {procedure.dateEnvoiLRAR && (
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="h-4 w-4 text-[#0F172A]/60" />
                          <div>
                            <p className="text-xs text-[#0F172A]/60">Envoi LRAR</p>
                            <p className="font-medium text-[#0F172A]">{formatDate(procedure.dateEnvoiLRAR)}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Contexte */}
                    <div className="mb-4">
                      <p className="text-sm text-[#0F172A]/70 line-clamp-2">{procedure.contexte}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        onClick={() => toggleExpand(procedure.id)}
                        className="flex-1"
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        {isExpanded ? "Masquer les documents" : "Voir tous les documents"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => router.push(`/dashboard/injonctions/${procedure.id}`)}
                      >
                        <FileText className="mr-2 h-4 w-4" />
                        Détails complets
                      </Button>
                      {(procedure.status === "INJONCTION_DE_PAIEMENT" || procedure.status === "INJONCTION_DE_PAIEMENT_PAYER") && (
                        <Button
                          onClick={() => handleMarkAsDone(procedure.id)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Traité
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Section développée avec tous les documents */}
                  {isExpanded && (
                    <div className="border-t border-[#E5E7EB] bg-[#F9FAFB] p-6 space-y-6">
                      {/* Documents d'injonction */}
                      {(procedure.status === "INJONCTION_DE_PAIEMENT" ||
                        procedure.status === "INJONCTION_DE_PAIEMENT_PAYER") && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                          <h4 className="text-base font-semibold text-amber-900 mb-3 flex items-center gap-2">
                            <Scale className="h-5 w-5" />
                            Documents d'injonction de paiement
                          </h4>
                          {files ? (
                            <div className="space-y-3">
                              {files.kbisFilePath ? (
                                <div className="rounded border border-amber-200 bg-white p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <File className="h-4 w-4 text-amber-600" />
                                      <span className="text-sm font-medium text-amber-900">Kbis de moins de 3 mois</span>
                                    </div>
                                    <a
                                      href={files.kbisFilePath}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <Button variant="outline" size="sm">
                                        <Download className="mr-2 h-3 w-3" />
                                        Télécharger
                                      </Button>
                                    </a>
                                  </div>
                                  <div className="mt-2 rounded border bg-white">
                                    <DocumentViewer
                                      url={files.kbisFilePath}
                                      mimeType="application/pdf"
                                      fileName="Kbis"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm text-amber-700">Kbis non disponible</p>
                              )}
                              {files.attestationFilePath ? (
                                <div className="rounded border border-amber-200 bg-white p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <FileText className="h-4 w-4 text-amber-600" />
                                      <span className="text-sm font-medium text-amber-900">Attestation sur l'honneur signée</span>
                                    </div>
                                    <a
                                      href={files.attestationFilePath}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                    >
                                      <Button variant="outline" size="sm">
                                        <Download className="mr-2 h-3 w-3" />
                                        Télécharger
                                      </Button>
                                    </a>
                                  </div>
                                  <div className="mt-2 rounded border bg-white">
                                    <DocumentViewer
                                      url={files.attestationFilePath}
                                      mimeType="application/pdf"
                                      fileName="Attestation sur l'honneur"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <p className="text-sm text-amber-700">Attestation non disponible</p>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-amber-700">Chargement des documents...</p>
                          )}
                        </div>
                      )}

                      {/* Tous les documents */}
                      <div>
                        <h4 className="text-base font-semibold text-[#0F172A] mb-3 flex items-center gap-2">
                          <FileText className="h-5 w-5" />
                          Tous les documents ({procedure.documents?.length || 0})
                        </h4>
                        {!procedure.documents || procedure.documents.length === 0 ? (
                          <p className="text-sm text-[#0F172A]/60">Aucun document associé</p>
                        ) : (
                          <div className="space-y-3">
                            {procedure.documents.map((document) => {
                              if (!document.filePath || document.filePath.trim() === "") {
                                return null;
                              }

                              return (
                                <div key={document.id} className="rounded-lg border border-[#E5E7EB] bg-white p-3">
                                  <div className="flex items-start justify-between mb-2">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        {isImage(document.mimeType) ? (
                                          <ImageIcon className="h-4 w-4 text-[#0F172A]/60" />
                                        ) : isPDF(document.mimeType) ? (
                                          <File className="h-4 w-4 text-[#0F172A]/60" />
                                        ) : (
                                          <FileText className="h-4 w-4 text-[#0F172A]/60" />
                                        )}
                                        <span className="text-sm font-medium text-[#0F172A]">
                                          {documentTypeLabels[document.type] || document.type}
                                        </span>
                                      </div>
                                      <p className="text-xs text-[#0F172A]/60">{document.fileName}</p>
                                      <p className="text-xs text-[#0F172A]/50 mt-1">
                                        {formatFileSize(document.fileSize)} • {formatDate(document.createdAt)}
                                      </p>
                                    </div>
                                    <a
                                      href={document.filePath}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="ml-3"
                                    >
                                      <Button variant="outline" size="sm">
                                        <Download className="mr-2 h-3 w-3" />
                                        Télécharger
                                      </Button>
                                    </a>
                                  </div>
                                  {(isPDF(document.mimeType) || isImage(document.mimeType)) && (
                                    <div className="mt-2 rounded border bg-white">
                                      <DocumentViewer
                                        url={document.filePath}
                                        mimeType={document.mimeType || "application/octet-stream"}
                                        fileName={document.fileName}
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de confirmation */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-[#0F172A]">
              Marquer comme traité
            </DialogTitle>
            <DialogDescription className="text-[#0F172A]/70">
              Êtes-vous sûr de vouloir marquer ce dossier d'injonction comme traité ? Cette action changera le statut du dossier vers "Fini".
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-[#0F172A]/70">
              Le dossier sera déplacé dans l'onglet "Fini" et ne sera plus visible dans "À faire".
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowConfirmModal(false);
                setProcedureToMarkAsDone(null);
              }}
              disabled={markingAsDone}
            >
              Annuler
            </Button>
            <Button
              onClick={confirmMarkAsDone}
              disabled={markingAsDone}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {markingAsDone ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Traitement...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Confirmer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


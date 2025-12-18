"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Scale, FileText, Download, Loader2, File, Image as ImageIcon } from "lucide-react";
import { DocumentViewer } from "@/components/ui/document-viewer";

interface Client {
  id: string;
  nom: string;
  prenom: string;
  siret: string;
  nomSociete: string | null;
  adresse: string | null;
  codePostal: string | null;
  ville: string | null;
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
  dateEnvoiLRAR: string | null;
  createdAt: string;
  updatedAt: string;
  client: Client;
  documents: Document[];
}

interface InjonctionFiles {
  kbisFilePath: string | null;
  attestationFilePath: string | null;
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
  INJONCTION_DE_PAIEMENT: "Injonction de paiement",
  INJONCTION_DE_PAIEMENT_PAYER: "Injonction de paiement payée",
};

const statusColors: Record<string, string> = {
  INJONCTION_DE_PAIEMENT: "bg-amber-100 text-amber-800",
  INJONCTION_DE_PAIEMENT_PAYER: "bg-green-100 text-green-800",
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

export default function SaisirTribunalDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [procedure, setProcedure] = useState<Procedure | null>(null);
  const [injonctionFiles, setInjonctionFiles] = useState<InjonctionFiles | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchProcedure();
  }, [params["id"]]);

  const fetchProcedure = async () => {
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const procedureId = params["id"] as string;

      // Récupérer la procédure
      const procedureResponse = await fetch(`/api/procedures/${procedureId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!procedureResponse.ok) {
        if (procedureResponse.status === 401) {
          localStorage.removeItem("token");
          router.push("/login");
          return;
        }
        throw new Error("Erreur lors du chargement de la procédure");
      }

      const procedureData = await procedureResponse.json();
      setProcedure(procedureData.procedure);

      // Récupérer les fichiers d'injonction si la procédure est en statut d'injonction
      if (
        procedureData.procedure.status === "INJONCTION_DE_PAIEMENT" ||
        procedureData.procedure.status === "INJONCTION_DE_PAIEMENT_PAYER"
      ) {
        const filesResponse = await fetch(`/api/procedures/${procedureId}/injonction-files`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (filesResponse.ok) {
          const filesData = await filesResponse.json();
          setInjonctionFiles(filesData);
        }
      }
    } catch (err) {
      console.error("Erreur lors de la récupération de la procédure:", err);
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#0F172A] mx-auto mb-4" />
          <p className="text-[#0F172A]/70">Chargement du dossier...</p>
        </div>
      </div>
    );
  }

  if (error || !procedure) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || "Dossier non trouvé"}</p>
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
                <Scale className="h-8 w-8 text-amber-600" />
                Détails du dossier d'injonction
              </h1>
              <p className="text-sm text-[#0F172A]/70 mt-1 font-light">
                Dossier ID: {procedure.id.slice(0, 8)}...
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                statusColors[procedure.status] || "bg-gray-100 text-gray-800"
              }`}
            >
              {statusLabels[procedure.status] || procedure.status}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-6 py-8">
        {/* Informations du client */}
        <div className="mb-6 rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-[#0F172A] mb-4">Informations du client</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-[#0F172A]/60 mb-1">Nom</p>
              <p className="text-sm font-medium text-[#0F172A]">
                {procedure.client.nomSociete || `${procedure.client.prenom} ${procedure.client.nom}`}
              </p>
            </div>
            <div>
              <p className="text-sm text-[#0F172A]/60 mb-1">SIRET</p>
              <p className="text-sm font-medium text-[#0F172A]">{procedure.client.siret}</p>
            </div>
            {procedure.client.email && (
              <div>
                <p className="text-sm text-[#0F172A]/60 mb-1">Email</p>
                <p className="text-sm font-medium text-[#0F172A]">{procedure.client.email}</p>
              </div>
            )}
            {procedure.client.telephone && (
              <div>
                <p className="text-sm text-[#0F172A]/60 mb-1">Téléphone</p>
                <p className="text-sm font-medium text-[#0F172A]">{procedure.client.telephone}</p>
              </div>
            )}
            {procedure.client.adresse && (
              <div className="md:col-span-2">
                <p className="text-sm text-[#0F172A]/60 mb-1">Adresse</p>
                <p className="text-sm font-medium text-[#0F172A]">
                  {procedure.client.adresse}
                  {procedure.client.codePostal && `, ${procedure.client.codePostal}`}
                  {procedure.client.ville && ` ${procedure.client.ville}`}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Informations de la procédure */}
        <div className="mb-6 rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-[#0F172A] mb-4">Informations de la procédure</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-[#0F172A]/60 mb-1">Contexte</p>
              <p className="text-sm text-[#0F172A]">{procedure.contexte}</p>
            </div>
            <div>
              <p className="text-sm text-[#0F172A]/60 mb-1">Date de facture échue</p>
              <p className="text-sm font-medium text-[#0F172A]">{formatDate(procedure.dateFactureEchue)}</p>
            </div>
            {procedure.montantDue !== null && (
              <div>
                <p className="text-sm text-[#0F172A]/60 mb-1">Montant dû</p>
                <p className="text-sm font-medium text-[#0F172A]">{formatAmount(procedure.montantDue)}</p>
              </div>
            )}
            {procedure.dateEnvoiLRAR && (
              <div>
                <p className="text-sm text-[#0F172A]/60 mb-1">Date d'envoi LRAR</p>
                <p className="text-sm font-medium text-[#0F172A]">{formatDate(procedure.dateEnvoiLRAR)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Documents d'injonction (Kbis et Attestation) */}
        {(procedure.status === "INJONCTION_DE_PAIEMENT" ||
          procedure.status === "INJONCTION_DE_PAIEMENT_PAYER") && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-[#0F172A] mb-4 flex items-center gap-2">
              <Scale className="h-6 w-6 text-amber-600" />
              Documents d'injonction de paiement
            </h2>
            {injonctionFiles ? (
              <div className="space-y-4">
                {injonctionFiles.kbisFilePath ? (
                  <div className="rounded-lg border border-amber-200 bg-white p-4">
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <File className="h-5 w-5 text-amber-600" />
                          <span className="text-base font-semibold text-amber-900">Kbis de moins de 3 mois</span>
                        </div>
                        <p className="text-sm text-amber-700 mt-1">
                          Document requis pour l'injonction de paiement
                        </p>
                      </div>
                      <a
                        href={injonctionFiles.kbisFilePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-4"
                      >
                        <Button variant="outline" size="sm">
                          <Download className="mr-2 h-4 w-4" />
                          Télécharger
                        </Button>
                      </a>
                    </div>
                    <div className="mt-3 rounded border bg-white">
                      <DocumentViewer
                        url={injonctionFiles.kbisFilePath}
                        mimeType="application/pdf"
                        fileName="Kbis"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-white p-4">
                    <p className="text-sm text-amber-700">Kbis non disponible</p>
                  </div>
                )}
                {injonctionFiles.attestationFilePath ? (
                  <div className="rounded-lg border border-amber-200 bg-white p-4">
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <FileText className="h-5 w-5 text-amber-600" />
                          <span className="text-base font-semibold text-amber-900">
                            Attestation sur l'honneur signée
                          </span>
                        </div>
                        <p className="text-sm text-amber-700 mt-1">
                          Attestation signée requise pour l'injonction de paiement
                        </p>
                      </div>
                      <a
                        href={injonctionFiles.attestationFilePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-4"
                      >
                        <Button variant="outline" size="sm">
                          <Download className="mr-2 h-4 w-4" />
                          Télécharger
                        </Button>
                      </a>
                    </div>
                    <div className="mt-3 rounded border bg-white">
                      <DocumentViewer
                        url={injonctionFiles.attestationFilePath}
                        mimeType="application/pdf"
                        fileName="Attestation sur l'honneur"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-white p-4">
                    <p className="text-sm text-amber-700">Attestation non disponible</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-white p-4">
                <p className="text-sm text-amber-700">Chargement des documents d'injonction...</p>
              </div>
            )}
          </div>
        )}

        {/* Tous les documents */}
        <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-[#0F172A] mb-4">Tous les documents</h2>
          {!procedure.documents || procedure.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun document associé</p>
          ) : (
            <div className="space-y-4">
              {procedure.documents.map((document) => {
                if (!document.filePath || document.filePath.trim() === "") {
                  return null;
                }

                return (
                  <div key={document.id} className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-4">
                    <div className="mb-3 flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {isImage(document.mimeType) ? (
                            <ImageIcon className="h-4 w-4 text-muted-foreground" />
                          ) : isPDF(document.mimeType) ? (
                            <File className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm font-medium">
                            {documentTypeLabels[document.type] || document.type}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{document.fileName}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatFileSize(document.fileSize)} • {formatDate(document.createdAt)}
                        </p>
                      </div>
                      <a
                        href={document.filePath}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-4"
                      >
                        <Button variant="outline" size="sm">
                          <Download className="mr-2 h-4 w-4" />
                          Télécharger
                        </Button>
                      </a>
                    </div>
                    {(isPDF(document.mimeType) || isImage(document.mimeType)) && (
                      <div className="mt-3 rounded border bg-white">
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
    </div>
  );
}


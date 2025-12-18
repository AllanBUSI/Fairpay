"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Scale, FileText, Loader2, AlertCircle, Upload, Copy, Download, X, CheckCircle2, CreditCard } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StripePaymentForm } from "@/components/ui/stripe-payment-form";

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
 * Page pour demander une injonction de paiement
 * Affiche les procédures éligibles (INJONCTION_DE_PAIEMENT ou INJONCTION_DE_PAIEMENT_PAYER)
 * et permet de lancer le processus de paiement avec upload des documents
 */
export default function SaisirTribunalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [proceduresPayees, setProceduresPayees] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"a-payer" | "payees">("a-payer");

  // États pour le modal d'injonction
  const [showInjonctionModal, setShowInjonctionModal] = useState(false);
  const [selectedProcedure, setSelectedProcedure] = useState<Procedure | null>(null);
  const [kbisFile, setKbisFile] = useState<File | null>(null);
  const [kbisUploading, setKbisUploading] = useState(false);
  const [kbisUploaded, setKbisUploaded] = useState(false);
  const [kbisFilePath, setKbisFilePath] = useState<string | null>(null);
  const [kbisError, setKbisError] = useState("");
  const [attestationFile, setAttestationFile] = useState<File | null>(null);
  const [attestationUploading, setAttestationUploading] = useState(false);
  const [attestationUploaded, setAttestationUploaded] = useState(false);
  const [attestationFilePath, setAttestationFilePath] = useState<string | null>(null);
  const [attestationError, setAttestationError] = useState("");
  const [prixInjonction, setPrixInjonction] = useState<number | null>(null);
  const [loadingPrix, setLoadingPrix] = useState(false);
  const [requesting, setRequesting] = useState<Record<string, boolean>>({});
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [paymentProcedureId, setPaymentProcedureId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attestationInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchProcedures();
    
    // Vérifier si on revient d'un paiement réussi
    const paymentStatus = searchParams?.get("payment");
    const sessionId = searchParams?.get("session_id");
    
    if (paymentStatus === "success" && sessionId) {
      // Vérifier le paiement
      verifyPayment(sessionId);
    }
  }, [searchParams]);

  /**
   * Récupère les procédures à payer (statut INJONCTION_DE_PAIEMENT)
   */
  const fetchProceduresAPayer = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/procedures?status=INJONCTION_DE_PAIEMENT", {
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
      console.error("Erreur lors du chargement des procédures à payer:", err);
    }
  };

  /**
   * Récupère les procédures payées (statut INJONCTION_DE_PAIEMENT_PAYER)
   */
  const fetchProceduresPayees = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/procedures?status=INJONCTION_DE_PAIEMENT_PAYER", {
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

      setProceduresPayees(data.procedures || []);
    } catch (err) {
      console.error("Erreur lors du chargement des procédures payées:", err);
    }
  };

  /**
   * Récupère toutes les procédures (à payer et payées)
   */
  const fetchProcedures = async () => {
    setLoading(true);
    setError("");

    try {
      await Promise.all([
        fetchProceduresAPayer(),
        fetchProceduresPayees(),
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Vérifie le paiement après retour de Stripe
   */
  const verifyPayment = async (sessionId: string) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      // Récupérer les procédures en INJONCTION_DE_PAIEMENT
      const proceduresResponse = await fetch("/api/procedures?status=INJONCTION_DE_PAIEMENT", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (proceduresResponse.ok) {
        const proceduresData = await proceduresResponse.json();
        const injonctionProcedure = proceduresData.procedures?.[0];
        
        if (injonctionProcedure) {
          const verifyResponse = await fetch("/api/stripe/verify-injonction-payment", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ 
              sessionId, 
              procedureId: injonctionProcedure.id 
            }),
          });

          if (verifyResponse.ok) {
            // Recharger les procédures
            setTimeout(() => {
              fetchProcedures();
            }, 1000);
          }
        }
      }
    } catch (error) {
      console.error("Erreur lors de la vérification du paiement:", error);
    }
  };

  /**
   * Récupère le prix de l'injonction
   */
  const fetchPrixInjonction = async () => {
    setLoadingPrix(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch("/api/stripe/get-price-id-injonction", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setPrixInjonction(79); // Prix HT par défaut
      } else {
        setPrixInjonction(79);
      }
    } catch (err) {
      console.error("Erreur lors de la récupération du prix:", err);
      setPrixInjonction(79);
    } finally {
      setLoadingPrix(false);
    }
  };

  /**
   * Ouvre le modal pour une procédure spécifique
   */
  const handleOpenModal = (procedure: Procedure) => {
    setSelectedProcedure(procedure);
    setShowInjonctionModal(true);
    fetchPrixInjonction();
  };

  /**
   * Gère l'upload du fichier KBIS
   */
  const handleKbisUpload = async (file: File) => {
    setKbisUploading(true);
    setKbisError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setKbisError("Vous devez être connecté");
        return;
      }

      const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
      if (!allowedTypes.includes(file.type)) {
        setKbisError("Le fichier doit être un PDF ou une image (JPEG, PNG)");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setKbisError("Le fichier est trop volumineux (max 10MB)");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "KBIS");

      const response = await fetch("/api/files/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de l'upload");
      }

      const data = await response.json();
      setKbisFilePath(data.filePath);
      setKbisUploaded(true);
    } catch (err) {
      setKbisError(err instanceof Error ? err.message : "Erreur lors de l'upload");
    } finally {
      setKbisUploading(false);
    }
  };

  /**
   * Gère la sélection du fichier KBIS
   */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setKbisFile(file);
      handleKbisUpload(file);
    }
  };

  /**
   * Gère l'upload du fichier d'attestation
   */
  const handleAttestationUpload = async (file: File) => {
    setAttestationUploading(true);
    setAttestationError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setAttestationError("Vous devez être connecté");
        return;
      }

      const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg", "image/png"];
      if (!allowedTypes.includes(file.type)) {
        setAttestationError("Le fichier doit être un PDF ou une image (JPEG, PNG)");
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        setAttestationError("Le fichier est trop volumineux (max 10MB)");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "ATTESTATION");

      const response = await fetch("/api/files/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de l'upload");
      }

      const data = await response.json();
      setAttestationFilePath(data.filePath);
      setAttestationUploaded(true);
    } catch (err) {
      setAttestationError(err instanceof Error ? err.message : "Erreur lors de l'upload");
    } finally {
      setAttestationUploading(false);
    }
  };

  /**
   * Gère la sélection du fichier d'attestation
   */
  const handleAttestationSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttestationFile(file);
      handleAttestationUpload(file);
    }
  };

  /**
   * Gère la soumission du paiement de l'injonction
   */
  const handleSubmitPayment = async (procedureId: string) => {
    if (!kbisUploaded || !kbisFilePath) {
      setKbisError("Veuillez uploader un Kbis de moins de 3 mois");
      return;
    }
    if (!attestationUploaded || !attestationFilePath) {
      setAttestationError("Veuillez uploader l'attestation sur l'honneur signée");
      return;
    }

    setRequesting((prev) => ({ ...prev, [procedureId]: true }));
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      // Créer le PaymentIntent pour l'injonction
      const response = await fetch("/api/stripe/create-injonction-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          procedureId: procedureId,
          kbisFilePath: kbisFilePath,
          attestationFilePath: attestationFilePath,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la création du paiement");
      }

      const data = await response.json();
      
      // Afficher le modal de paiement interne
      setPaymentClientSecret(data.clientSecret);
      setPaymentProcedureId(data.procedureId);
      setShowPaymentModal(true);
      setShowInjonctionModal(false);
      setRequesting((prev) => ({ ...prev, [procedureId]: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
      setRequesting((prev) => ({ ...prev, [procedureId]: false }));
    }
  };

  /**
   * Texte de l'attestation sur l'honneur
   */
  const attestationText = `ATTESTATION SUR L'HONNEUR

Je soussigné(e) [Nom et Prénom], [Qualité : Dirigeant / Représentant légal] de [Nom de la société], immatriculée au RCS de [Ville] sous le numéro [SIRET], 

DÉCLARE SUR L'HONNEUR :

1. Que les informations fournies dans le cadre de la demande d'injonction de payer sont exactes et complètes.

2. Que la créance réclamée est certaine, liquide et exigible.

3. Que les documents joints, notamment le Kbis de moins de 3 mois, sont authentiques et à jour.

4. Que je dispose de tous les éléments justificatifs de la créance réclamée.

5. Que je suis informé(e) des conséquences pénales encourues en cas de fausse déclaration.

Fait à [Lieu], le [Date]

Signature : _________________

[Cachet de l'entreprise]`;

  /**
   * Copie l'attestation dans le presse-papiers
   */
  const handleCopyAttestation = () => {
    navigator.clipboard.writeText(attestationText);
    alert("Attestation copiée dans le presse-papiers");
  };

  /**
   * Télécharge l'attestation
   */
  const handleDownloadAttestation = () => {
    const blob = new Blob([attestationText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "attestation-sur-l-honneur.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
                Saisir le tribunal
              </h1>
              <p className="text-sm text-[#0F172A]/70 mt-1 font-light">
                Demander une injonction de paiement pour vos dossiers éligibles
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
              À payer ({procedures.length})
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
            {procedures.length === 0 ? (
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-12 text-center shadow-sm">
                <Scale className="h-12 w-12 text-[#0F172A]/40 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-[#0F172A] mb-2">
                  Aucun dossier à payer
                </h3>
                <p className="text-sm text-[#0F172A]/70 mb-4">
                  Vous n'avez pas de dossiers en attente de paiement pour le moment.
                </p>
                <p className="text-xs text-[#0F172A]/60">
                  Les dossiers deviennent éligibles 17 jours après l'envoi de la mise en demeure.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {procedures.map((procedure) => (
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

                <div className="flex flex-col gap-2">
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => router.push(`/dashboard/saisir-tribunal/${procedure.id}`)}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Voir le dossier
                  </Button>
                  <Button
                    onClick={() => handleOpenModal(procedure)}
                    className="w-full bg-[#16A34A] hover:bg-[#16A34A]/90 text-white"
                  >
                    <Scale className="mr-2 h-4 w-4" />
                    Demander l'injonction
                  </Button>
                </div>
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
                  Aucun dossier payé
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
                      onClick={() => router.push(`/dashboard/saisir-tribunal/${procedure.id}`)}
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

      {/* Modal d'injonction de paiement */}
      <Dialog open={showInjonctionModal} onOpenChange={setShowInjonctionModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#0F172A]">
              Injonction de paiement
            </DialogTitle>
            <DialogDescription className="text-[#0F172A]/70">
              Votre dossier est éligible pour une injonction de paiement. Veuillez fournir un Kbis de moins de 3 mois et signer l'attestation sur l'honneur pour procéder au paiement.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {selectedProcedure && (
              <div className="p-4 bg-[#F3F4F6] rounded-lg">
                <p className="text-sm font-semibold text-[#0F172A] mb-2">Dossier concerné :</p>
                <p className="text-sm text-[#0F172A]/70">
                  {selectedProcedure.client?.nomSociete || `${selectedProcedure.client?.prenom || ""} ${selectedProcedure.client?.nom || ""}`.trim()}
                </p>
              </div>
            )}

            {/* Upload Kbis */}
            <div>
              <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                Kbis de moins de 3 mois <span className="text-red-500">*</span>
              </label>
              <div className="border-2 border-dashed border-[#E5E7EB] rounded-lg p-6 text-center hover:border-[#2563EB] transition-colors">
                {kbisUploaded ? (
                  <div className="space-y-2">
                    <CheckCircle2 className="h-12 w-12 text-[#16A34A] mx-auto" />
                    <p className="text-sm font-medium text-[#16A34A]">Kbis uploadé avec succès</p>
                    <p className="text-xs text-[#0F172A]/60">{kbisFile?.name}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setKbisFile(null);
                        setKbisUploaded(false);
                        setKbisFilePath(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Changer le fichier
                    </Button>
                  </div>
                ) : (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="kbis-upload"
                    />
                    <label htmlFor="kbis-upload" className="cursor-pointer">
                      <Upload className="h-12 w-12 text-[#0F172A]/40 mx-auto mb-4" />
                      <p className="text-sm font-medium text-[#0F172A] mb-1">
                        Cliquez pour uploader ou glissez-déposez
                      </p>
                      <p className="text-xs text-[#0F172A]/60">
                        PDF ou image (JPEG, PNG) - Max 10MB
                      </p>
                    </label>
                  </div>
                )}
                {kbisUploading && (
                  <div className="mt-4">
                    <Loader2 className="h-6 w-6 animate-spin text-[#2563EB] mx-auto" />
                    <p className="text-sm text-[#0F172A]/70 mt-2">Upload en cours...</p>
                  </div>
                )}
                {kbisError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{kbisError}</p>
                  </div>
                )}
              </div>
              <p className="text-xs text-[#0F172A]/60 mt-2">
                Le Kbis doit dater de moins de 3 mois à compter de la date de votre demande.
              </p>
            </div>

            {/* Attestation sur l'honneur */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-semibold text-[#0F172A]">
                  Attestation sur l'honneur à signer et retourner
                </label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyAttestation}
                    className="text-xs"
                  >
                    <Copy className="mr-2 h-3 w-3" />
                    Copier
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadAttestation}
                    className="text-xs"
                  >
                    <Download className="mr-2 h-3 w-3" />
                    Télécharger
                  </Button>
                </div>
              </div>
              <div className="border border-[#E5E7EB] rounded-lg p-4 bg-[#F9FAFB]">
                <pre className="text-xs text-[#0F172A]/80 whitespace-pre-wrap font-mono">
                  {attestationText}
                </pre>
              </div>
              <p className="text-xs text-[#0F172A]/60 mb-4">
                Veuillez remplir les champs entre crochets, signer l'attestation et l'uploader ci-dessous.
              </p>

              {/* Upload attestation signée */}
              <div>
                <label className="block text-sm font-semibold text-[#0F172A] mb-2">
                  Attestation sur l'honneur signée <span className="text-red-500">*</span>
                </label>
                {attestationUploaded ? (
                  <div className="border-2 border-[#16A34A] rounded-lg p-6 bg-[#16A34A]/5">
                    <div className="space-y-2 text-center">
                      <CheckCircle2 className="h-12 w-12 text-[#16A34A] mx-auto" />
                      <p className="text-sm font-medium text-[#16A34A]">Attestation uploadée avec succès</p>
                      <p className="text-xs text-[#0F172A]/60">{attestationFile?.name}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAttestationFile(null);
                          setAttestationUploaded(false);
                          setAttestationFilePath(null);
                          if (attestationInputRef.current) attestationInputRef.current.value = "";
                        }}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Changer le fichier
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-[#E5E7EB] rounded-lg p-4 bg-white">
                    <input
                      ref={attestationInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={handleAttestationSelect}
                      className="w-full text-sm text-[#0F172A] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[#2563EB] file:text-white hover:file:bg-[#2563EB]/90 file:cursor-pointer cursor-pointer"
                      id="attestation-upload"
                    />
                    <p className="text-xs text-[#0F172A]/60 mt-2">
                      PDF ou image (JPEG, PNG) - Max 10MB
                    </p>
                  </div>
                )}
                {attestationUploading && (
                  <div className="mt-4 p-4 border-2 border-[#2563EB] rounded-lg bg-[#2563EB]/5">
                    <Loader2 className="h-6 w-6 animate-spin text-[#2563EB] mx-auto" />
                    <p className="text-sm text-[#0F172A]/70 mt-2 text-center">Upload en cours...</p>
                  </div>
                )}
                {attestationError && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{attestationError}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Prix */}
            {prixInjonction && (
              <div className="p-3 bg-white rounded-lg border border-[#2563EB]/20">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-[#2563EB]" />
                  <div>
                    <p className="text-xs text-[#0F172A]/60">Prix de l'injonction de payer</p>
                    <p className="text-lg font-bold text-[#0F172A]">
                      {prixInjonction.toFixed(2)} € HT ({(prixInjonction * 1.20).toFixed(2)} € TTC)
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Boutons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-[#E5E7EB]">
              <Button
                variant="outline"
                onClick={() => {
                  setShowInjonctionModal(false);
                  setSelectedProcedure(null);
                  setKbisFile(null);
                  setKbisUploaded(false);
                  setKbisFilePath(null);
                  setKbisError("");
                  setAttestationFile(null);
                  setAttestationUploaded(false);
                  setAttestationFilePath(null);
                  setAttestationError("");
                }}
              >
                Annuler
              </Button>
              <Button
                onClick={() => selectedProcedure && handleSubmitPayment(selectedProcedure.id)}
                disabled={!kbisUploaded || !attestationUploaded || !!(selectedProcedure && requesting[selectedProcedure.id])}
                className="bg-[#16A34A] hover:bg-[#16A34A]/90 text-white"
              >
                {(selectedProcedure && requesting[selectedProcedure.id]) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Préparation...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Payer l'injonction
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de paiement pour l'injonction */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Paiement de l'injonction</DialogTitle>
            <DialogDescription>
              Finalisez votre paiement pour l'injonction de paiement
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Injonction de paiement</p>
                <p className="text-sm font-medium">
                  {prixInjonction ? `${(prixInjonction * 1.20).toFixed(2)} € TTC` : "94,80 € TTC"}
                </p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <p className="text-lg font-semibold">Total à payer</p>
                <p className="text-lg font-bold">
                  {prixInjonction ? `${(prixInjonction * 1.20).toFixed(2)} € TTC` : "94,80 € TTC"}
                </p>
              </div>
            </div>
            {paymentClientSecret && (
              <StripePaymentForm
                amount={prixInjonction ? prixInjonction * 1.20 : 94.80}
                onSuccess={async () => {
                  setShowPaymentModal(false);
                  setPaymentClientSecret(null);
                  setPaymentProcedureId(null);
                  // Recharger les procédures
                  await fetchProcedures();
                  router.push("/dashboard/saisir-tribunal?payment=success");
                }}
                onError={(error) => {
                  setError(error);
                  setShowPaymentModal(false);
                }}
                procedureId={paymentProcedureId || undefined}
                clientSecret={paymentClientSecret}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


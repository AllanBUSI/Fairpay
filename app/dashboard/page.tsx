"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ProcedureStatus, UserRole } from "@/app/generated/prisma/enums";
import { FileText, CheckCircle, Scale, Upload, Copy, Download, X, Loader2, CheckCircle2, CreditCard } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StripePaymentForm } from "@/components/ui/stripe-payment-form";

type ProcedureStatusType = "NOUVEAU" | "EN_COURS" | "RESOLU" | "ANNULE" | "EN_ATTENTE_REPONSE" | "EN_ATTENTE_RETOUR" | "LRAR_FINI" | "ENVOYE" | "INJONCTION_DE_PAIEMENT" | "INJONCTION_DE_PAIEMENT_PAYER" | "all";

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
  dateEnvoiLRAR?: string | null;
  montantDue?: number | null;
}

const statusLabels: Record<ProcedureStatusType, string> = {
  NOUVEAU: "Nouveau",
  EN_COURS: "En cours",
  RESOLU: "Résolu",
  ANNULE: "Annulé",
  EN_ATTENTE_REPONSE: "En attente d'examen",
  EN_ATTENTE_RETOUR: "En attente de réponse",
  LRAR_FINI: "LRAR terminé",
  ENVOYE: "Envoyé",
  INJONCTION_DE_PAIEMENT: "Injonction de paiement",
  INJONCTION_DE_PAIEMENT_PAYER: "Injonction payée",
  all: "Toutes",
};

const statusColors: Record<ProcedureStatusType, string> = {
  NOUVEAU: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400",
  EN_COURS: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400",
  RESOLU: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
  ANNULE: "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
  EN_ATTENTE_REPONSE: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
  EN_ATTENTE_RETOUR: "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400",
  LRAR_FINI: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400",
  ENVOYE: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
  INJONCTION_DE_PAIEMENT: "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400",
  INJONCTION_DE_PAIEMENT_PAYER: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400",
  all: "",
};

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [allProcedures, setAllProcedures] = useState<Procedure[]>([]); // Pour calculer les compteurs
  const [brouillonsCount, setBrouillonsCount] = useState(0);
  const [injonctionsCount, setInjonctionsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProcedureStatusType>("all");
  const [error, setError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  
  // États pour le modal d'injonction de paiement
  const [showInjonctionModal, setShowInjonctionModal] = useState(false);
  const [selectedInjonctionProcedure, setSelectedInjonctionProcedure] = useState<Procedure | null>(null);
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
  const [requesting, setRequesting] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null);
  const [paymentProcedureId, setPaymentProcedureId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attestationInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Charger toutes les procédures pour calculer les compteurs
    fetchAllProcedures();
    fetchProcedures(activeTab);
    fetchBrouillonsCount();
    fetchInjonctionsCount();
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
        fetchBrouillonsCount();
        fetchInjonctionsCount();
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
      fetchBrouillonsCount();
      fetchInjonctionsCount();
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
        // Filtrer les statuts non autorisés dans le dashboard
        const validStatuses: ProcedureStatusType[] = ["NOUVEAU", "EN_COURS", "RESOLU", "ANNULE", "EN_ATTENTE_REPONSE", "EN_ATTENTE_RETOUR", "LRAR_FINI", "ENVOYE", "INJONCTION_DE_PAIEMENT", "INJONCTION_DE_PAIEMENT_PAYER"];
        const proceduresWithStatus = proceduresData
          .map((p: any) => ({
            ...p,
            status: p.status || "NOUVEAU",
          }))
          .filter((p: Procedure) => {
            // Filtrer les statuts non autorisés dans le dashboard
            return validStatuses.includes(p.status as ProcedureStatusType) || p.status === "all";
          });
        setAllProcedures(proceduresWithStatus);
        
        // Vérifier s'il y a un dossier en INJONCTION_DE_PAIEMENT et ouvrir le modal automatiquement
        // Ne l'ouvrir qu'une seule fois par dossier (vérifier dans localStorage)
        const injonctionProcedure = proceduresWithStatus.find(
          (p: Procedure) => p.status === "INJONCTION_DE_PAIEMENT"
        );
        if (injonctionProcedure && !showInjonctionModal) {
          const modalShownKey = `injonction-modal-shown-${injonctionProcedure.id}`;
          const modalAlreadyShown = localStorage.getItem(modalShownKey);
          
          if (!modalAlreadyShown) {
            setSelectedInjonctionProcedure(injonctionProcedure);
            setShowInjonctionModal(true);
            fetchPrixInjonction();
            // Marquer que le modal a été affiché pour ce dossier
            localStorage.setItem(modalShownKey, "true");
          }
        }
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
          fetchAllProcedures();
          fetchProcedures(activeTab);
        }, 500);
        setTimeout(() => {
          fetchAllProcedures();
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
      // S'assurer que chaque procédure a un statut et filtrer les statuts non autorisés dans le dashboard
      const validStatuses: ProcedureStatusType[] = ["NOUVEAU", "EN_COURS", "RESOLU", "ANNULE", "EN_ATTENTE_REPONSE", "EN_ATTENTE_RETOUR", "LRAR_FINI", "ENVOYE", "INJONCTION_DE_PAIEMENT", "INJONCTION_DE_PAIEMENT_PAYER"];
      const proceduresWithStatus = proceduresData
        .map((p: any) => ({
          ...p,
          status: p.status || "NOUVEAU",
        }))
        .filter((p: Procedure) => {
          // Filtrer les statuts non autorisés dans le dashboard
          return validStatuses.includes(p.status as ProcedureStatusType) || p.status === "all";
        });
      setProcedures(proceduresWithStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  const fetchBrouillonsCount = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch("/api/procedures?status=BROUILLONS", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setBrouillonsCount(data.procedures?.length || 0);
      }
    } catch (err) {
      console.error("Erreur lors de la récupération des brouillons:", err);
    }
  };

  const fetchInjonctionsCount = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      // Récupérer les injonctions (à payer et payées)
      const response1 = await fetch("/api/procedures?status=INJONCTION_DE_PAIEMENT", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const response2 = await fetch("/api/procedures?status=INJONCTION_DE_PAIEMENT_PAYER", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      let count = 0;
      if (response1.ok) {
        const data1 = await response1.json();
        count += data1.procedures?.length || 0;
      }
      if (response2.ok) {
        const data2 = await response2.json();
        count += data2.procedures?.length || 0;
      }
      setInjonctionsCount(count);
    } catch (err) {
      console.error("Erreur lors de la récupération des injonctions:", err);
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

  /**
   * Récupère le prix de l'injonction depuis l'API
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
        const data = await response.json();
        // Le prix sera récupéré côté serveur, on utilise une valeur par défaut pour l'affichage
        setPrixInjonction(79); // Prix HT par défaut
      } else {
        setPrixInjonction(79); // Prix HT par défaut
      }
    } catch (err) {
      console.error("Erreur lors de la récupération du prix:", err);
      setPrixInjonction(79); // Prix HT par défaut
    } finally {
      setLoadingPrix(false);
    }
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
  const handleSubmitPayment = async () => {
    if (!selectedInjonctionProcedure) return;
    if (!kbisUploaded || !kbisFilePath) {
      setKbisError("Veuillez uploader un Kbis de moins de 3 mois");
      return;
    }
    if (!attestationUploaded || !attestationFilePath) {
      setAttestationError("Veuillez uploader l'attestation sur l'honneur signée");
      return;
    }

    setRequesting(true);
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
          procedureId: selectedInjonctionProcedure.id,
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
      setRequesting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
      setRequesting(false);
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


  const tabs: ProcedureStatusType[] = ["all", "NOUVEAU", "EN_COURS", "EN_ATTENTE_REPONSE", "EN_ATTENTE_RETOUR", "LRAR_FINI", "ENVOYE", "RESOLU", "ANNULE"];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b-2 border-[#16A34A]/20 bg-gradient-to-r from-[#F0FDF4] to-white shadow-sm">
        <div className="container mx-auto px-4 lg:px-6 py-6 lg:py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl lg:text-4xl font-black text-[#16A34A] tracking-[-0.03em] mb-2">
                Dashboard
              </h1>
              <p className="text-sm lg:text-base text-[#64748B] font-light">
                Gestion des procédures de recouvrement
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 lg:px-6 py-4 lg:py-8">
        {/* Message de succès du paiement */}
        {paymentSuccess && (
          <div className="mb-6 rounded-xl border-2 border-[#16A34A] bg-gradient-to-r from-[#16A34A]/20 to-[#22C55E]/20 p-4 flex items-center gap-3 shadow-lg">
            <div className="rounded-full bg-gradient-to-r from-[#16A34A] to-[#22C55E] p-2">
              <CheckCircle className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-[#16A34A]">Paiement réussi !</p>
              <p className="text-sm text-[#64748B] font-light">Votre dossier a été créé avec succès.</p>
            </div>
          </div>
        )}
        {/* Encarts principaux */}
        <div className="mb-6 lg:mb-8 grid gap-4 lg:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border-2 border-[#16A34A]/30 bg-gradient-to-br from-[#F0FDF4] to-white p-6 lg:p-8 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer group hover:border-[#16A34A] hover:scale-[1.02]" onClick={() => router.push("/dashboard")}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#16A34A] mb-1">Dossiers</p>
                <p className="text-3xl lg:text-4xl font-black text-[#0F172A] mb-1">{allProcedures.length}</p>
                <p className="text-xs text-[#64748B] font-light">Dans le dashboard</p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-[#16A34A] to-[#22C55E] p-3 group-hover:scale-110 transition-transform duration-200 shadow-md">
                <FileText className="h-8 w-8 text-white" />
              </div>
            </div>
          </div>
          <div className="rounded-2xl border-2 border-[#16A34A]/30 bg-gradient-to-br from-[#F0FDF4] to-white p-6 lg:p-8 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer group hover:border-[#16A34A] hover:scale-[1.02]" onClick={() => router.push("/dashboard/saisir-tribunal")}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#16A34A] mb-1">Saisir le tribunal</p>
                <p className="text-3xl lg:text-4xl font-black text-[#0F172A] mb-1">{injonctionsCount}</p>
                <p className="text-xs text-[#64748B] font-light">Dossiers d'injonction</p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-[#16A34A] to-[#22C55E] p-3 group-hover:scale-110 transition-transform duration-200 shadow-md">
                <Scale className="h-8 w-8 text-white" />
              </div>
            </div>
          </div>
          <div className="rounded-2xl border-2 border-[#16A34A]/30 bg-gradient-to-br from-[#F0FDF4] to-white p-6 lg:p-8 shadow-lg hover:shadow-xl transition-all duration-200 cursor-pointer group hover:border-[#16A34A] hover:scale-[1.02]" onClick={() => router.push("/dashboard/brouillons")}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#16A34A] mb-1">Brouillons</p>
                <p className="text-3xl lg:text-4xl font-black text-[#0F172A] mb-1">{brouillonsCount}</p>
                <p className="text-xs text-[#64748B] font-light">Dossiers en brouillon</p>
              </div>
              <div className="rounded-xl bg-gradient-to-br from-[#16A34A] to-[#22C55E] p-3 group-hover:scale-110 transition-transform duration-200 shadow-md">
                <FileText className="h-8 w-8 text-white" />
              </div>
            </div>
          </div>
        </div>
        
        {/* Stats Cards détaillées */}
        <div className="mb-6 lg:mb-8 grid gap-4 grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border-2 border-[#16A34A]/20 bg-gradient-to-br from-[#F0FDF4] to-white p-5 shadow-md hover:shadow-lg transition-all duration-200 hover:border-[#16A34A]/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-[#16A34A] mb-1">Total</p>
                <p className="text-2xl font-black text-[#0F172A]">{allProcedures.length}</p>
              </div>
              <div className="rounded-lg bg-gradient-to-br from-[#16A34A] to-[#22C55E] p-2 shadow-sm">
                <FileText className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border-2 border-[#16A34A]/20 bg-gradient-to-br from-[#F0FDF4] to-white p-5 shadow-md hover:shadow-lg transition-all duration-200 hover:border-[#16A34A]/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-[#16A34A] mb-1">En cours</p>
                <p className="text-2xl font-black text-[#16A34A]">
                  {allProcedures.filter((p) => p.status === "EN_COURS").length}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#16A34A] to-[#22C55E] flex items-center justify-center shadow-sm">
                <div className="h-3 w-3 rounded-full bg-white" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border-2 border-[#16A34A]/20 bg-gradient-to-br from-[#F0FDF4] to-white p-5 shadow-md hover:shadow-lg transition-all duration-200 hover:border-[#16A34A]/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-[#16A34A] mb-1">En attente</p>
                <p className="text-2xl font-black text-[#16A34A]">
                  {allProcedures.filter((p) => p.status === "EN_ATTENTE_REPONSE").length}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#16A34A]/30 to-[#22C55E]/30 flex items-center justify-center">
                <div className="h-3 w-3 rounded-full bg-[#16A34A]" />
              </div>
            </div>
          </div>
          <div className="rounded-xl border-2 border-[#16A34A]/20 bg-gradient-to-br from-[#F0FDF4] to-white p-5 shadow-md hover:shadow-lg transition-all duration-200 hover:border-[#16A34A]/40">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-[#16A34A] mb-1">Résolu</p>
                <p className="text-2xl font-black text-[#16A34A]">
                  {allProcedures.filter((p) => p.status === "RESOLU").length}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-[#16A34A] to-[#22C55E] flex items-center justify-center shadow-sm">
                <div className="h-3 w-3 rounded-full bg-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 rounded-xl border-2 border-[#16A34A]/20 bg-gradient-to-r from-[#F0FDF4] to-white p-2 shadow-lg overflow-hidden">
          <nav className="flex space-x-2 overflow-x-auto tabs-scrollbar pb-2 -mx-4 px-4 lg:mx-0 lg:px-0">
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
                  className={`flex-shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 whitespace-nowrap ${
                    activeTab === tab
                      ? "bg-gradient-to-r from-[#16A34A] to-[#22C55E] text-white shadow-md"
                      : "text-[#64748B] hover:bg-[#F0FDF4] hover:text-[#16A34A] border border-transparent hover:border-[#16A34A]/30"
                  }`}
                >
                  <span>{statusLabels[tab]}</span>
                  {count > 0 && (
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold min-w-[24px] text-center ${
                        activeTab === tab
                          ? "bg-white/30 text-white"
                          : "bg-[#16A34A] text-white shadow-sm"
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
          <div className="mb-4 rounded-xl border-2 border-red-200 bg-gradient-to-r from-red-50 to-red-100/50 p-4 text-sm text-red-800 shadow-md">
            {error}
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 border-4 border-[#16A34A]/20 border-t-[#16A34A] rounded-full animate-spin"></div>
              <div className="text-[#16A34A] font-semibold">Chargement...</div>
            </div>
          </div>
        ) : procedures.length === 0 ? (
          <div className="rounded-2xl border-2 border-[#16A34A]/20 bg-gradient-to-br from-white to-[#F0FDF4]/30 p-12 text-center shadow-lg">
            <div className="rounded-full bg-gradient-to-r from-[#16A34A]/10 to-[#22C55E]/10 p-4 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <FileText className="h-10 w-10 text-[#16A34A]" />
            </div>
            <p className="text-lg font-black mb-2 text-[#0F172A]">Aucune procédure</p>
            <p className="text-sm text-[#64748B] font-light">
              Aucune procédure trouvée pour ce statut.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {procedures.map((procedure) => (
              <Link
                key={procedure.id}
                href={`/dashboard/${procedure.id}`}
                className="group rounded-2xl border-2 border-[#16A34A]/20 bg-gradient-to-br from-white to-[#F0FDF4]/30 p-6 shadow-lg transition-all duration-200 hover:shadow-xl hover:border-[#16A34A] hover:scale-[1.02] cursor-pointer"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-black mb-1 text-[#0F172A] tracking-tight">
                      {procedure.client?.nomSociete || `${procedure.client?.prenom || ""} ${procedure.client?.nom || ""}`.trim() || "Client non renseigné"}
                    </h3>
                    <p className="text-xs text-[#64748B] font-light">
                      SIRET: {procedure.client?.siret || "Non renseigné"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                      statusColors[procedure.status] || statusColors.NOUVEAU
                    }`}
                  >
                    {statusLabels[procedure.status] || "Nouveau"}
                  </span>
                </div>
                <p className="mb-4 line-clamp-3 text-sm text-[#64748B] font-light leading-relaxed">
                  {procedure.contexte}
                </p>
                <div className="flex items-center justify-between border-t-2 border-[#16A34A]/20 pt-4 text-xs text-[#64748B]">
                  <div>
                    <span className="font-semibold text-[#16A34A]">Facture échue:</span>{" "}
                    {formatDate(procedure.dateFactureEchue)}
                  </div>
                  <div>
                    <span className="font-semibold text-[#16A34A]">Créée:</span>{" "}
                    {formatDate(procedure.createdAt)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
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
            {selectedInjonctionProcedure && (
              <div className="p-4 bg-[#F3F4F6] rounded-lg">
                <p className="text-sm font-semibold text-[#0F172A] mb-2">Dossier concerné :</p>
                <p className="text-sm text-[#0F172A]/70">
                  {selectedInjonctionProcedure.client?.nomSociete || `${selectedInjonctionProcedure.client?.prenom || ""} ${selectedInjonctionProcedure.client?.nom || ""}`.trim()}
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
                  <div className="border-2 border-[#E5E7EB] rounded-lg p-4">
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
                  setSelectedInjonctionProcedure(null);
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
                onClick={handleSubmitPayment}
                disabled={!kbisUploaded || !attestationUploaded || requesting}
                className="bg-[#16A34A] hover:bg-[#16A34A]/90 text-white"
              >
                {requesting ? (
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
                  await fetchProcedures(activeTab);
                  router.push("/dashboard?payment=success");
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

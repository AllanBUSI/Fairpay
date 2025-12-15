"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FileText, Download, Image as ImageIcon, File, Plus, MessageSquare, Calendar, X, Edit2, Save, RotateCcw, CheckCircle2, FilePenLine, Briefcase, Send, ChevronDown, Settings, Eye } from "lucide-react";
import Link from "next/link";
import { DocumentViewer } from "@/components/ui/document-viewer";
import { Chat } from "@/components/ui/chat";
import { FileUpload } from "@/components/ui/file-upload";
import { MiseEnDemeureEditor } from "@/components/ui/mise-en-demeure-editor";
import { EcheancierEditor } from "@/components/ui/echeancier-editor";
import { UserRole } from "@/app/generated/prisma/enums";
import { canCommentDossier, canUploadDocuments } from "@/lib/permissions";

type ProcedureStatusType = "NOUVEAU" | "EN_COURS" | "RESOLU" | "ANNULE" | "EN_ATTENTE_REPONSE" | "EN_ATTENTE_RETOUR" | "LRAR" | "LRAR_ECHEANCIER";

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
  numeroFacture: string | null;
  dateFactureEchue: string | null;
  montantDue: number | null;
  montantTTC: boolean | null;
  createdAt: string;
}

interface Echeance {
  date: string;
  montant: number;
}

interface Procedure {
  id: string;
  contexte: string;
  dateFactureEchue: string;
  montantDue: number | null;
  montantTTC: boolean;
  dateRelance: string | null;
  dateRelance2: string | null;
  status: ProcedureStatusType;
  echeancier: Echeance[] | null;
  analysed: boolean;
  miseEnDemeure: string | null;
  avocatId: string | null;
  createdAt: string;
  updatedAt: string;
  client: Client;
  documents: Document[];
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
};

const documentTypeLabels: Record<string, string> = {
  FACTURE: "Facture",
  DEVIS: "Devis",
  CONTRAT: "Contrat",
  EMAIL: "Email",
  WHATSAPP_SMS: "WhatsApp/SMS",
  AUTRES_PREUVES: "Autres preuves",
};

export default function ProcedureDetailPage() {
  const router = useRouter();
  const params = useParams();
  const [procedure, setProcedure] = useState<Procedure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState<{ id: string; email: string; role: UserRole } | null>(null);
  const [showAddDocuments, setShowAddDocuments] = useState(false);
  const [addingDocuments, setAddingDocuments] = useState(false);
  const [showManageInvoiceNumbers, setShowManageInvoiceNumbers] = useState(false);
  interface InvoiceEditData {
    numeroFacture: string;
    dateFactureEchue: string;
    montantDue: string;
    montantTTC: boolean;
  }
  const [editingInvoiceNumbers, setEditingInvoiceNumbers] = useState<Record<string, InvoiceEditData>>({});
  const [savingInvoiceNumbers, setSavingInvoiceNumbers] = useState(false);
  const [requestingRetour, setRequestingRetour] = useState(false);
  const [editingRelanceDates, setEditingRelanceDates] = useState(false);
  const [relanceDates, setRelanceDates] = useState({ dateRelance: "", dateRelance2: "" });
  const [savingRelanceDates, setSavingRelanceDates] = useState(false);
  const [takingDossier, setTakingDossier] = useState(false);
  const [showMiseEnDemeure, setShowMiseEnDemeure] = useState(false);
  const [miseEnDemeureContent, setMiseEnDemeureContent] = useState("");
  const [savingMiseEnDemeure, setSavingMiseEnDemeure] = useState(false);
  const [markingAnalysed, setMarkingAnalysed] = useState(false);
  const [sendingMiseEnDemeure, setSendingMiseEnDemeure] = useState(false);
  const [showEcheancier, setShowEcheancier] = useState(false);
  const [savingEcheancier, setSavingEcheancier] = useState(false);
  const [showStatusChange, setShowStatusChange] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<ProcedureStatusType | "">("");
  const [filesByType, setFilesByType] = useState<Record<string, Array<{
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    type: string;
  }>>>({
    FACTURE: [],
    DEVIS: [],
    CONTRAT: [],
    EMAIL: [],
    WHATSAPP_SMS: [],
    AUTRES_PREUVES: [],
  });
  // Informations pour les nouvelles factures à ajouter
  const [newFacturesInfo, setNewFacturesInfo] = useState<Record<number, InvoiceEditData>>({});

  useEffect(() => {
    fetchUser();
    fetchProcedure();
  }, [params.id]);

  const fetchUser = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const response = await fetch("/api/user", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      }
    } catch (err) {
      console.error("Erreur lors de la récupération de l'utilisateur:", err);
    }
  };

  const fetchProcedure = async () => {
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch(`/api/procedures/${params.id}`, {
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

      // S'assurer que echeancier est un tableau
      const procedureData = {
        ...data.procedure,
        echeancier: data.procedure.echeancier 
          ? (Array.isArray(data.procedure.echeancier) 
              ? data.procedure.echeancier 
              : (typeof data.procedure.echeancier === 'string' 
                  ? JSON.parse(data.procedure.echeancier) 
                  : []))
          : null,
        // S'assurer que documents est un tableau
        documents: data.procedure.documents && Array.isArray(data.procedure.documents)
          ? data.procedure.documents
          : [],
        // S'assurer que client existe
        client: data.procedure.client || null,
      };

      console.log("Procédure chargée:", {
        id: procedureData.id,
        documentsCount: procedureData.documents?.length || 0,
        hasClient: !!procedureData.client,
        client: procedureData.client,
      });

      setProcedure(procedureData);
      // Initialiser le contenu de la mise en demeure si elle existe
      if (procedureData.miseEnDemeure) {
        setMiseEnDemeureContent(procedureData.miseEnDemeure);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  const handleFilesChange = (type: string, files: Array<{
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    type: string;
  }>) => {
    setFilesByType((prev) => {
      const newFiles = {
        ...prev,
        [type]: files,
      };
      // Si on ajoute/modifie des factures, initialiser les infos
      if (type === "FACTURE") {
        const updatedInfo: Record<number, InvoiceEditData> = {};
        files.forEach((_, index) => {
          updatedInfo[index] = newFacturesInfo[index] || {
            numeroFacture: "",
            dateFactureEchue: "",
            montantDue: "",
            montantTTC: true,
          };
        });
        setNewFacturesInfo(updatedInfo);
      }
      return newFiles;
    });
  };

  const handleMarkAsAnalysed = async () => {
    if (!procedure || !user) return;

    setMarkingAnalysed(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch(`/api/procedures/${procedure.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          analysed: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de la mise à jour");
      }

      await fetchProcedure();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setMarkingAnalysed(false);
    }
  };

  const handleSaveMiseEnDemeure = async (content?: string) => {
    if (!procedure || !user) return;

    setSavingMiseEnDemeure(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const contentToSave = content || miseEnDemeureContent;

      const response = await fetch(`/api/procedures/${procedure.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          miseEnDemeure: contentToSave,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de l'enregistrement");
      }

      await fetchProcedure();
      setShowMiseEnDemeure(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
      throw err; // Re-throw pour que le composant puisse gérer l'erreur
    } finally {
      setSavingMiseEnDemeure(false);
    }
  };

  const handleSendMiseEnDemeure = async () => {
    if (!procedure || !user) return;

    setSendingMiseEnDemeure(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch(`/api/procedures/${procedure.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: "EN_COURS",
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de l'envoi de la mise en demeure");
      }

      await fetchProcedure();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setSendingMiseEnDemeure(false);
    }
  };

  const handleSaveEcheancier = async (echeancier: Echeance[]) => {
    if (!procedure || !user) return;

    setSavingEcheancier(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      // Limiter à 5 échéances maximum
      const echeancierToSave = echeancier.slice(0, 5);

      const response = await fetch(`/api/procedures/${procedure.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          echeancier: echeancierToSave,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de l'enregistrement de l'écheancier");
      }

      await fetchProcedure();
      setShowEcheancier(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
      throw err; // Re-throw pour que le composant puisse gérer l'erreur
    } finally {
      setSavingEcheancier(false);
    }
  };

  const handleChangeStatus = async () => {
    if (!procedure || !user || !selectedStatus) return;

    // Validation : USER ne peut mettre que RESOLU
    if (user.role === UserRole.USER && selectedStatus !== "RESOLU") {
      setError("Vous ne pouvez que mettre le dossier en résolu");
      return;
    }

    setChangingStatus(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch(`/api/procedures/${procedure.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: selectedStatus,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors du changement de statut");
      }

      // Recharger la procédure
      await fetchProcedure();
      setShowStatusChange(false);
      setSelectedStatus("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setChangingStatus(false);
    }
  };

  const handleRequestRetour = async () => {
    if (!procedure || !user) return;

    setRequestingRetour(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      // Déterminer à qui on demande le retour
      let message = "";
      let newStatus = "";
      
      if (user.role === UserRole.USER) {
        if (procedure.avocatId === null) {
          // Si aucun avocat n'est assigné, l'utilisateur demande qu'un avocat examine le dossier
          message = "L'utilisateur demande qu'un avocat examine le dossier.";
          newStatus = "EN_ATTENTE_REPONSE"; // Statut pour indiquer qu'un avocat doit prendre le dossier
        } else {
          // Si un avocat est assigné, l'utilisateur demande un retour
          message = "L'utilisateur demande un retour de l'avocat.";
          newStatus = "EN_ATTENTE_RETOUR";
        }
      } else if (user.role === UserRole.AVOCAT) {
        message = "L'avocat demande un retour de l'utilisateur.";
        newStatus = "EN_ATTENTE_RETOUR";
      } else {
        message = "Demande de retour.";
        newStatus = "EN_ATTENTE_RETOUR";
      }

      // Envoyer un commentaire
      const commentResponse = await fetch(`/api/procedures/${procedure.id}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          content: message,
        }),
      });

      if (!commentResponse.ok) {
        const data = await commentResponse.json();
        throw new Error(data.error || "Erreur lors de l'envoi de la demande");
      }

      // Mettre à jour le statut de la procédure
      const statusResponse = await fetch(`/api/procedures/${procedure.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: newStatus,
        }),
      });

      if (!statusResponse.ok) {
        const data = await statusResponse.json();
        throw new Error(data.error || "Erreur lors de la mise à jour du statut");
      }

      // Rafraîchir la procédure
      await fetchProcedure();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setRequestingRetour(false);
    }
  };

  const handleSaveInvoiceNumbers = async () => {
    if (!procedure) return;
    
    setSavingInvoiceNumbers(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      // Mettre à jour chaque document de facture
      const updatePromises = Object.entries(editingInvoiceNumbers).map(
        async ([documentId, invoiceData]) => {
          const response = await fetch(
            `/api/procedures/${procedure.id}/documents/${documentId}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                numeroFacture: invoiceData.numeroFacture.trim() || null,
                dateFactureEchue: invoiceData.dateFactureEchue || null,
                montantDue: parseFloat(invoiceData.montantDue) || null,
                montantTTC: invoiceData.montantTTC,
              }),
            }
          );

          if (!response.ok) {
            const data = await response.json();
            throw new Error(data.error || "Erreur lors de la mise à jour");
          }

          return response.json();
        }
      );

      await Promise.all(updatePromises);

      // Rafraîchir la procédure
      await fetchProcedure();
      setShowManageInvoiceNumbers(false);
      setEditingInvoiceNumbers({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setSavingInvoiceNumbers(false);
    }
  };

  const handleAddDocuments = async () => {
    if (!procedure || !user) return;

    setAddingDocuments(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      // Vérifier que les factures ont leurs informations complètes
      const factures = filesByType.FACTURE || [];
      for (let i = 0; i < factures.length; i++) {
        const info = newFacturesInfo[i];
        if (!info || !info.numeroFacture?.trim()) {
          setError(`Veuillez renseigner le numéro de facture pour la facture ${i + 1}.`);
          setAddingDocuments(false);
          return;
        }
        if (!info.dateFactureEchue) {
          setError(`Veuillez renseigner la date facture échue pour la facture ${i + 1}.`);
          setAddingDocuments(false);
          return;
        }
        if (!info.montantDue || parseFloat(info.montantDue) <= 0) {
          setError(`Veuillez renseigner un montant dû valide pour la facture ${i + 1}.`);
          setAddingDocuments(false);
          return;
        }
      }

      // Collecter tous les fichiers avec leur type et informations
      const allDocuments: Array<{
        fileName: string;
        filePath: string;
        fileSize: number;
        mimeType: string;
        type: string;
        numeroFacture?: string | null;
        dateFactureEchue?: string | null;
        montantDue?: number | null;
        montantTTC?: boolean | null;
      }> = [];
      Object.entries(filesByType).forEach(([type, files]) => {
        files.forEach((file, index) => {
          const documentData: {
            fileName: string;
            filePath: string;
            fileSize: number;
            mimeType: string;
            type: string;
            numeroFacture?: string | null;
            dateFactureEchue?: string | null;
            montantDue?: number | null;
            montantTTC?: boolean | null;
          } = {
            ...file,
            type,
          };
          
          // Ajouter les informations de facture si c'est une facture
          if (type === "FACTURE") {
            const info = newFacturesInfo[index];
            if (info) {
              documentData.numeroFacture = info.numeroFacture.trim() || null;
              documentData.dateFactureEchue = info.dateFactureEchue || null;
              documentData.montantDue = parseFloat(info.montantDue) || null;
              documentData.montantTTC = info.montantTTC ?? true;
            }
          }
          
          allDocuments.push(documentData);
        });
      });

      if (allDocuments.length === 0) {
        setError("Veuillez sélectionner au moins un fichier");
        setAddingDocuments(false);
        return;
      }

      const response = await fetch(`/api/procedures/${procedure.id}/documents`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          documents: allDocuments,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de l'ajout des documents");
      }

      // Rafraîchir la procédure
      await fetchProcedure();
      // Réinitialiser les fichiers
      setFilesByType({
        FACTURE: [],
        DEVIS: [],
        CONTRAT: [],
        EMAIL: [],
        WHATSAPP_SMS: [],
        AUTRES_PREUVES: [],
      });
      setShowAddDocuments(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setAddingDocuments(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const formatAmount = (amount: number | null) => {
    if (amount === null || amount === undefined) return "Non renseigné";
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
    }).format(amount);
  };

  const isImage = (mimeType: string) => {
    return mimeType.startsWith("image/");
  };

  const isPDF = (mimeType: string) => {
    return mimeType === "application/pdf";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (error || !procedure) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="container mx-auto px-4 py-8">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error || "Procédure non trouvée"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <div className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-20 items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Détail du dossier</h1>
                <p className="text-sm text-muted-foreground">
                  {procedure.client?.prenom} {procedure.client?.nom}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  statusColors[procedure.status]
                }`}
              >
                {statusLabels[procedure.status]}
              </span>
              {/* Bouton pour changer le statut */}
              {user && (
                <>
                  {user.role === UserRole.AVOCAT && procedure.avocatId === user.id && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowStatusChange(true);
                          setSelectedStatus(procedure.status);
                        }}
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        Changer le statut
                      </Button>
                      <Sheet open={showStatusChange} onOpenChange={setShowStatusChange}>
                        <SheetContent>
                          <SheetHeader>
                            <SheetTitle>Changer le statut du dossier</SheetTitle>
                            <SheetDescription>
                              Sélectionnez le nouveau statut pour ce dossier.
                            </SheetDescription>
                          </SheetHeader>
                          <div className="py-6">
                            <Label className="mb-2 block text-sm font-medium">
                              Nouveau statut
                            </Label>
                            <select
                              value={selectedStatus}
                              onChange={(e) => setSelectedStatus(e.target.value as ProcedureStatusType)}
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                              {Object.entries(statusLabels).map(([key, label]) => (
                                <option key={key} value={key}>
                                  {label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex gap-2 justify-end pt-4 border-t">
                            <Button
                              variant="ghost"
                              onClick={() => {
                                setShowStatusChange(false);
                                setSelectedStatus("");
                              }}
                            >
                              Annuler
                            </Button>
                            <Button
                              onClick={handleChangeStatus}
                              disabled={changingStatus || selectedStatus === procedure.status || !selectedStatus}
                            >
                              {changingStatus ? "Changement..." : "Valider"}
                            </Button>
                          </div>
                        </SheetContent>
                      </Sheet>
                    </>
                  )}
                  {user.role === UserRole.USER && procedure.status !== "RESOLU" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedStatus("RESOLU");
                        handleChangeStatus();
                      }}
                      disabled={changingStatus}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {changingStatus ? "Changement..." : "Marquer comme résolu"}
                    </Button>
                  )}
                </>
              )}
              {/* Bouton pour demander un retour */}
              {user && 
               user.role === UserRole.USER && 
               procedure.status !== "EN_ATTENTE_RETOUR" && 
               procedure.status !== "EN_ATTENTE_REPONSE" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRequestRetour}
                  disabled={requestingRetour}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {requestingRetour 
                    ? "Envoi..." 
                    : procedure.avocatId === null 
                      ? "Demander à un avocat d'examiner le dossier"
                      : "Demander un retour"}
                </Button>
              )}
              {/* Bouton pour demander un retour (pour les avocats) */}
              {user && 
               user.role === UserRole.AVOCAT && 
               procedure.avocatId === user.id &&
               procedure.status !== "EN_ATTENTE_RETOUR" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRequestRetour}
                  disabled={requestingRetour}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  {requestingRetour ? "Envoi..." : "Demander un retour"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Informations principales */}
          <div className="lg:col-span-1 space-y-6">
            {/* Chat en haut - seulement si le dossier a été pris */}
            {user && procedure.avocatId !== null && (
              <div className="rounded-lg border bg-card shadow-sm" style={{ height: "600px" }}>
                <Chat
                  procedureId={procedure.id}
                  currentUserRole={user.role}
                  currentUserId={user.id}
                  canComment={user.role === UserRole.USER || canCommentDossier(user.role)}
                  onMessageSent={fetchProcedure}
                />
              </div>
            )}

            {/* Informations en bas */}
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Informations</h2>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-2">Client</p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Nom complet</p>
                      <p className="text-base font-semibold">
                        {procedure.client?.prenom} {procedure.client?.nom}
                      </p>
                    </div>
                    {/* Nom de société, email, téléphone - seulement si le dossier a été pris */}
                    {procedure.client?.nomSociete && (
                      <div>
                        <p className="text-xs text-muted-foreground">Nom de société</p>
                        <p className="text-sm font-medium">
                          {procedure.client.nomSociete}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-muted-foreground">SIRET</p>
                      <p className="text-sm font-medium">{procedure.client?.siret}</p>
                    </div>
                    {procedure.client?.adresse && (
                      <div>
                        <p className="text-xs text-muted-foreground">Adresse</p>
                        <p className="text-sm font-medium whitespace-pre-line">
                          {procedure.client.adresse}
                        </p>
                      </div>
                    )}
                    {procedure.client?.email && (
                      <div>
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="text-sm font-medium">
                          {procedure.client.email}
                        </p>
                      </div>
                    )}
                    {procedure.client?.telephone && (
                      <div>
                        <p className="text-xs text-muted-foreground">Téléphone</p>
                        <p className="text-sm font-medium">
                          {procedure.client.telephone}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-muted-foreground">Date de facture échue</p>
                  <p className="text-base">{formatDate(procedure.dateFactureEchue)}</p>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-muted-foreground">
                    Montant dû {procedure.montantTTC ? "(TTC)" : "(HT)"}
                  </p>
                  <p className="text-base font-semibold text-primary">
                    {formatAmount(procedure.montantDue)}
                  </p>
                </div>

                {/* Dates de relance */}
                <div className="border-t pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-muted-foreground">Dates de relance</p>
                    {!editingRelanceDates && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setRelanceDates({
                            dateRelance: procedure.dateRelance 
                              ? new Date(procedure.dateRelance).toISOString().split('T')[0] 
                              : "",
                            dateRelance2: procedure.dateRelance2 
                              ? new Date(procedure.dateRelance2).toISOString().split('T')[0] 
                              : "",
                          });
                          setEditingRelanceDates(true);
                        }}
                      >
                        <Edit2 className="h-4 w-4 mr-1" />
                        Modifier
                      </Button>
                    )}
                  </div>
                  {editingRelanceDates ? (
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">Date de relance</Label>
                        <Input
                          type="date"
                          value={relanceDates.dateRelance}
                          onChange={(e) =>
                            setRelanceDates({ ...relanceDates, dateRelance: e.target.value })
                          }
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Date de relance 2 (minimum 7 jours après la première)</Label>
                        <Input
                          type="date"
                          value={relanceDates.dateRelance2}
                          onChange={(e) => {
                            const newDate = e.target.value;
                            setRelanceDates({ ...relanceDates, dateRelance2: newDate });
                            // Valider en temps réel
                            if (relanceDates.dateRelance && newDate) {
                              const dateRelance1 = new Date(relanceDates.dateRelance);
                              const dateRelance2 = new Date(newDate);
                              const diffTime = dateRelance2.getTime() - dateRelance1.getTime();
                              const diffDays = diffTime / (1000 * 60 * 60 * 24);
                              if (diffDays < 7) {
                                setError("La date de relance 2 doit être au moins 7 jours après la date de relance 1.");
                              } else {
                                setError("");
                              }
                            }
                          }}
                          min={relanceDates.dateRelance ? (() => {
                            const minDate = new Date(relanceDates.dateRelance);
                            minDate.setDate(minDate.getDate() + 7);
                            return minDate.toISOString().split('T')[0];
                          })() : undefined}
                          className="mt-1"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={async () => {
                            // Valider que la date de relance 2 est au moins 7 jours après la date de relance 1
                            if (relanceDates.dateRelance && relanceDates.dateRelance2) {
                              const dateRelance1 = new Date(relanceDates.dateRelance);
                              const dateRelance2 = new Date(relanceDates.dateRelance2);
                              const diffTime = dateRelance2.getTime() - dateRelance1.getTime();
                              const diffDays = diffTime / (1000 * 60 * 60 * 24);
                              
                              if (diffDays < 7) {
                                setError("La date de relance 2 doit être au moins 7 jours après la date de relance 1.");
                                return;
                              }
                            }

                            setSavingRelanceDates(true);
                            setError("");
                            try {
                              const token = localStorage.getItem("token");
                              const response = await fetch(`/api/procedures/${procedure.id}`, {
                                method: "PATCH",
                                headers: {
                                  "Content-Type": "application/json",
                                  Authorization: `Bearer ${token}`,
                                },
                                body: JSON.stringify({
                                  dateRelance: relanceDates.dateRelance || null,
                                  dateRelance2: relanceDates.dateRelance2 || null,
                                }),
                              });

                              if (!response.ok) {
                                throw new Error("Erreur lors de la sauvegarde");
                              }

                              const updated = await response.json();
                              setProcedure(updated);
                              setEditingRelanceDates(false);
                            } catch (err) {
                              setError(err instanceof Error ? err.message : "Erreur lors de la sauvegarde");
                            } finally {
                              setSavingRelanceDates(false);
                            }
                          }}
                          disabled={savingRelanceDates}
                        >
                          <Save className="h-4 w-4 mr-1" />
                          Enregistrer
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingRelanceDates(false);
                            setRelanceDates({
                              dateRelance: procedure.dateRelance 
                                ? new Date(procedure.dateRelance).toISOString().split('T')[0] 
                                : "",
                              dateRelance2: procedure.dateRelance2 
                                ? new Date(procedure.dateRelance2).toISOString().split('T')[0] 
                                : "",
                            });
                          }}
                          disabled={savingRelanceDates}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Annuler
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {procedure.dateRelance ? (
                        <p className="text-base">
                          Date de relance : {formatDate(procedure.dateRelance)}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Aucune date de relance</p>
                      )}
                      {procedure.dateRelance2 ? (
                        <p className="text-base">
                          Date de relance 2 : {formatDate(procedure.dateRelance2)}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Aucune date de relance 2</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Dates de création/modification - seulement si le dossier a été pris */}
                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-muted-foreground">Créée le</p>
                  <p className="text-base">{formatDate(procedure.createdAt)}</p>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm font-medium text-muted-foreground">Modifiée le</p>
                  <p className="text-base">{formatDate(procedure.updatedAt)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Contexte et documents */}
          <div className="lg:col-span-2 space-y-6">
            {/* Actions pour les avocats */}
            {user && user.role === UserRole.AVOCAT && (
              <div className="space-y-4">
                {/* Bouton pour voir le dossier en détails */}
                {procedure.avocatId === user.id && (
                  <div className="rounded-lg border bg-card p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold mb-1">Préparer l'envoi par recommandé</h3>
                        <p className="text-sm text-muted-foreground">
                          Sélectionnez les documents à fusionner pour l'envoi
                        </p>
                      </div>
                      <Button
                        onClick={() => router.push(`/dashboard/${procedure.id}/details`)}
                        variant="default"
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Voir le dossier
                      </Button>
                    </div>
                  </div>
                )}
                {/* Prendre le dossier si nouveau */}
                {procedure.status === "NOUVEAU" && (
                  <div className="rounded-lg border bg-card p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold mb-1">Nouveau dossier</h3>
                        <p className="text-sm text-muted-foreground">
                          Prenez ce dossier pour commencer à le traiter
                        </p>
                      </div>
                      <Button
                        onClick={async () => {
                          if (!procedure || !user) return;
                          setTakingDossier(true);
                          setError("");
                          try {
                            const token = localStorage.getItem("token");
                            if (!token) {
                              router.push("/login");
                              return;
                            }
                            const response = await fetch(`/api/procedures/${procedure.id}`, {
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
                            if (!response.ok) {
                              const data = await response.json();
                              throw new Error(data.error || "Erreur lors de la prise du dossier");
                            }
                            await fetchProcedure();
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "Une erreur est survenue");
                          } finally {
                            setTakingDossier(false);
                          }
                        }}
                        disabled={takingDossier}
                        variant="default"
                      >
                        <Briefcase className="mr-2 h-4 w-4" />
                        {takingDossier ? "En cours..." : "Prendre le dossier"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Analyse du dossier */}
                {procedure.status !== "NOUVEAU" && (
                  <div className="space-y-4">
                    <div className="rounded-lg border bg-card p-6 shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold mb-1">Analyse du dossier</h3>
                          <p className="text-sm text-muted-foreground">
                            {procedure.analysed 
                              ? "Le dossier a été analysé" 
                              : "Marquer le dossier comme analysé pour pouvoir écrire la mise en demeure"}
                          </p>
                        </div>
                        {!procedure.analysed ? (
                          <Button
                            onClick={handleMarkAsAnalysed}
                            disabled={markingAnalysed}
                            variant="outline"
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            {markingAnalysed ? "En cours..." : "Marquer comme analysé"}
                          </Button>
                        ) : (
                          <div className="flex gap-2">
                            <Button
                              onClick={() => {
                                setMiseEnDemeureContent(procedure.miseEnDemeure || "");
                                setShowMiseEnDemeure(true);
                              }}
                              variant="default"
                            >
                              <FilePenLine className="mr-2 h-4 w-4" />
                              Écrire la mise en demeure
                            </Button>
                            {procedure.echeancier && Array.isArray(procedure.echeancier) && procedure.echeancier.length > 0 && (
                              <Button
                                onClick={() => {
                                  setShowEcheancier(true);
                                }}
                                variant="outline"
                              >
                                <Calendar className="mr-2 h-4 w-4" />
                                Écrire l'écheancier
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bouton pour envoyer la mise en demeure */}
                    {procedure.analysed && procedure.miseEnDemeure && procedure.status !== "EN_COURS" && (
                      <div className="rounded-lg border bg-card p-6 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-lg font-semibold mb-1">Mise en demeure</h3>
                            <p className="text-sm text-muted-foreground">
                              La mise en demeure a été rédigée. Cliquez pour l'envoyer et passer le dossier en cours.
                            </p>
                          </div>
                          <Button
                            onClick={handleSendMiseEnDemeure}
                            disabled={sendingMiseEnDemeure}
                            variant="default"
                            className="bg-green-600 hover:bg-green-700"
                          >
                            <Send className="mr-2 h-4 w-4" />
                            {sendingMiseEnDemeure ? "Envoi..." : "Mise en demeure envoyée"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Contexte */}
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Contexte</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">{procedure.contexte}</p>
            </div>

            {/* Écheancier - seulement si le dossier a été pris */}
            {procedure.echeancier && Array.isArray(procedure.echeancier) && procedure.echeancier.length > 0 && (
              <div className="rounded-lg border bg-card p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-semibold flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Écheancier de paiement
                </h2>
                <div className="space-y-3">
                  {procedure.echeancier.map((echeance: Echeance, index: number) => (
                    <div
                      key={index}
                      className="flex items-center justify-between rounded-lg border bg-muted/50 p-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            {formatDate(echeance.date)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Échéance {index + 1} sur {procedure.echeancier!.length}
                          </p>
                        </div>
                      </div>
                      <p className="text-lg font-semibold text-primary">
                        {formatAmount(echeance.montant)}
                      </p>
                    </div>
                  ))}
                  <div className="mt-4 flex items-center justify-between border-t pt-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      Total de l'écheancier
                    </p>
                    <p className="text-lg font-bold">
                      {formatAmount(
                        procedure.echeancier.reduce(
                          (sum: number, e: Echeance) => sum + (typeof e.montant === 'number' ? e.montant : parseFloat((e.montant as any).toString())),
                          0
                        )
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Documents */}
            <div className="rounded-lg border bg-card p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Documents ({procedure.documents?.length || 0})
                </h2>
                <div className="flex gap-2">
                  {/* Bouton pour gérer les numéros de facture */}
                  {procedure.documents?.some(doc => doc.type === "FACTURE") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowManageInvoiceNumbers(!showManageInvoiceNumbers);
                        // Initialiser les informations de facture en édition
                        const invoiceDocs = procedure.documents?.filter(doc => doc.type === "FACTURE") || [];
                        const initialData: Record<string, InvoiceEditData> = {};
                        invoiceDocs.forEach(doc => {
                          initialData[doc.id] = {
                            numeroFacture: doc.numeroFacture || "",
                            dateFactureEchue: doc.dateFactureEchue ? new Date(doc.dateFactureEchue).toISOString().split('T')[0] : "",
                            montantDue: doc.montantDue?.toString() || "",
                            montantTTC: doc.montantTTC ?? true,
                          };
                        });
                        setEditingInvoiceNumbers(initialData);
                      }}
                    >
                      <Edit2 className="mr-2 h-4 w-4" />
                      {showManageInvoiceNumbers ? "Annuler" : "Informations des factures"}
                    </Button>
                  )}
                  {user && (user.role === UserRole.USER || canUploadDocuments(user.role)) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAddDocuments(!showAddDocuments)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {showAddDocuments ? "Annuler" : "Ajouter"}
                    </Button>
                  )}
                </div>
              </div>

              {/* Section de gestion des informations de facture */}
              {showManageInvoiceNumbers && (
                <div className="mb-6 rounded-lg border bg-muted/50 p-4">
                  <h3 className="mb-4 text-sm font-semibold">Gérer les informations des factures</h3>
                  <div className="space-y-4">
                    {procedure.documents
                      ?.filter(doc => doc.type === "FACTURE")
                      ?.map((document) => {
                        const invoiceData = editingInvoiceNumbers[document.id] || {
                          numeroFacture: "",
                          dateFactureEchue: "",
                          montantDue: "",
                          montantTTC: true,
                        };
                        return (
                          <div key={document.id} className="rounded-lg border bg-background p-4 space-y-3">
                            <p className="text-sm font-medium mb-2">{document.fileName}</p>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-xs">Numéro de facture *</Label>
                                <Input
                                  value={invoiceData.numeroFacture}
                                  onChange={(e) => {
                                    setEditingInvoiceNumbers({
                                      ...editingInvoiceNumbers,
                                      [document.id]: { ...invoiceData, numeroFacture: e.target.value },
                                    });
                                  }}
                                  placeholder="FAC-2024-001"
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Date facture échue *</Label>
                                <Input
                                  type="date"
                                  value={invoiceData.dateFactureEchue}
                                  onChange={(e) => {
                                    setEditingInvoiceNumbers({
                                      ...editingInvoiceNumbers,
                                      [document.id]: { ...invoiceData, dateFactureEchue: e.target.value },
                                    });
                                  }}
                                />
                              </div>
                              <div>
                                <Label className="text-xs">Montant dû (€) *</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={invoiceData.montantDue}
                                  onChange={(e) => {
                                    setEditingInvoiceNumbers({
                                      ...editingInvoiceNumbers,
                                      [document.id]: { ...invoiceData, montantDue: e.target.value },
                                    });
                                  }}
                                  placeholder="0.00"
                                />
                              </div>
                              <div className="flex items-end">
                                <div className="flex items-center space-x-2 h-10">
                                  <input
                                    type="checkbox"
                                    checked={invoiceData.montantTTC}
                                    onChange={(e) => {
                                      setEditingInvoiceNumbers({
                                        ...editingInvoiceNumbers,
                                        [document.id]: { ...invoiceData, montantTTC: e.target.checked },
                                      });
                                    }}
                                    className="h-4 w-4"
                                  />
                                  <Label className="text-xs cursor-pointer">Montant TTC</Label>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={handleSaveInvoiceNumbers}
                        disabled={savingInvoiceNumbers}
                        size="sm"
                        className="flex-1"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {savingInvoiceNumbers ? "Enregistrement..." : "Enregistrer"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowManageInvoiceNumbers(false);
                          setEditingInvoiceNumbers({});
                        }}
                        disabled={savingInvoiceNumbers}
                        size="sm"
                      >
                        Annuler
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Formulaire d'ajout de documents */}
              {showAddDocuments && user && (
                <div className="mb-6 rounded-lg border bg-muted/50 p-4">
                  <h3 className="mb-4 text-sm font-semibold">Ajouter des documents</h3>
                  <div className="space-y-4">
                    {[
                      { value: "FACTURE", label: "Facture" },
                      { value: "DEVIS", label: "Devis" },
                      { value: "CONTRAT", label: "Contrat" },
                      { value: "EMAIL", label: "Email" },
                      { value: "WHATSAPP_SMS", label: "WhatsApp ou SMS" },
                      { value: "AUTRES_PREUVES", label: "Autres preuves" },
                    ].map((docType) => {
                      const files = filesByType[docType.value] || [];
                      return (
                        <div key={docType.value}>
                          <FileUpload
                            type={docType.value}
                            label={docType.label}
                            uploadedFiles={files}
                            onFilesChange={(files) => handleFilesChange(docType.value, files)}
                          />
                          {/* Informations pour les nouvelles factures */}
                          {docType.value === "FACTURE" && files.length > 0 && (
                            <div className="mt-4 space-y-4">
                              <Label className="text-sm font-medium">
                                Informations des factures *
                              </Label>
                              {files.map((file, index) => {
                                const info = newFacturesInfo[index] || {
                                  numeroFacture: "",
                                  dateFactureEchue: "",
                                  montantDue: "",
                                  montantTTC: true,
                                };
                                return (
                                  <div key={index} className="rounded-lg border bg-background p-4 space-y-3">
                                    <p className="text-sm font-medium mb-2">{file.fileName}</p>
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <Label htmlFor={`new-numero-${index}`} className="text-xs">
                                          Numéro de facture *
                                        </Label>
                                        <Input
                                          id={`new-numero-${index}`}
                                          value={info.numeroFacture}
                                          onChange={(e) => {
                                            setNewFacturesInfo({
                                              ...newFacturesInfo,
                                              [index]: { ...info, numeroFacture: e.target.value },
                                            });
                                          }}
                                          placeholder="FAC-2024-001"
                                          required
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor={`new-date-${index}`} className="text-xs">
                                          Date facture échue *
                                        </Label>
                                        <Input
                                          id={`new-date-${index}`}
                                          type="date"
                                          value={info.dateFactureEchue}
                                          onChange={(e) => {
                                            setNewFacturesInfo({
                                              ...newFacturesInfo,
                                              [index]: { ...info, dateFactureEchue: e.target.value },
                                            });
                                          }}
                                          required
                                        />
                                      </div>
                                      <div>
                                        <Label htmlFor={`new-montant-${index}`} className="text-xs">
                                          Montant dû (€) *
                                        </Label>
                                        <Input
                                          id={`new-montant-${index}`}
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={info.montantDue}
                                          onChange={(e) => {
                                            setNewFacturesInfo({
                                              ...newFacturesInfo,
                                              [index]: { ...info, montantDue: e.target.value },
                                            });
                                          }}
                                          placeholder="0.00"
                                          required
                                        />
                                      </div>
                                      <div className="flex items-end">
                                        <div className="flex items-center space-x-2 h-10">
                                          <input
                                            type="checkbox"
                                            id={`new-ttc-${index}`}
                                            checked={info.montantTTC}
                                            onChange={(e) => {
                                              setNewFacturesInfo({
                                                ...newFacturesInfo,
                                                [index]: { ...info, montantTTC: e.target.checked },
                                              });
                                            }}
                                            className="h-4 w-4"
                                          />
                                          <Label htmlFor={`new-ttc-${index}`} className="text-xs cursor-pointer">
                                            Montant TTC
                                          </Label>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div className="flex gap-2">
                      <Button
                        onClick={handleAddDocuments}
                        disabled={addingDocuments}
                        className="flex-1"
                      >
                        {addingDocuments ? "Ajout en cours..." : "Ajouter les documents"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowAddDocuments(false);
                          setFilesByType({
                            FACTURE: [],
                            DEVIS: [],
                            CONTRAT: [],
                            EMAIL: [],
                            WHATSAPP_SMS: [],
                            AUTRES_PREUVES: [],
                          });
                          setNewFacturesInfo({});
                        }}
                        disabled={addingDocuments}
                      >
                        Annuler
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {!procedure.documents || procedure.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun document associé</p>
              ) : (
                <div className="space-y-4">
                  {procedure.documents?.map((document) => {
                    // Vérifier que le document a une URL valide
                    if (!document.filePath || document.filePath.trim() === "") {
                      return (
                        <div
                          key={document.id}
                          className="rounded-lg border bg-muted/50 p-4"
                        >
                          <div className="flex items-center gap-2 text-sm text-destructive">
                            <FileText className="h-4 w-4" />
                            <span>Document sans URL valide: {document.fileName}</span>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={document.id}
                        className="rounded-lg border bg-muted/50 p-4"
                      >
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
                            {document.type === "FACTURE" && (
                              <div className="mt-2 space-y-1">
                                {document.numeroFacture && (
                                  <p className="text-xs font-medium text-primary">
                                    Numéro: {document.numeroFacture}
                                  </p>
                                )}
                                {document.dateFactureEchue && (
                                  <p className="text-xs text-muted-foreground">
                                    Date échue: {formatDate(document.dateFactureEchue)}
                                  </p>
                                )}
                                {document.montantDue !== null && (
                                  <p className="text-xs text-muted-foreground">
                                    Montant: {formatAmount(document.montantDue)} {document.montantTTC ? "(TTC)" : "(HT)"}
                                  </p>
                                )}
                              </div>
                            )}
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
                        
                        {/* Lecteur de document */}
                        <div className="mt-3 rounded border bg-background">
                          <DocumentViewer
                            url={document.filePath}
                            mimeType={document.mimeType || "application/octet-stream"}
                            fileName={document.fileName}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar pour la mise en demeure */}
      <Sheet open={showMiseEnDemeure} onOpenChange={setShowMiseEnDemeure}>
        <SheetContent className="w-[75%] max-w-none overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="sr-only">Éditeur de mise en demeure</SheetTitle>
          </SheetHeader>
          {procedure && (
            <MiseEnDemeureEditor
              procedureId={procedure.id}
              initialContent={procedure.miseEnDemeure}
              procedureData={{
                contexte: procedure.contexte,
                montantDue: procedure.montantDue,
                dateFactureEchue: procedure.dateFactureEchue,
                client: {
                  nom: procedure.client?.nom || "",
                  prenom: procedure.client?.prenom || "",
                  siret: procedure.client?.siret || "",
                  nomSociete: procedure.client?.nomSociete || null,
                  email: procedure.client?.email || "",
                  telephone: procedure.client?.telephone || "",
                },
              }}
              onSave={async (content: string) => {
                await handleSaveMiseEnDemeure(content);
              }}
              onCancel={() => {
                setMiseEnDemeureContent(procedure?.miseEnDemeure || "");
                setShowMiseEnDemeure(false);
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Sidebar pour l'écheancier */}
      <Sheet open={showEcheancier} onOpenChange={setShowEcheancier}>
        <SheetContent className="w-[75%] max-w-none overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="sr-only">Éditeur d'écheancier</SheetTitle>
          </SheetHeader>
          {procedure && (
            <EcheancierEditor
              procedureId={procedure.id}
              initialEcheancier={procedure.echeancier}
              onSave={async (echeancier: Echeance[]) => {
                await handleSaveEcheancier(echeancier);
              }}
              onCancel={() => {
                setShowEcheancier(false);
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}


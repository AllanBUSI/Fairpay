"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FileUpload } from "@/components/ui/file-upload";
import { Plus, X, ShoppingCart } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProcedureStatus, UserRole } from "@/app/generated/prisma/enums";

interface UploadedFile {
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  type: string;
}

const DOCUMENT_TYPES = [
  { value: "FACTURE", label: "Facture" },
  { value: "DEVIS", label: "Devis" },
  { value: "CONTRAT", label: "Contrat" },
  { value: "EMAIL", label: "Email" },
  { value: "WHATSAPP_SMS", label: "WhatsApp ou SMS" },
  { value: "AUTRES_PREUVES", label: "Autres preuves" },
];

export default function NewProcedurePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const procedureId = searchParams.get("id");
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [hasFacturation, setHasFacturation] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [showFacturationPrompt, setShowFacturationPrompt] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoCodeApplied, setPromoCodeApplied] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoError, setPromoError] = useState("");
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [promoCouponId, setPromoCouponId] = useState<string | null>(null);
  const [isEditingDraft, setIsEditingDraft] = useState(false);
  const [priceIds, setPriceIds] = useState<{
    abonnement: string | null;
    miseEnDemeureSansAbo: string | null;
    miseEnDemeureAvecAbo: string | null;
    echeancier: string | null;
  } | null>(null);

  useEffect(() => {
    const checkUserRoleAndLoadDraft = async () => {
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
          const role = data.user.role;
          setUserRole(role);

          // Rediriger les avocats vers le dashboard
          if (role === UserRole.AVOCAT) {
            router.push("/dashboard");
            return;
          }

          // Vérifier si l'utilisateur a un abonnement actif
          await checkSubscription(token);

          // Si un ID de procédure est fourni, charger le brouillon
          if (procedureId) {
            await loadDraftProcedure(procedureId, token);
          }
        } else if (response.status === 401) {
          localStorage.removeItem("token");
          router.push("/login");
          return;
        }
      } catch (err) {
        console.error("Erreur lors de la vérification du rôle:", err);
        router.push("/dashboard");
      } finally {
        setLoading(false);
      }
    };

    checkUserRoleAndLoadDraft();
    fetchPriceIds();
  }, [router, procedureId]);

  const fetchPriceIds = async () => {
    try {
      const response = await fetch("/api/stripe/get-price-ids");
      if (response.ok) {
        const data = await response.json();
        if (data.priceIds) {
          setPriceIds(data.priceIds);
        }
      } else {
        console.error("Erreur lors de la récupération des Price ID");
      }
    } catch (err) {
      console.error("Erreur lors de la récupération des Price ID:", err);
    }
  };

  const loadDraftProcedure = async (id: string, token: string) => {
    try {
      const response = await fetch(`/api/procedures/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const procedure = data.procedure;

        // Vérifier que c'est bien un brouillon
        if (procedure.status !== "BROUILLONS") {
          setError("Ce dossier n'est pas un brouillon");
          return;
        }

        setIsEditingDraft(true);

        // Pré-remplir le formulaire avec les données du brouillon
        if (procedure.client) {
          setFormData({
            nom: procedure.client.nom ?? "",
            prenom: procedure.client.prenom ?? "",
            siret: procedure.client.siret ?? "",
            nomSociete: procedure.client.nomSociete ?? "",
            adresse: procedure.client.adresse ?? "",
            codePostal: procedure.client.codePostal ?? "",
            ville: procedure.client.ville ?? "",
            email: procedure.client.email ?? "",
            numeroFacture: procedure.numeroFacture ?? "",
            telephone: procedure.client.telephone ?? "",
            contexte: procedure.contexte ?? "",
            dateFactureEchue: procedure.dateFactureEchue
              ? new Date(procedure.dateFactureEchue).toISOString().split("T")[0]
              : "",
            montantDue: procedure.montantDue != null ? procedure.montantDue.toString() : "",
            montantTTC: procedure.montantTTC ?? true,
            dateRelance: procedure.dateRelance
              ? new Date(procedure.dateRelance).toISOString().split("T")[0]
              : "",
            dateRelance2: procedure.dateRelance2
              ? new Date(procedure.dateRelance2).toISOString().split("T")[0]
              : "",
          });
        }

        // Charger les documents
        if (procedure.documents && procedure.documents.length > 0) {
          const filesByType: Record<string, UploadedFile[]> = {
            FACTURE: [],
            DEVIS: [],
            CONTRAT: [],
            EMAIL: [],
            WHATSAPP_SMS: [],
            AUTRES_PREUVES: [],
          };

          const facturesInfo: Record<number, {
            numeroFacture: string;
            dateFactureEchue: string;
            montantDue: string;
            montantTTC: boolean;
          }> = {};

          procedure.documents.forEach((doc: any, index: number) => {
            const file: UploadedFile = {
              fileName: doc.fileName,
              filePath: doc.filePath,
              fileSize: doc.fileSize,
              mimeType: doc.mimeType,
              type: doc.type,
            };

            filesByType[doc.type].push(file);

            // Si c'est une facture, récupérer les infos
            if (doc.type === "FACTURE") {
              const factureIndex = filesByType.FACTURE.length - 1;
              facturesInfo[factureIndex] = {
                numeroFacture: doc.numeroFacture ?? "",
                dateFactureEchue: doc.dateFactureEchue
                  ? new Date(doc.dateFactureEchue).toISOString().split("T")[0]
                  : "",
                montantDue: doc.montantDue != null ? doc.montantDue.toString() : "",
                montantTTC: doc.montantTTC ?? true,
              };
            }
          });

          setFilesByType(filesByType);
          setFacturesInfo(facturesInfo);
        }

        // Charger l'écheancier si présent
        if (procedure.echeancier && Array.isArray(procedure.echeancier)) {
          setHasEcheancier(true);
          setNombreEcheances(procedure.echeancier.length);
          // Vous pouvez aussi charger les dates si nécessaire
        }
      } else {
        setError("Impossible de charger le brouillon");
      }
    } catch (err) {
      console.error("Erreur lors du chargement du brouillon:", err);
      setError("Erreur lors du chargement du brouillon");
    }
  };

  const checkSubscription = async (token: string) => {
    try {
      const response = await fetch("/api/stripe/check-subscription", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.subscription) {
          const isActive = data.subscription.status === "ACTIVE" || data.subscription.status === "TRIALING";
          setIsSubscribed(isActive);
          // Si l'utilisateur est abonné, activer automatiquement hasFacturation
          if (isActive) {
            setHasFacturation(true);
          }
        } else {
          setIsSubscribed(false);
        }
      }
    } catch (err) {
      console.error("Erreur lors de la vérification de l'abonnement:", err);
      setIsSubscribed(false);
    }
  };

  // Form state
  const [formData, setFormData] = useState({
    nom: "",
    prenom: "",
    siret: "",
    numeroFacture: "",
    nomSociete: "",
    adresse: "",
    codePostal: "",
    ville: "",
    email: "",
    telephone: "",
    contexte: "",
    dateFactureEchue: "",
    montantDue: "",
    montantTTC: true,
    dateRelance: "",
    dateRelance2: "",
  });

  // Informations pour chaque facture
  interface FactureInfo {
    numeroFacture: string;
    dateFactureEchue: string;
    montantDue: string;
    montantTTC: boolean;
  }
  const [facturesInfo, setFacturesInfo] = useState<Record<number, FactureInfo>>({});

  // Écheancier state
  const [hasEcheancier, setHasEcheancier] = useState(false);
  const [nombreEcheances, setNombreEcheances] = useState(1);
  const [delaiPaiement, setDelaiPaiement] = useState(1); // en mois

  // Files state - un objet avec chaque type de document
  const [filesByType, setFilesByType] = useState<Record<string, UploadedFile[]>>({
    FACTURE: [],
    DEVIS: [],
    CONTRAT: [],
    EMAIL: [],
    WHATSAPP_SMS: [],
    AUTRES_PREUVES: [],
  });

  const handleFilesChange = (type: string, files: UploadedFile[]) => {
    setFilesByType((prev) => ({
      ...prev,
      [type]: files,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Vérifier que la facture est présente (obligatoire)
    if (filesByType.FACTURE.length === 0) {
      setError("La facture est obligatoire. Veuillez ajouter au moins une facture.");
      return;
    }

    // Vérifier que toutes les factures ont leurs informations complètes
    const factures = filesByType.FACTURE;
    for (let i = 0; i < factures.length; i++) {
      const info = facturesInfo[i];
      if (!info || !info.numeroFacture?.trim()) {
        setError(`Veuillez renseigner le numéro de facture pour la facture ${i + 1}.`);
        return;
      }
      if (!info.dateFactureEchue) {
        setError(`Veuillez renseigner la date facture échue pour la facture ${i + 1}.`);
        return;
      }
      if (!info.montantDue || parseFloat(info.montantDue) <= 0) {
        setError(`Veuillez renseigner un montant dû valide pour la facture ${i + 1}.`);
        return;
      }
    }

    // Valider les dates de relance
    if (formData.dateRelance && formData.dateRelance2) {
      const dateRelance1 = new Date(formData.dateRelance);
      const dateRelance2 = new Date(formData.dateRelance2);
      const diffTime = dateRelance2.getTime() - dateRelance1.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      
      if (diffDays < 7) {
        setError("La date de relance 2 doit être au moins 7 jours après la date de relance 1.");
        return;
      }
    }

    // Afficher le panier
    setShowCart(true);
  };

  const handleConfirmCart = async () => {
    // Si l'utilisateur n'est pas abonné ET n'a pas coché la case facturation, afficher le dark pattern
    if (!isSubscribed && !hasFacturation) {
      setShowCart(false);
      setShowFacturationPrompt(true);
      return;
    }

    // Si l'utilisateur est abonné ou a coché la case facturation, procéder au paiement
    await handleProcessPayment();
  };

  const handleSkipFacturation = async () => {
    setShowFacturationPrompt(false);
    await handleProcessPayment();
  };

  const prepareProcedureData = () => {
    // Collecter tous les fichiers avec leur type et numéro de facture
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
          const info = facturesInfo[index];
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

    // Générer l'écheancier automatiquement si activé
    let echeancierData = null;
    if (hasEcheancier && nombreEcheances > 0 && nombreEcheances <= 5 && formData.montantDue) {
      const montantTotal = parseFloat(formData.montantDue);
      const montantParEcheance = montantTotal / nombreEcheances;
      const dateDebut = formData.dateFactureEchue ? new Date(formData.dateFactureEchue) : new Date();
      
      echeancierData = [];
      const nombreEcheancesLimite = Math.min(5, nombreEcheances);
      for (let i = 0; i < nombreEcheancesLimite; i++) {
        const dateEcheance = new Date(dateDebut);
        dateEcheance.setMonth(dateEcheance.getMonth() + (i + 1) * delaiPaiement);
        // Toujours mettre le jour au 5 du mois
        dateEcheance.setDate(5);
        
        echeancierData.push({
          date: dateEcheance.toISOString().split('T')[0],
          montant: Math.round(montantParEcheance * 100) / 100, // Arrondir à 2 décimales
        });
      }
    }

    return {
      ...formData,
      montantDue: formData.montantDue ? parseFloat(formData.montantDue) : null,
      status: ProcedureStatus.NOUVEAU,
      documents: allDocuments,
      echeancier: echeancierData,
      hasEcheancier,
      hasFacturation,
    };
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      // Préparer les données de la procédure (sans validation stricte pour le brouillon)
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
      
      // Collecter tous les fichiers uploadés (même si incomplets)
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
          
          // Ajouter les informations de facture si disponibles
          if (type === "FACTURE") {
            const info = facturesInfo[index];
            if (info) {
              documentData.numeroFacture = info.numeroFacture?.trim() || null;
              documentData.dateFactureEchue = info.dateFactureEchue || null;
              documentData.montantDue = info.montantDue ? parseFloat(info.montantDue) : null;
              documentData.montantTTC = info.montantTTC !== undefined ? Boolean(info.montantTTC) : null;
            }
          }
          
          allDocuments.push(documentData);
        });
      });

      // Générer l'écheancier si les données sont disponibles
      let echeancierData = null;
      if (hasEcheancier && nombreEcheances > 0 && nombreEcheances <= 5 && formData.montantDue) {
        const montantTotal = parseFloat(formData.montantDue);
        if (!isNaN(montantTotal) && montantTotal > 0) {
          const montantParEcheance = montantTotal / nombreEcheances;
          const dateDebut = formData.dateFactureEchue ? new Date(formData.dateFactureEchue) : new Date();
          
          echeancierData = [];
          const nombreEcheancesLimite = Math.min(5, nombreEcheances);
          for (let i = 0; i < nombreEcheancesLimite; i++) {
            const dateEcheance = new Date(dateDebut);
            dateEcheance.setMonth(dateEcheance.getMonth() + (i + 1) * delaiPaiement);
            dateEcheance.setDate(5);
            
            echeancierData.push({
              date: dateEcheance.toISOString().split('T')[0],
              montant: Math.round(montantParEcheance * 100) / 100,
            });
          }
        }
      }

      // Préparer les données avec des valeurs par défaut si manquantes
      const draftData = {
        nom: formData.nom || "Non renseigné",
        prenom: formData.prenom || "Non renseigné",
        siret: formData.siret || `DRAFT-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, // SIRET temporaire unique
        nomSociete: formData.nomSociete || null,
        adresse: formData.adresse || null,
        codePostal: formData.codePostal || null,
        ville: formData.ville || null,
        email: formData.email || null,
        telephone: formData.telephone || null,
        contexte: formData.contexte || "",
        dateFactureEchue: formData.dateFactureEchue ? new Date(formData.dateFactureEchue) : new Date(),
        montantDue: formData.montantDue ? parseFloat(formData.montantDue) : null,
        montantTTC: formData.montantTTC !== undefined ? Boolean(formData.montantTTC) : true,
        dateRelance: formData.dateRelance ? new Date(formData.dateRelance) : null,
        dateRelance2: formData.dateRelance2 ? new Date(formData.dateRelance2) : null,
        status: ProcedureStatus.BROUILLONS,
        documents: allDocuments,
        echeancier: echeancierData,
        hasEcheancier,
        hasFacturation,
      };

      // Créer la procédure en brouillon (sans paiement)
      const response = await fetch("/api/procedures", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(draftData),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || "Erreur lors de la sauvegarde");
      }

      // Rediriger vers la page de brouillons
      router.push("/dashboard/brouillons");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setSavingDraft(false);
    }
  };

  const handleValidatePromoCode = async () => {
    if (!promoCode.trim()) {
      setPromoError("Veuillez saisir un code promotionnel");
      return;
    }

    setValidatingPromo(true);
    setPromoError("");

    try {
      // Calculer le montant total HT
      let totalHT = 0;
      if (hasFacturation) {
        totalHT = 29 + 99;
      } else {
        totalHT = 179;
        if (hasEcheancier) {
          totalHT += 49;
        }
      }

      const response = await fetch("/api/promo/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: promoCode.trim(),
          amount: totalHT,
        }),
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        setPromoCodeApplied(true);
        setPromoDiscount(data.discount);
        setPromoCouponId(data.coupon?.id || null);
        setPromoError("");
      } else {
        setPromoCodeApplied(false);
        setPromoDiscount(0);
        setPromoCouponId(null);
        setPromoError(data.error || "Code promotionnel invalide");
      }
    } catch (err) {
      setPromoCodeApplied(false);
      setPromoDiscount(0);
      setPromoCouponId(null);
      setPromoError("Erreur lors de la validation du code");
    } finally {
      setValidatingPromo(false);
    }
  };

  const handleProcessPayment = async () => {
    // Préparer les données de la procédure
    const data = prepareProcedureData();
    // Ajouter l'ID de la procédure si on est en mode édition
    if (isEditingDraft && procedureId) {
      // @ts-expect-error: Adding missing property for editing
      data.procedureId = procedureId;
    }

    setSubmitting(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      // Calculer le montant total
      let totalHT = 0;
      if (hasFacturation) {
        totalHT = 29 + 99;
      } else {
        totalHT = 179;
        if (hasEcheancier) {
          totalHT += 49;
        }
      }
      const totalTTC = totalHT * 1.20 - promoDiscount;

      // Créer une session de checkout Stripe
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: totalTTC,
          currency: "eur",
          procedureData: data,
          hasFacturation,
          promoCode: promoCouponId || undefined,
          procedureId: isEditingDraft ? procedureId : undefined,
          successUrl: `${window.location.origin}/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/dashboard/new?payment=cancelled`,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erreur lors de la création de la session de paiement");
      }

      // Rediriger vers Stripe Checkout
      if (result.url) {
        window.location.href = result.url;
      } else {
        throw new Error("URL de paiement non disponible");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors du traitement du paiement");
      setSubmitting(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  // Si l'utilisateur est un avocat, ne rien afficher (redirection en cours)
  if (userRole === UserRole.AVOCAT) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isEditingDraft ? "Compléter le brouillon" : "Nouveau dossier"}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {isEditingDraft
                ? "Complétez votre brouillon et finalisez le paiement pour créer le dossier."
                : "Créez un nouveau dossier de procédure. Remplissez tous les champs requis."}
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Client Information */}
            <div>
              <h2 className="mb-4 text-lg font-semibold">Informations du client</h2>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="nom">Nom *</Label>
                  <Input
                    id="nom"
                    value={formData.nom}
                    onChange={(e) =>
                      setFormData({ ...formData, nom: e.target.value })
                    }
                    required
                    placeholder="Dupont"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="prenom">Prénom *</Label>
                  <Input
                    id="prenom"
                    value={formData.prenom}
                    onChange={(e) =>
                      setFormData({ ...formData, prenom: e.target.value })
                    }
                    required
                    placeholder="Jean"
                  />
                </div>
              </div>
              <div className="mt-4 grid gap-2">
                <Label htmlFor="siret">SIRET *</Label>
                <Input
                  id="siret"
                  value={formData.siret}
                  onChange={(e) =>
                    setFormData({ ...formData, siret: e.target.value })
                  }
                  required
                  placeholder="12345678901234"
                />
              </div>
              <div className="mt-4 grid gap-2">
                <Label htmlFor="nomSociete">Nom de société</Label>
                <Input
                  id="nomSociete"
                  value={formData.nomSociete}
                  onChange={(e) =>
                    setFormData({ ...formData, nomSociete: e.target.value })
                  }
                  placeholder="Nom de l'entreprise"
                />
              </div>
              <div className="mt-4 grid gap-2">
                <Label htmlFor="adresse">
                  Adresse (siège social ou adresse personnelle) <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="adresse"
                  value={formData.adresse}
                  onChange={(e) =>
                    setFormData({ ...formData, adresse: e.target.value })
                  }
                  placeholder="Numéro et nom de rue"
                  rows={2}
                  required
                />
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="codePostal">
                    Code postal <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="codePostal"
                    value={formData.codePostal}
                    onChange={(e) =>
                      setFormData({ ...formData, codePostal: e.target.value })
                    }
                    placeholder="75001"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="ville">
                    Ville <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="ville"
                    value={formData.ville}
                    onChange={(e) =>
                      setFormData({ ...formData, ville: e.target.value })
                    }
                    placeholder="Paris"
                    required
                  />
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                    placeholder="jean.dupont@example.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="telephone">Téléphone *</Label>
                  <Input
                    id="telephone"
                    type="tel"
                    value={formData.telephone}
                    onChange={(e) =>
                      setFormData({ ...formData, telephone: e.target.value })
                    }
                    required
                    placeholder="06 12 34 56 78"
                  />
                </div>
              </div>
            </div>

            {/* Procedure Information */}
            <div className="border-t pt-6">
              <h2 className="mb-4 text-lg font-semibold">Informations de la procédure</h2>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="contexte">Contexte *</Label>
                  <Textarea
                    id="contexte"
                    value={formData.contexte}
                    onChange={(e) =>
                      setFormData({ ...formData, contexte: e.target.value })
                    }
                    required
                    placeholder="Description détaillée de la procédure..."
                    rows={6}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="dateFactureEchue">Date facture échue *</Label>
                    <Input
                      id="dateFactureEchue"
                      type="date"
                      value={formData.dateFactureEchue}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          dateFactureEchue: e.target.value,
                        })
                      }
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="numeroFacture">Numéro de facture *</Label>
                    <Input
                      id="numeroFacture"
                      value={formData.numeroFacture ?? ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          numeroFacture: e.target.value,
                        })
                      }
                      required
                      placeholder="FAC-2024-001"
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="montantDue">Montant dû (€) *</Label>
                    <Input
                      id="montantDue"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.montantDue}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          montantDue: e.target.value,
                        })
                      }
                      required
                      placeholder="0.00"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="montantTTC">Montant TTC</Label>
                    <div className="flex items-center space-x-2">
                      <input
                        id="montantTTC"
                        type="checkbox"
                        checked={formData.montantTTC}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            montantTTC: e.target.checked,
                          })
                        }
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <Label htmlFor="montantTTC" className="text-sm font-normal">
                        Le montant indiqué est TTC (Toutes Taxes Comprises)
                      </Label>
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="dateRelance">Date de relance</Label>
                    <Input
                      id="dateRelance"
                      type="date"
                      value={formData.dateRelance}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        setFormData({
                          ...formData,
                          dateRelance: newDate,
                        });
                        // Si dateRelance2 existe et est invalide, réinitialiser l'erreur
                        if (formData.dateRelance2 && newDate) {
                          const dateRelance1 = new Date(newDate);
                          const dateRelance2 = new Date(formData.dateRelance2);
                          const diffTime = dateRelance2.getTime() - dateRelance1.getTime();
                          const diffDays = diffTime / (1000 * 60 * 60 * 24);
                          if (diffDays >= 7) {
                            setError("");
                          }
                        }
                      }}
                      placeholder="Date de relance"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="dateRelance2">Date de relance 2 (minimum 7 jours après la première)</Label>
                    <Input
                      id="dateRelance2"
                      type="date"
                      value={formData.dateRelance2}
                      onChange={(e) => {
                        const newDate = e.target.value;
                        setFormData({
                          ...formData,
                          dateRelance2: newDate,
                        });
                        // Valider en temps réel
                        if (formData.dateRelance && newDate) {
                          const dateRelance1 = new Date(formData.dateRelance);
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
                      min={formData.dateRelance ? (() => {
                        const minDate = new Date(formData.dateRelance);
                        minDate.setDate(minDate.getDate() + 7);
                        return minDate.toISOString().split('T')[0];
                      })() : undefined}
                      placeholder="Date de relance 2"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Écheancier */}
            <div className="border-t pt-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Écheancier de paiement</h2>
                  <p className="text-sm text-muted-foreground">
                    Proposez un plan de paiement échelonné (optionnel)
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setHasEcheancier(!hasEcheancier);
                  }}
                >
                  {hasEcheancier ? "Désactiver" : "Activer"}
                </Button>
              </div>

              {hasEcheancier && (
                <div className="space-y-4 rounded-lg border bg-muted/50 p-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="nombreEcheances">
                        Nombre d'échéances *
                      </Label>
                      <Input
                        id="nombreEcheances"
                        type="number"
                        min="1"
                        max="5"
                        value={nombreEcheances}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 1;
                          setNombreEcheances(Math.max(1, Math.min(5, value)));
                        }}
                        required={hasEcheancier}
                      />
                      <p className="text-xs text-muted-foreground">
                        Entre 1 et 5 échéances maximum
                      </p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="delaiPaiement">
                        Délai entre chaque paiement (mois) *
                      </Label>
                      <Input
                        id="delaiPaiement"
                        type="number"
                        min="1"
                        max="12"
                        value={delaiPaiement}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 1;
                          setDelaiPaiement(Math.max(1, Math.min(12, value)));
                        }}
                        required={hasEcheancier}
                      />
                      <p className="text-xs text-muted-foreground">
                        Par défaut: 1 mois
                      </p>
                    </div>
                  </div>

                  {/* Aperçu de l'écheancier généré */}
                  {formData.montantDue && formData.dateFactureEchue && (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium">Aperçu de l'écheancier :</p>
                      <div className="space-y-2">
                        {(() => {
                          const montantTotal = parseFloat(formData.montantDue);
                          const montantParEcheance = montantTotal / nombreEcheances;
                          const dateDebut = new Date(formData.dateFactureEchue);
                          const echeances = [];
                          
                          for (let i = 0; i < nombreEcheances; i++) {
                            const dateEcheance = new Date(dateDebut);
                            dateEcheance.setMonth(dateEcheance.getMonth() + (i + 1) * delaiPaiement);
                            // Toujours mettre le jour au 5 du mois
                            dateEcheance.setDate(5);
                            
                            echeances.push({
                              date: dateEcheance.toLocaleDateString("fr-FR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              }),
                              montant: Math.round(montantParEcheance * 100) / 100,
                            });
                          }
                          
                          return echeances.map((echeance, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between rounded border bg-background p-2 text-sm"
                            >
                              <span className="font-medium">
                                Échéance {index + 1} : {echeance.date}
                              </span>
                              <span className="font-semibold text-primary">
                                {new Intl.NumberFormat("fr-FR", {
                                  style: "currency",
                                  currency: "EUR",
                                }).format(echeance.montant)}
                              </span>
                            </div>
                          ));
                        })()}
                      </div>
                      <p className="text-xs text-muted-foreground pt-2 border-t">
                        Total : {new Intl.NumberFormat("fr-FR", {
                          style: "currency",
                          currency: "EUR",
                        }).format(parseFloat(formData.montantDue) || 0)}
                      </p>
                    </div>
                  )}

                  {(!formData.montantDue || !formData.dateFactureEchue) && (
                    <p className="text-sm text-muted-foreground">
                      Veuillez renseigner le montant dû et la date de facture échue pour voir l'aperçu de l'écheancier.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Documents */}
            <div className="border-t pt-6">
              <h2 className="mb-4 text-lg font-semibold">Documents et preuves</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Ajoutez des fichiers pour chaque catégorie. Seuls les fichiers images (JPEG, PNG, GIF, WebP) et PDF sont acceptés.
              </p>
              <div className="grid gap-6">
                {DOCUMENT_TYPES.map((docType) => {
                  const isRequired = docType.value === "FACTURE";
                  const files = filesByType[docType.value];
                  
                  // Calculer l'index de départ global pour les numéros de facture
                  const globalStartIndex = Object.entries(filesByType)
                    .slice(0, DOCUMENT_TYPES.findIndex(dt => dt.value === docType.value))
                    .reduce((sum, [, arr]) => sum + arr.length, 0);
                  
                  return (
                    <div key={docType.value}>
                      <FileUpload
                        type={docType.value}
                        label={`${docType.label}${isRequired ? " *" : ""}`}
                        uploadedFiles={files}
                        onFilesChange={(files) => handleFilesChange(docType.value, files)}
                      />
                      {isRequired && files.length === 0 && (
                        <p className="mt-1 text-xs text-destructive">
                          La facture est obligatoire
                        </p>
                      )}
                      
                      {/* Informations pour chaque facture */}
                      {docType.value === "FACTURE" && files.length > 0 && (
                        <div className="mt-4 space-y-4">
                          <Label className="text-sm font-medium">
                            Informations des factures *
                          </Label>
                          {files.map((file, index) => {
                            const info = facturesInfo[index] || {
                              numeroFacture: "",
                              dateFactureEchue: "",
                              montantDue: "",
                              montantTTC: true,
                            };
                            // S'assurer que toutes les valeurs sont des chaînes, jamais undefined
                            const numeroFacture = info.numeroFacture ?? "";
                            const dateFactureEchue = info.dateFactureEchue ?? "";
                            const montantDue = info.montantDue ?? "";
                            return (
                              <div key={index} className="rounded-lg border bg-muted/50 p-4 space-y-3">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-sm font-medium">{file.fileName}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <Label htmlFor={`numero-${index}`} className="text-xs">
                                      Numéro de facture *
                                    </Label>
                                    <Input
                                      id={`numero-${index}`}
                                      value={numeroFacture}
                                      onChange={(e) => {
                                        setFacturesInfo({
                                          ...facturesInfo,
                                          [index]: { ...info, numeroFacture: e.target.value },
                                        });
                                      }}
                                      placeholder="FAC-2024-001"
                                      required
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor={`date-${index}`} className="text-xs">
                                      Date facture échue *
                                    </Label>
                                    <Input
                                      id={`date-${index}`}
                                      type="date"
                                      value={dateFactureEchue}
                                      onChange={(e) => {
                                        setFacturesInfo({
                                          ...facturesInfo,
                                          [index]: { ...info, dateFactureEchue: e.target.value },
                                        });
                                      }}
                                      required
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor={`montant-${index}`} className="text-xs">
                                      Montant dû (€) *
                                    </Label>
                                    <Input
                                      id={`montant-${index}`}
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={montantDue}
                                      onChange={(e) => {
                                        setFacturesInfo({
                                          ...facturesInfo,
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
                                        id={`ttc-${index}`}
                                        checked={info.montantTTC}
                                        onChange={(e) => {
                                          setFacturesInfo({
                                            ...facturesInfo,
                                            [index]: { ...info, montantTTC: e.target.checked },
                                          });
                                        }}
                                        className="h-4 w-4"
                                      />
                                      <Label htmlFor={`ttc-${index}`} className="text-xs cursor-pointer">
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
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-4 border-t pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={submitting || savingDraft}
              >
                Annuler
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveDraft}
                disabled={submitting || savingDraft}
              >
                {savingDraft ? "Sauvegarde..." : "Finir plus tard"}
              </Button>
              <Button type="submit" disabled={submitting || savingDraft}>
                {submitting 
                  ? (isEditingDraft ? "Finalisation en cours..." : "Création en cours...") 
                  : (isEditingDraft ? "Finaliser le dossier" : "Créer le dossier")}
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Panier */}
      <Dialog open={showCart} onOpenChange={setShowCart}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Panier
            </DialogTitle>
            <DialogDescription>
              Récapitulatif de votre commande
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Option facturation - seulement si pas déjà abonné */}
            {!isSubscribed ? (
              <div className="rounded-lg border-2 p-4 bg-muted/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <input
                        type="checkbox"
                        id="facturation"
                        checked={hasFacturation}
                        onChange={(e) => setHasFacturation(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <label htmlFor="facturation" className="font-semibold text-lg cursor-pointer">
                        Facturation mensuelle
                      </label>
                    </div>
                    <p className="text-sm text-muted-foreground ml-6">
                      Bénéficiez de tarifs préférentiels et de l'écheancier gratuit
                    </p>
                  </div>
                  <p className="font-bold text-xl">29 € HT</p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <p className="font-semibold text-green-900">✓ Vous êtes déjà abonné</p>
                    <p className="text-sm text-green-700 mt-1">
                      Vous bénéficiez déjà des tarifs préférentiels et de l'écheancier gratuit
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {/* Mise en demeure */}
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <p className="font-medium">Mise en demeure</p>
                  <p className="text-sm text-muted-foreground">Incluse dans le dossier</p>
                </div>
                <p className="font-semibold">
                  {hasFacturation ? "99 € HT" : "179 € HT"}
                </p>
              </div>

              {/* Écheancier - seulement si activé */}
              {hasEcheancier && (
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <p className="font-medium">Écheancier de paiement</p>
                    <p className="text-sm text-muted-foreground">
                      {nombreEcheances} échéance{nombreEcheances > 1 ? "s" : ""}
                    </p>
                  </div>
                  <p className="font-semibold">
                    {hasFacturation ? (
                      <span className="text-green-600">Gratuit</span>
                    ) : (
                      "49 € HT"
                    )}
                  </p>
                </div>
              )}
            </div>

            <div className="border-t pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold">Sous-total HT</p>
                <p className="font-semibold">
                  {(() => {
                    let total = 0;
                    if (hasFacturation) {
                      total = 29 + 99; // Facturation + Mise en demeure
                      // Écheancier gratuit avec facturation
                    } else {
                      total = 179; // Mise en demeure sans abonnement
                      if (hasEcheancier) {
                        total += 49; // Écheancier
                      }
                    }
                    return `${total} € HT`;
                  })()}
                </p>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <p>TVA (20%)</p>
                <p>
                  {(() => {
                    let totalHT = 0;
                    if (hasFacturation) {
                      totalHT = 29 + 99;
                    } else {
                      totalHT = 179;
                      if (hasEcheancier) {
                        totalHT += 49;
                      }
                    }
                    const tva = totalHT * 0.20;
                    return `${tva.toFixed(2)} €`;
                  })()}
                </p>
              </div>
              <div className="flex items-center justify-between pt-2 border-t">
                <p className="text-lg font-semibold">Total TTC</p>
                <p className="text-lg font-bold">
                  {(() => {
                    let totalHT = 0;
                    if (hasFacturation) {
                      totalHT = 29 + 99;
                    } else {
                      totalHT = 179;
                      if (hasEcheancier) {
                        totalHT += 49;
                      }
                    }
                    const totalTTC = totalHT * 1.20;
                    return `${totalTTC.toFixed(2)} € TTC`;
                  })()}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowCart(false)}
              disabled={submitting}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button
              onClick={handleConfirmCart}
              disabled={submitting}
              className="flex-1"
            >
              {submitting ? "Création en cours..." : "Confirmer et créer le dossier"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dark pattern pour reproposer la facturation */}
      <Dialog open={showFacturationPrompt} onOpenChange={setShowFacturationPrompt}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600">⚠️ Vous allez payer plus cher</DialogTitle>
            <DialogDescription>
              En refusant la facturation, vous allez payer {hasEcheancier ? "228 € HT" : "179 € HT"} au lieu de 123 € HT.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg border-2 border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-900 mb-2">
                ⚠️ Vous perdez {hasEcheancier ? "105 €" : "56 €"} en refusant la facturation
              </p>
              <p className="text-xs text-red-700">
                La facturation à 29 € HT vous fait économiser {hasEcheancier ? "105 €" : "56 €"} sur cette commande et vous donne accès à l'écheancier gratuit.
              </p>
            </div>
            <div className="rounded-lg border-2 border-green-200 bg-green-50 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="checkbox"
                      id="facturation-prompt"
                      checked={hasFacturation}
                      onChange={(e) => setHasFacturation(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <label htmlFor="facturation-prompt" className="font-semibold text-lg cursor-pointer">
                      Je veux économiser avec la facturation
                    </label>
                  </div>
                  <p className="text-sm text-muted-foreground ml-6">
                    Facturation mensuelle à 29 € HT - Écheancier gratuit inclus
                  </p>
                </div>
                <p className="font-bold text-xl text-green-600">29 € HT</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleSkipFacturation}
              className="flex-1"
            >
              Non
            </Button>
            <Button
              onClick={async () => {
                setHasFacturation(true);
                setShowFacturationPrompt(false);
                // Afficher le panier avec l'abonnement activé
                setShowCart(true);
              }}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              Oui, je veux économiser
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

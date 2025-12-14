"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, Building2, Upload, X, Image as ImageIcon } from "lucide-react";
import { UserRole } from "@/app/generated/prisma/enums";

interface Company {
  id: string;
  nomSociete: string;
  siret: string;
  adresse: string | null;
  codePostal: string | null;
  ville: string | null;
  email: string | null;
  telephone: string | null;
  siteWeb: string | null;
  logoUrl: string | null;
}

interface User {
  id: string;
  role: UserRole;
}

export default function EntreprisePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    nomSociete: "",
    siret: "",
    adresse: "",
    codePostal: "",
    ville: "",
    email: "",
    telephone: "",
    siteWeb: "",
  });

  useEffect(() => {
    fetchUserAndCompany();
  }, []);

  const fetchUserAndCompany = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      // Récupérer les informations de l'utilisateur
      const userResponse = await fetch("/api/user", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUserRole(userData.user.role);
      }

      // Récupérer les informations de l'entreprise/cabinet
      const companyResponse = await fetch("/api/company", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (companyResponse.ok) {
        const data = await companyResponse.json();
        if (data.company) {
          const company = data.company;
          setFormData({
            nomSociete: company.nomSociete || "",
            siret: company.siret || "",
            adresse: company.adresse || "",
            codePostal: company.codePostal || "",
            ville: company.ville || "",
            email: company.email || "",
            telephone: company.telephone || "",
            siteWeb: company.siteWeb || "",
          });
          setLogoUrl(company.logoUrl || null);
        }
      } else if (companyResponse.status === 401) {
        localStorage.removeItem("token");
        router.push("/login");
      }
    } catch (err) {
      console.error("Erreur lors du chargement:", err);
      setError("Erreur lors du chargement des informations");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);

    // Validation
    const entityName = userRole === UserRole.AVOCAT ? "cabinet" : "entreprise";
    if (!formData.nomSociete.trim() || !formData.siret.trim()) {
      setError(`Le nom du ${entityName} et le SIRET sont obligatoires`);
      setSaving(false);
      return;
    }

    // Validation du SIRET (14 chiffres)
    const siretRegex = /^\d{14}$/;
    if (!siretRegex.test(formData.siret.replace(/\s/g, ""))) {
      setError("Le SIRET doit contenir 14 chiffres");
      setSaving(false);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/company", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          siret: formData.siret.replace(/\s/g, ""), // Supprimer les espaces du SIRET
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la sauvegarde");
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Vérifier le type de fichier
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setError("Type de fichier non autorisé. Formats acceptés : JPEG, PNG, GIF, WebP");
      return;
    }

    // Vérifier la taille (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError("Le fichier est trop volumineux. Taille maximale : 5MB");
      return;
    }

    setUploadingLogo(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/company/logo", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de l'upload du logo");
      }

      setLogoUrl(data.logoUrl);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setUploadingLogo(false);
      // Réinitialiser l'input
      e.target.value = "";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-4" />
          <p className="text-muted-foreground">Chargement des informations...</p>
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
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {userRole === UserRole.AVOCAT ? "Mon cabinet" : "Mon entreprise"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {userRole === UserRole.AVOCAT
                  ? "Gérez les informations de votre cabinet"
                  : "Gérez les informations de votre entreprise"}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 max-w-2xl">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">
                {userRole === UserRole.AVOCAT
                  ? "Informations du cabinet"
                  : "Informations de l'entreprise"}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {userRole === UserRole.AVOCAT
                ? "Renseignez les informations de votre cabinet. Les champs marqués d'un astérisque (*) sont obligatoires."
                : "Renseignez les informations de votre entreprise. Les champs marqués d'un astérisque (*) sont obligatoires."}
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-lg border border-green-500/50 bg-green-500/10 p-4 text-sm text-green-600">
              {userRole === UserRole.AVOCAT
                ? "Informations du cabinet mises à jour avec succès !"
                : "Informations de l'entreprise mises à jour avec succès !"}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section Logo */}
            <div className="grid gap-2">
              <Label>
                {userRole === UserRole.AVOCAT ? "Logo du cabinet" : "Logo de l'entreprise"}
              </Label>
              <div className="flex items-center gap-4">
                {logoUrl ? (
                  <div className="relative">
                    <img
                      src={logoUrl}
                      alt="Logo"
                      className="h-20 w-20 object-contain border rounded-lg p-2 bg-white"
                    />
                  </div>
                ) : (
                  <div className="h-20 w-20 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted/50">
                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <Input
                    id="logo"
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    onChange={handleLogoUpload}
                    disabled={uploadingLogo}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Formats acceptés : JPEG, PNG, GIF, WebP (max 5MB)
                  </p>
                </div>
                {uploadingLogo && (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="nomSociete">
                {userRole === UserRole.AVOCAT
                  ? "Nom du cabinet"
                  : "Nom de l'entreprise"}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nomSociete"
                value={formData.nomSociete}
                onChange={(e) =>
                  setFormData({ ...formData, nomSociete: e.target.value })
                }
                placeholder={
                  userRole === UserRole.AVOCAT
                    ? "Nom de votre cabinet"
                    : "Nom de votre entreprise"
                }
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="siret">
                SIRET <span className="text-destructive">*</span>
              </Label>
              <Input
                id="siret"
                value={formData.siret}
                onChange={(e) =>
                  setFormData({ ...formData, siret: e.target.value })
                }
                placeholder="12345678901234"
                maxLength={14}
                required
              />
              <p className="text-xs text-muted-foreground">
                14 chiffres (sans espaces)
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="adresse">
                {userRole === UserRole.AVOCAT
                  ? "Adresse du cabinet"
                  : "Adresse du siège social"}
              </Label>
              <Textarea
                id="adresse"
                value={formData.adresse}
                onChange={(e) =>
                  setFormData({ ...formData, adresse: e.target.value })
                }
                placeholder="Numéro et nom de rue"
                rows={2}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="codePostal">Code postal</Label>
                <Input
                  id="codePostal"
                  value={formData.codePostal}
                  onChange={(e) =>
                    setFormData({ ...formData, codePostal: e.target.value })
                  }
                  placeholder="75001"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="ville">Ville</Label>
                <Input
                  id="ville"
                  value={formData.ville}
                  onChange={(e) =>
                    setFormData({ ...formData, ville: e.target.value })
                  }
                  placeholder="Paris"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">
                {userRole === UserRole.AVOCAT
                  ? "Email du cabinet"
                  : "Email de l'entreprise"}
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder={
                  userRole === UserRole.AVOCAT
                    ? "contact@cabinet.fr"
                    : "contact@entreprise.fr"
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="telephone">
                {userRole === UserRole.AVOCAT
                  ? "Téléphone du cabinet"
                  : "Téléphone de l'entreprise"}
              </Label>
              <Input
                id="telephone"
                type="tel"
                value={formData.telephone}
                onChange={(e) =>
                  setFormData({ ...formData, telephone: e.target.value })
                }
                placeholder="+33 1 23 45 67 89"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="siteWeb">Site web</Label>
              <Input
                id="siteWeb"
                type="url"
                value={formData.siteWeb}
                onChange={(e) =>
                  setFormData({ ...formData, siteWeb: e.target.value })
                }
                placeholder="https://www.entreprise.fr"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="submit"
                disabled={saving}
                className="min-w-[120px]"
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Enregistrer
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}


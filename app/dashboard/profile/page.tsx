"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save } from "lucide-react";

interface User {
  id: string;
  email: string;
  nom: string | null;
  prenom: string | null;
  adresse: string | null;
  codePostal: string | null;
  ville: string | null;
  telephone: string | null;
  iban: string | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    nom: "",
    prenom: "",
    email: "",
    adresse: "",
    codePostal: "",
    ville: "",
    telephone: "",
    iban: "",
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
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
        const user = data.user;
        setFormData({
          nom: user.nom || "",
          prenom: user.prenom || "",
          email: user.email || "",
          adresse: user.adresse || "",
          codePostal: user.codePostal || "",
          ville: user.ville || "",
          telephone: user.telephone || "",
          iban: user.iban || "",
        });
      } else if (response.status === 401) {
        localStorage.removeItem("token");
        router.push("/login");
      }
    } catch (err) {
      console.error("Erreur lors du chargement du profil:", err);
      setError("Erreur lors du chargement du profil");
    } finally {
      setLoading(false);
    }
  };

  const isProfileComplete = () => {
    return (
      formData.nom.trim() !== "" &&
      formData.prenom.trim() !== "" &&
      formData.email.trim() !== "" &&
      formData.adresse.trim() !== "" &&
      formData.codePostal.trim() !== "" &&
      formData.ville.trim() !== "" &&
      formData.telephone.trim() !== ""
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);

    // Validation
    if (!isProfileComplete()) {
      setError("Veuillez remplir tous les champs obligatoires");
      setSaving(false);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la sauvegarde");
      }

      setSuccess(true);
      // Rediriger vers le dashboard après 1 seconde
      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-4" />
          <p className="text-muted-foreground">Chargement du profil...</p>
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
              <h1 className="text-2xl font-bold tracking-tight">Mon profil</h1>
              <p className="text-sm text-muted-foreground">
                Gérez vos informations personnelles
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 max-w-2xl">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="mb-6">
            <p className="text-sm text-muted-foreground">
              Veuillez compléter votre profil pour continuer. Tous les champs sont obligatoires.
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 rounded-lg border border-green-500/50 bg-green-500/10 p-4 text-sm text-green-600">
              Profil mis à jour avec succès ! Redirection en cours...
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="nom">
                  Nom <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="nom"
                  value={formData.nom}
                  onChange={(e) =>
                    setFormData({ ...formData, nom: e.target.value })
                  }
                  placeholder="Votre nom"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="prenom">
                  Prénom <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="prenom"
                  value={formData.prenom}
                  onChange={(e) =>
                    setFormData({ ...formData, prenom: e.target.value })
                  }
                  placeholder="Votre prénom"
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="votre@email.com"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="adresse">
                Adresse <span className="text-destructive">*</span>
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

            <div className="grid gap-4 md:grid-cols-2">
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

            <div className="grid gap-2">
              <Label htmlFor="telephone">
                Numéro de téléphone <span className="text-destructive">*</span>
              </Label>
              <Input
                id="telephone"
                type="tel"
                value={formData.telephone}
                onChange={(e) =>
                  setFormData({ ...formData, telephone: e.target.value })
                }
                placeholder="+33 6 12 34 56 78"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="iban">
                IBAN
              </Label>
              <Input
                id="iban"
                value={formData.iban}
                onChange={(e) =>
                  setFormData({ ...formData, iban: e.target.value })
                }
                placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
                maxLength={34}
              />
              <p className="text-xs text-muted-foreground">
                Numéro de compte bancaire pour recevoir les paiements
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="submit"
                disabled={saving || !isProfileComplete()}
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


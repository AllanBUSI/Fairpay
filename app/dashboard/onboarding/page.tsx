"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, User, Building2, CheckCircle2, ArrowRight, ArrowLeft, Image as ImageIcon } from "lucide-react";
import { DecorativeLines } from "@/components/landing/decorative-lines";
import { ScrollAnimation } from "@/components/landing/scroll-animation";
import { UserRole } from "@/app/generated/prisma/enums";

type Step = "profile" | "company";

export default function OnboardingPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [companyExists, setCompanyExists] = useState(false);

  // Profile form data
  const [profileData, setProfileData] = useState({
    nom: "",
    prenom: "",
    email: "",
    adresse: "",
    codePostal: "",
    ville: "",
    telephone: "",
    iban: "",
  });

  // Company form data
  const [companyData, setCompanyData] = useState({
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
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
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
        setUserRole(user.role);
        setProfileData({
          nom: user.nom || "",
          prenom: user.prenom || "",
          email: user.email || "",
          adresse: user.adresse || "",
          codePostal: user.codePostal || "",
          ville: user.ville || "",
          telephone: user.telephone || "",
          iban: user.iban || "",
        });

        // Vérifier si le profil est déjà complet
        const isProfileComplete = 
          user.nom && user.prenom && user.email && user.adresse && 
          user.codePostal && user.ville && user.telephone;
        
        if (isProfileComplete) {
          // Vérifier si l'entreprise existe
          const companyResponse = await fetch("/api/company", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (companyResponse.ok) {
            const companyData = await companyResponse.json();
            if (companyData.company) {
              setCompanyExists(true);
              setCompanyData({
                nomSociete: companyData.company.nomSociete || "",
                siret: companyData.company.siret || "",
                adresse: companyData.company.adresse || "",
                codePostal: companyData.company.codePostal || "",
                ville: companyData.company.ville || "",
                email: companyData.company.email || "",
                telephone: companyData.company.telephone || "",
                siteWeb: companyData.company.siteWeb || "",
              });
              setLogoUrl(companyData.company.logoUrl || null);
              
              // Si tout est complet, rediriger vers le dashboard
              if (companyData.company.nomSociete && companyData.company.siret) {
                router.push("/dashboard");
                return;
              } else {
                setCurrentStep("company");
              }
            } else {
              setCompanyExists(false);
              setCurrentStep("company");
            }
          } else {
            setCompanyExists(false);
            setCurrentStep("company");
          }
        }
      } else if (response.status === 401) {
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


  const isProfileComplete = () => {
    return (
      profileData.nom.trim() !== "" &&
      profileData.prenom.trim() !== "" &&
      profileData.email.trim() !== "" &&
      profileData.adresse.trim() !== "" &&
      profileData.codePostal.trim() !== "" &&
      profileData.ville.trim() !== "" &&
      profileData.telephone.trim() !== ""
    );
  };

  const isCompanyComplete = () => {
    return (
      companyData.nomSociete.trim() !== "" &&
      companyData.siret.trim() !== ""
    );
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isProfileComplete()) {
      setError("Veuillez remplir tous les champs obligatoires");
      return;
    }

    setSaving(true);
    setError("");

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
        body: JSON.stringify(profileData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la sauvegarde");
      }

      setCurrentStep("company");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setSaving(false);
    }
  };

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCompanyComplete()) {
      setError("Le nom de l'entreprise et le SIRET sont obligatoires");
      return;
    }

    const siretRegex = /^\d{14}$/;
    if (!siretRegex.test(companyData.siret.replace(/\s/g, ""))) {
      setError("Le SIRET doit contenir 14 chiffres");
      return;
    }

    setSaving(true);
    setError("");

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
          ...companyData,
          siret: companyData.siret.replace(/\s/g, ""),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erreur lors de la sauvegarde");
      }

      // Si un logo a été sélectionné mais pas encore uploadé, l'uploader maintenant
      if (logoFile && !companyExists) {
        setUploadingLogo(true);
        const uploadedLogoUrl = await uploadLogoFile(logoFile);
        if (uploadedLogoUrl) {
          setLogoUrl(uploadedLogoUrl);
          // Nettoyer l'URL temporaire si elle existe
          if (logoUrl && logoUrl.startsWith("blob:")) {
            URL.revokeObjectURL(logoUrl);
          }
        }
        setLogoFile(null);
        setUploadingLogo(false);
      }

      setCompanyExists(true);
      // Rediriger vers le dashboard après la création de l'entreprise
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setError("Type de fichier non autorisé");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Le fichier est trop volumineux (max 5MB)");
      return;
    }

    // Si l'entreprise existe, uploader immédiatement
    if (companyExists) {
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
          throw new Error(data.error || "Erreur lors de l'upload");
        }

        setLogoUrl(data.logoUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Une erreur est survenue");
      } finally {
        setUploadingLogo(false);
        e.target.value = "";
      }
    } else {
      // Si l'entreprise n'existe pas, stocker le fichier temporairement
      setLogoFile(file);
      // Créer une URL temporaire pour l'aperçu
      const tempUrl = URL.createObjectURL(file);
      setLogoUrl(tempUrl);
    }
  };

  const uploadLogoFile = async (file: File): Promise<string | null> => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        return null;
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
        throw new Error(data.error || "Erreur lors de l'upload");
      }

      return data.logoUrl;
    } catch (err) {
      console.error("Erreur lors de l'upload du logo:", err);
      return null;
    }
  };


  const steps = [
    { id: "profile", label: "Profil", icon: User },
    { id: "company", label: userRole === UserRole.AVOCAT ? "Cabinet" : "Entreprise", icon: Building2 },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#0F172A] mb-4" />
          <p className="text-[#0F172A]/70">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full bg-white overflow-y-auto">
      <div className="absolute inset-0 pointer-events-none opacity-10">
        <DecorativeLines variant="diagonal" />
      </div>

      <div className="flex min-h-full items-start justify-center px-4 sm:px-6 lg:px-8 py-8">
        <ScrollAnimation animation="scaleIn" delay={0}>
          <div className="w-full max-w-7xl flex flex-col">
            {/* Stepper */}
            <div className="mb-6 flex-shrink-0">
              <div className="flex items-center justify-between">
                {steps.map((step, index) => {
                  const StepIcon = step.icon;
                  const isActive = steps.findIndex(s => s.id === currentStep) === index;
                  const isCompleted = steps.findIndex(s => s.id === currentStep) > index;
                  
                  return (
                    <div key={step.id} className="flex items-center flex-1">
                      <div className="flex flex-col items-center flex-1">
                        <div
                          className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all ${
                            isActive
                              ? "bg-[#16A34A] border-[#16A34A] text-white"
                              : isCompleted
                              ? "bg-[#16A34A] border-[#16A34A] text-white"
                              : "bg-white border-[#E5E7EB] text-[#0F172A]/40"
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-6 w-6" />
                          ) : (
                            <StepIcon className="h-6 w-6" />
                          )}
                        </div>
                        <span
                          className={`mt-2 text-sm font-medium ${
                            isActive || isCompleted
                              ? "text-[#0F172A]"
                              : "text-[#0F172A]/40"
                          }`}
                        >
                          {step.label}
                        </span>
                      </div>
                      {index < steps.length - 1 && (
                        <div
                          className={`h-0.5 flex-1 mx-4 ${
                            isCompleted ? "bg-[#16A34A]" : "bg-[#E5E7EB]"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Form Card */}
            <div className="bg-white rounded-2xl shadow-2xl border-2 border-[#E5E7EB] relative z-10">
              <div className="p-8 md:p-10 lg:p-12">
              {error && (
                <div className="mb-6 rounded-lg bg-red-50 border-2 border-red-200 p-4 text-sm text-red-800">
                  {error}
                </div>
              )}

              {currentStep === "profile" && (
                <form onSubmit={handleProfileSubmit} className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-black text-[#0F172A] mb-3">Votre profil</h2>
                    <p className="text-[#0F172A]/70 font-light">
                      Remplissez vos informations personnelles
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="nom" className="font-semibold text-[#0F172A]">
                        Nom <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="nom"
                        value={profileData.nom}
                        onChange={(e) =>
                          setProfileData({ ...profileData, nom: e.target.value })
                        }
                        className="border-2 border-[#E5E7EB] focus:border-[#16A34A]"
                        required
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="prenom" className="font-semibold text-[#0F172A]">
                        Prénom <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="prenom"
                        value={profileData.prenom}
                        onChange={(e) =>
                          setProfileData({ ...profileData, prenom: e.target.value })
                        }
                        className="border-2 border-[#E5E7EB] focus:border-[#16A34A]"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="email" className="font-semibold text-[#0F172A]">
                      Email <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={profileData.email}
                      onChange={(e) =>
                        setProfileData({ ...profileData, email: e.target.value })
                      }
                      className="border-2 border-[#E5E7EB] focus:border-[#16A34A]"
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="adresse" className="font-semibold text-[#0F172A]">
                      Adresse <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="adresse"
                      value={profileData.adresse}
                      onChange={(e) =>
                        setProfileData({ ...profileData, adresse: e.target.value })
                      }
                      className="border-2 border-[#E5E7EB] focus:border-[#16A34A]"
                      rows={2}
                      required
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="codePostal" className="font-semibold text-[#0F172A]">
                        Code postal <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="codePostal"
                        value={profileData.codePostal}
                        onChange={(e) =>
                          setProfileData({ ...profileData, codePostal: e.target.value })
                        }
                        className="border-2 border-[#E5E7EB] focus:border-[#16A34A]"
                        required
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="ville" className="font-semibold text-[#0F172A]">
                        Ville <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="ville"
                        value={profileData.ville}
                        onChange={(e) =>
                          setProfileData({ ...profileData, ville: e.target.value })
                        }
                        className="border-2 border-[#E5E7EB] focus:border-[#16A34A]"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="telephone" className="font-semibold text-[#0F172A]">
                      Téléphone <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="telephone"
                      type="tel"
                      value={profileData.telephone}
                      onChange={(e) =>
                        setProfileData({ ...profileData, telephone: e.target.value })
                      }
                      className="border-2 border-[#E5E7EB] focus:border-[#16A34A]"
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="iban" className="font-semibold text-[#0F172A]">
                      IBAN
                    </Label>
                    <Input
                      id="iban"
                      value={profileData.iban}
                      onChange={(e) =>
                        setProfileData({ ...profileData, iban: e.target.value })
                      }
                      className="border-2 border-[#E5E7EB] focus:border-[#16A34A]"
                      placeholder="FR76 XXXX XXXX XXXX XXXX XXXX XXX"
                      maxLength={34}
                    />
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button
                      type="submit"
                      disabled={saving || !isProfileComplete()}
                      size="lg"
                      className="bg-[#16A34A] text-white hover:bg-[#16A34A]/90 rounded-full px-8 py-6 font-semibold"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Enregistrement...
                        </>
                      ) : (
                        <>
                          Continuer
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              )}

              {currentStep === "company" && (
                <form onSubmit={handleCompanySubmit} className="space-y-6">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-black text-[#0F172A] mb-3">
                      {userRole === UserRole.AVOCAT ? "Votre cabinet" : "Votre entreprise"}
                    </h2>
                    <p className="text-[#0F172A]/70 font-light">
                      Renseignez les informations de votre {userRole === UserRole.AVOCAT ? "cabinet" : "entreprise"}
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label className="font-semibold text-[#0F172A]">
                      Logo {userRole === UserRole.AVOCAT ? "du cabinet" : "de l'entreprise"}
                    </Label>
                    <div className="flex items-center gap-4">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt="Logo"
                          className="h-20 w-20 object-contain border-2 border-[#E5E7EB] rounded-lg p-2 bg-white"
                        />
                      ) : (
                        <div className="h-20 w-20 border-2 border-dashed border-[#E5E7EB] rounded-lg flex items-center justify-center bg-[#E5E7EB]/50">
                          <ImageIcon className="h-8 w-8 text-[#0F172A]/40" />
                        </div>
                      )}
                      <div className="flex-1">
                        <Input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                          onChange={handleLogoUpload}
                          disabled={uploadingLogo}
                          className="cursor-pointer border-2 border-[#E5E7EB] focus:border-[#16A34A]"
                        />
                        {uploadingLogo && (
                          <Loader2 className="mt-2 h-5 w-5 animate-spin text-[#16A34A]" />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="nomSociete" className="font-semibold text-[#0F172A]">
                      {userRole === UserRole.AVOCAT ? "Nom du cabinet" : "Nom de l'entreprise"}{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="nomSociete"
                      value={companyData.nomSociete}
                      onChange={(e) =>
                        setCompanyData({ ...companyData, nomSociete: e.target.value })
                      }
                      className="border-2 border-[#E5E7EB] focus:border-[#16A34A]"
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="siret" className="font-semibold text-[#0F172A]">
                      SIRET <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="siret"
                      value={companyData.siret}
                      onChange={(e) =>
                        setCompanyData({ ...companyData, siret: e.target.value })
                      }
                      className="border-2 border-[#E5E7EB] focus:border-[#16A34A]"
                      maxLength={14}
                      required
                    />
                    <p className="text-xs text-[#0F172A]/60">14 chiffres (sans espaces)</p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="companyAdresse" className="font-semibold text-[#0F172A]">
                      Adresse
                    </Label>
                    <Textarea
                      id="companyAdresse"
                      value={companyData.adresse}
                      onChange={(e) =>
                        setCompanyData({ ...companyData, adresse: e.target.value })
                      }
                      className="border-2 border-[#E5E7EB] focus:border-[#16A34A]"
                      rows={2}
                    />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="companyCodePostal" className="font-semibold text-[#0F172A]">
                        Code postal
                      </Label>
                      <Input
                        id="companyCodePostal"
                        value={companyData.codePostal}
                        onChange={(e) =>
                          setCompanyData({ ...companyData, codePostal: e.target.value })
                        }
                        className="border-2 border-[#E5E7EB] focus:border-[#16A34A]"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="companyVille" className="font-semibold text-[#0F172A]">
                        Ville
                      </Label>
                      <Input
                        id="companyVille"
                        value={companyData.ville}
                        onChange={(e) =>
                          setCompanyData({ ...companyData, ville: e.target.value })
                        }
                        className="border-2 border-[#E5E7EB] focus:border-[#16A34A]"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      type="button"
                      onClick={() => setCurrentStep("profile")}
                      variant="outline"
                      size="lg"
                      className="flex-1 border-2 border-[#E5E7EB] text-[#0F172A] hover:bg-[#E5E7EB] rounded-full px-6 py-6 font-semibold"
                    >
                      <ArrowLeft className="mr-2 h-5 w-5" />
                      Retour
                    </Button>
                    <Button
                      type="submit"
                      disabled={saving || !isCompanyComplete()}
                      size="lg"
                      className="flex-1 bg-[#16A34A] text-white hover:bg-[#16A34A]/90 rounded-full px-6 py-6 font-semibold"
                    >
                      {saving ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Enregistrement...
                        </>
                      ) : (
                        <>
                          Continuer
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              )}

              </div>
            </div>
          </div>
        </ScrollAnimation>
      </div>

    </div>
  );
}


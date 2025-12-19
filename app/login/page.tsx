"use client";

import { useState, useEffect } from "react";
import { LandingNavigation } from "@/components/landing/navigation";
import { DecorativeLines } from "@/components/landing/decorative-lines";
import { ScrollAnimation } from "@/components/landing/scroll-animation";
import { Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Supprimer le token lors de l'arrivée sur la page de login (déconnexion forcée)
  useEffect(() => {
    // Supprimer le token du localStorage
    localStorage.removeItem("token");
    
    // Supprimer le token des cookies
    document.cookie = "token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
    
    console.log("[LoginPage] Token supprimé - Déconnexion forcée");
  }, []);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Une erreur est survenue");
      }

      setSuccess("Code envoyé avec succès ! Vérifiez votre email.");
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, code }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Code invalide");
      }

      // Stocker le token JWT
      if (data.token) {
        localStorage.setItem("token", data.token);
        // Stocker aussi dans un cookie pour le SSR
        document.cookie = `token=${data.token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`;
      }

      setSuccess("Connexion réussie !");
      
      // Vérifier si l'onboarding est nécessaire
      try {
        const userResponse = await fetch("/api/user", {
          headers: {
            Authorization: `Bearer ${data.token}`,
          },
        });

        if (userResponse.ok) {
          const userData = await userResponse.json();
          const user = userData.user;

          // Vérifier si le profil est complet
          const isProfileComplete = 
            user.nom && user.prenom && user.email && user.adresse && 
            user.codePostal && user.ville && user.telephone;

          if (!isProfileComplete) {
            // Rediriger vers l'onboarding
            window.location.href = "/dashboard/onboarding";
            return;
          }

          // Vérifier si l'entreprise existe
          const companyResponse = await fetch("/api/company", {
            headers: {
              Authorization: `Bearer ${data.token}`,
            },
          });

          if (companyResponse.ok) {
            const companyData = await companyResponse.json();
            if (!companyData.company || !companyData.company.nomSociete || !companyData.company.siret) {
              // Rediriger vers l'onboarding
              window.location.href = "/dashboard/onboarding";
              return;
            }
          } else {
            // Pas d'entreprise, rediriger vers l'onboarding
            window.location.href = "/dashboard/onboarding";
            return;
          }
        }

        // Tout est complet, rediriger vers le dashboard
        window.location.href = "/dashboard";
      } catch (err) {
        // En cas d'erreur, rediriger quand même vers le dashboard
        window.location.href = "/dashboard";
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Code invalide");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-white overflow-hidden">
      {/* Navbar */}
      <LandingNavigation />
      
      {/* Lignes décoratives */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <DecorativeLines variant="diagonal" />
      </div>
      
      {/* Éléments décoratifs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#2563EB]/10 rounded-full blur-3xl opacity-30 -z-0 animate-float"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#16A34A]/10 rounded-full blur-3xl opacity-30 -z-0 animate-float" style={{ animationDelay: "1s" }}></div>

      <div className="flex min-h-screen items-center justify-center px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <ScrollAnimation animation="scaleIn" delay={0}>
          <div className="w-full max-w-md">
            <div className="bg-white rounded-2xl shadow-2xl border-2 border-[#E5E7EB] p-8 md:p-10 relative z-10">
              {/* Header */}
              <div className="text-center mb-8">
                <h1 className="text-3xl sm:text-4xl font-black text-[#0F172A] mb-3 tracking-[-0.03em]">
                  Connexion
                </h1>
                <p className="text-[#0F172A]/70 font-light">
                  {step === "email" 
                    ? "Entrez votre email pour recevoir un code de connexion"
                    : `Code envoyé à ${email}`
                  }
                </p>
              </div>

              {step === "email" ? (
                <form onSubmit={handleSendCode} className="space-y-6">
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-semibold text-[#0F172A] mb-3 tracking-tight"
                    >
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#0F172A]/40" />
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full pl-12 pr-4 py-4 border-2 border-[#E5E7EB] rounded-lg bg-white text-[#0F172A] focus:border-[#16A34A] focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 transition-all font-light"
                        placeholder="votre@email.com"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-lg bg-red-50 border-2 border-red-200 p-4 text-sm text-red-800">
                      {error}
                    </div>
                  )}

                  {success && (
                    <div className="rounded-lg bg-[#16A34A]/10 border-2 border-[#16A34A]/20 p-4 text-sm text-[#16A34A]">
                      {success}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={loading}
                    size="lg"
                    className="w-full bg-[#0F172A] text-white hover:bg-[#0F172A]/90 rounded-full px-6 py-6 font-semibold transition-all hover:scale-105 shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Envoi en cours...
                      </>
                    ) : (
                      <>
                        Envoyer le code
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyCode} className="space-y-6">
                  <div>
                    <label
                      htmlFor="code"
                      className="block text-sm font-semibold text-[#0F172A] mb-3 tracking-tight"
                    >
                      Code de vérification
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-[#0F172A]/40" />
                      <input
                        id="code"
                        type="text"
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        required
                        maxLength={6}
                        className="w-full pl-12 pr-4 py-4 border-2 border-[#E5E7EB] rounded-lg bg-white text-center text-3xl tracking-[0.5em] text-[#0F172A] focus:border-[#16A34A] focus:outline-none focus:ring-2 focus:ring-[#16A34A]/20 transition-all font-bold"
                        placeholder="000000"
                      />
                    </div>
                    <p className="mt-3 text-xs text-[#0F172A]/60 font-light text-center">
                      Entrez le code à 6 chiffres envoyé à <span className="font-semibold">{email}</span>
                    </p>
                  </div>

                  {error && (
                    <div className="rounded-lg bg-red-50 border-2 border-red-200 p-4 text-sm text-red-800">
                      {error}
                    </div>
                  )}

                  {success && (
                    <div className="rounded-lg bg-[#16A34A]/10 border-2 border-[#16A34A]/20 p-4 text-sm text-[#16A34A]">
                      {success}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      onClick={() => {
                        setStep("email");
                        setCode("");
                        setError("");
                        setSuccess("");
                      }}
                      variant="outline"
                      size="lg"
                      className="flex-1 border-2 border-[#E5E7EB] text-[#0F172A] hover:bg-[#E5E7EB] rounded-full px-6 py-6 font-semibold transition-all"
                    >
                      Retour
                    </Button>
                    <Button
                      type="submit"
                      disabled={loading || code.length !== 6}
                      size="lg"
                      className="flex-1 bg-[#16A34A] text-white hover:bg-[#16A34A]/90 rounded-full px-6 py-6 font-semibold transition-all hover:scale-105 shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Vérification...
                        </>
                      ) : (
                        <>
                          Vérifier
                          <ArrowRight className="ml-2 h-5 w-5" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              )}

              {/* Footer */}
              <div className="mt-8 pt-6 border-t border-[#E5E7EB] text-center">
                <p className="text-xs text-[#0F172A]/60 font-light">
                  En vous connectant, vous acceptez nos{" "}
                  <a href="#" className="text-[#2563EB] hover:underline font-medium">
                    conditions d'utilisation
                  </a>{" "}
                  et notre{" "}
                  <a href="#" className="text-[#2563EB] hover:underline font-medium">
                    politique de confidentialité
                  </a>
                </p>
              </div>
            </div>
          </div>
        </ScrollAnimation>
      </div>
    </div>
  );
}


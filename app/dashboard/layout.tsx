"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/ui/sidebar";
import SupportChat from "@/components/ui/support-chat";
import { UserRole } from "@/app/generated/prisma/enums";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";

interface User {
  id: string;
  email: string;
  nom: string | null;
  prenom: string | null;
  adresse: string | null;
  codePostal: string | null;
  ville: string | null;
  telephone: string | null;
  role: UserRole;
}

function checkProfileComplete(user: User | null): boolean {
  if (!user) return false;
  
  return (
    user.nom !== null && user.nom.trim() !== "" &&
    user.prenom !== null && user.prenom.trim() !== "" &&
    user.email !== null && user.email.trim() !== "" &&
    user.adresse !== null && user.adresse.trim() !== "" &&
    user.codePostal !== null && user.codePostal.trim() !== "" &&
    user.ville !== null && user.ville.trim() !== "" &&
    user.telephone !== null && user.telephone.trim() !== ""
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPremium, setIsPremium] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [counts, setCounts] = useState<{
    dashboard?: number;
    injonctions?: number;
    brouillons?: number;
  }>({});

  const fetchCounts = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      // Récupérer le nombre de dossiers dans le dashboard (excluant brouillons et injonctions)
      const dashboardResponse = await fetch("/api/procedures", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Récupérer les brouillons
      const brouillonsResponse = await fetch("/api/procedures?status=BROUILLONS", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Récupérer les injonctions
      const injonctionsResponse1 = await fetch("/api/procedures?status=INJONCTION_DE_PAIEMENT", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const injonctionsResponse2 = await fetch("/api/procedures?status=INJONCTION_DE_PAIEMENT_PAYER", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      let dashboardCount = 0;
      let brouillonsCount = 0;
      let injonctionsCount = 0;

      if (dashboardResponse.ok) {
        const data = await dashboardResponse.json();
        dashboardCount = data.procedures?.length || 0;
      }

      if (brouillonsResponse.ok) {
        const data = await brouillonsResponse.json();
        brouillonsCount = data.procedures?.length || 0;
      }

      if (injonctionsResponse1.ok) {
        const data1 = await injonctionsResponse1.json();
        injonctionsCount += data1.procedures?.length || 0;
      }
      if (injonctionsResponse2.ok) {
        const data2 = await injonctionsResponse2.json();
        injonctionsCount += data2.procedures?.length || 0;
      }

      setCounts({
        dashboard: dashboardCount,
        injonctions: injonctionsCount,
        brouillons: brouillonsCount,
      });
    } catch (err) {
      console.error("Erreur lors de la récupération des compteurs:", err);
    }
  };

  useEffect(() => {
    const checkAuthAndProfile = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) {
          router.push("/login");
          return;
        }

        // Vérifier les impayés avant de continuer (sauf si on est déjà sur la page de paiement requis)
        if (pathname !== "/dashboard/paiement-requis") {
          try {
            const unpaidResponse = await fetch("/api/payments/check-unpaid", {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            });

            if (unpaidResponse.ok) {
              const unpaidData = await unpaidResponse.json();
              if (unpaidData.hasUnpaid) {
                router.push("/dashboard/paiement-requis");
                return;
              }
            }
          } catch (unpaidError) {
            console.error("Erreur lors de la vérification des impayés:", unpaidError);
            // Continuer même en cas d'erreur pour ne pas bloquer l'utilisateur
          }
        }

        const response = await fetch("/api/user", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          const fetchedUser: User = data.user;
          setUser(fetchedUser);

          // Vérifier si l'utilisateur a un abonnement actif (seulement pour les USER)
          if (fetchedUser.role === UserRole.USER) {
            try {
              const subscriptionResponse = await fetch("/api/stripe/check-subscription", {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });

              if (subscriptionResponse.ok) {
                const subscriptionData = await subscriptionResponse.json();
                const subscription = subscriptionData.subscription;
                // Ne donner accès premium que si :
                // - L'abonnement est ACTIVE (payé et actif)
                // - OU l'abonnement est TRIALING ET le paiement initial a réussi
                if (subscription) {
                  if (subscription.status === "ACTIVE") {
                    setIsPremium(true);
                  } else if (subscription.status === "TRIALING") {
                    // Pour TRIALING, vérifier que le paiement initial a réussi
                    // En vérifiant s'il y a un paiement réussi associé à l'utilisateur
                    try {
                      const paymentResponse = await fetch("/api/user/payments", {
                        headers: {
                          Authorization: `Bearer ${token}`,
                        },
                      });
                      if (paymentResponse.ok) {
                        const paymentsData = await paymentResponse.json();
                        // Si l'utilisateur a au moins un paiement réussi, il peut avoir accès premium en période d'essai
                        const hasSuccessfulPayment = paymentsData.payments && 
                          paymentsData.payments.some((p: any) => p.status === "SUCCEEDED");
                        setIsPremium(hasSuccessfulPayment);
                      } else {
                        setIsPremium(false);
                      }
                    } catch (err) {
                      console.error("Erreur lors de la vérification des paiements:", err);
                      setIsPremium(false);
                    }
                  } else {
                    setIsPremium(false);
                  }
                } else {
                  setIsPremium(false);
                }
              }
            } catch (err) {
              console.error("Erreur lors de la vérification de l'abonnement:", err);
              setIsPremium(false);
            }
          }

          // Vérifier le profil seulement pour les USER
          if (fetchedUser.role === UserRole.USER) {
            const isProfileComplete = checkProfileComplete(fetchedUser);
            
            // Si le profil n'est pas complet, vérifier l'entreprise aussi
            if (!isProfileComplete) {
              // Rediriger vers l'onboarding si on n'y est pas déjà
              if (pathname !== "/dashboard/onboarding") {
                router.push("/dashboard/onboarding");
                return;
              }
            } else {
              // Profil complet, vérifier l'entreprise
              try {
                const companyResponse = await fetch("/api/company", {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                });

                if (companyResponse.ok) {
                  const companyData = await companyResponse.json();
                  if (!companyData.company || !companyData.company.nomSociete || !companyData.company.siret) {
                    // Pas d'entreprise complète, rediriger vers l'onboarding
                    if (pathname !== "/dashboard/onboarding") {
                      router.push("/dashboard/onboarding");
                      return;
                    }
                  }
                } else {
                  // Pas d'entreprise, rediriger vers l'onboarding
                  if (pathname !== "/dashboard/onboarding") {
                    router.push("/dashboard/onboarding");
                    return;
                  }
                }
              } catch (err) {
                console.error("Erreur lors de la vérification de l'entreprise:", err);
              }
            }
          }
        } else if (response.status === 401) {
          localStorage.removeItem("token");
          router.push("/login");
          return;
        }
      } catch (error) {
        console.error("Erreur lors de la vérification:", error);
      } finally {
        setLoading(false);
      }
    };

    checkAuthAndProfile();
    fetchCounts();

    // Rafraîchir les compteurs toutes les 30 secondes
    const interval = setInterval(() => {
      fetchCounts();
    }, 30000);

    return () => clearInterval(interval);
  }, [router, pathname]);

  const handleLogout = () => {
    setUser(null);
  };

  // Ne pas afficher le layout si on est sur la page de paiement requis
  if (pathname === "/dashboard/paiement-requis") {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar 
        user={user} 
        onLogout={handleLogout} 
        isPremium={isPremium} 
        counts={counts}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {/* Mobile header avec bouton menu */}
        <div className="lg:hidden bg-white border-b border-[#E5E7EB] px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="text-lg font-bold text-[#0F172A]">FairPay</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="min-h-full p-4 lg:p-6">
            {children}
          </div>
        </div>
      </div>
      <SupportChat />
    </div>
  );
}

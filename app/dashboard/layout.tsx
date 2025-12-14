"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/ui/sidebar";
import { UserRole } from "@/app/generated/prisma/enums";

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

  useEffect(() => {
    const checkAuthAndProfile = async () => {
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
          const fetchedUser: User = data.user;
          setUser(fetchedUser);

          // Vérifier le profil seulement pour les USER
          if (fetchedUser.role === UserRole.USER) {
            const isComplete = checkProfileComplete(fetchedUser);
            
            // Si le profil n'est pas complet et qu'on n'est pas déjà sur la page de profil
            if (!isComplete && pathname !== "/dashboard/profile") {
              router.push("/dashboard/profile");
              return;
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
  }, [router, pathname]);

  const handleLogout = () => {
    setUser(null);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={user} onLogout={handleLogout} />
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}

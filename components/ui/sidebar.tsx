"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FileText,
  Plus,
  User,
  LogOut,
  Briefcase,
  MessageSquare,
  Building2,
  FileX,
  CreditCard,
  Crown,
  Scale,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserRole } from "@/app/generated/prisma/enums";
import { LogoIcon } from "@/components/landing/logo-icon";

interface SidebarProps {
  user: {
    id: string;
    email: string;
    role: UserRole;
    nom?: string | null;
    prenom?: string | null;
  } | null;
  onLogout: () => void;
  isPremium?: boolean;
  counts?: {
    dashboard?: number;
    injonctions?: number;
    brouillons?: number;
  };
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[]; // Si non spécifié, accessible à tous
  getTitle?: (role: UserRole) => string; // Fonction pour obtenir le titre selon le rôle
  badgeKey?: "dashboard" | "injonctions" | "brouillons"; // Clé pour récupérer le badge
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    badgeKey: "dashboard",
  },
  {
    title: "Nouveaux dossier",
    href: "/dashboard/nouveaux",
    icon: FileText,
    roles: [UserRole.AVOCAT],
  },
  {
    title: "Injonctions de paiement",
    href: "/dashboard/injonctions-avocat",
    icon: Scale,
    roles: [UserRole.AVOCAT, UserRole.JURISTE],
  },
  {
    title: "Nouveau dossier",
    href: "/dashboard/new",
    icon: Plus,
    roles: [UserRole.USER],
  },
  {
    title: "Saisir le tribunal",
    href: "/dashboard/saisir-tribunal",
    icon: Scale,
    roles: [UserRole.USER],
    badgeKey: "injonctions",
  },
  {
    title: "Brouillons",
    href: "/dashboard/brouillons",
    icon: FileX,
    roles: [UserRole.USER],
    badgeKey: "brouillons",
  },
  {
    title: "Statistique",
    href: "/dashboard/statistiques",
    icon: BarChart3,
    roles: [UserRole.USER],
  },
  {
    title: "Mon profil",
    href: "/dashboard/profile",
    icon: User,
  },
  {
    title: "Mon entreprise",
    href: "/dashboard/entreprise",
    icon: Building2,
    getTitle: (role) => (role === UserRole.AVOCAT ? "Mon cabinet" : "Mon entreprise"),
  },
  {
    title: "Facturation",
    href: "/dashboard/facturation",
    icon: CreditCard,
    roles: [UserRole.USER],
  },
];

export function Sidebar({ user, onLogout, isPremium = false, counts }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const getInitials = (email: string) => {
    if (email.length >= 2) {
      return email.substring(0, 2).toUpperCase();
    }
    return email.substring(0, 1).toUpperCase();
  };

  // Filtrer les items selon le rôle de l'utilisateur
  const filteredNavItems = navItems.filter((item) => {
    if (!item.roles) return true; // Accessible à tous
    if (!user) return false;
    return item.roles.includes(user.role);
  });

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
      localStorage.removeItem("token");
      onLogout();
      router.push("/login");
    } catch (err) {
      console.error("Erreur lors de la déconnexion:", err);
      localStorage.removeItem("token");
      router.push("/login");
    }
  };

  return (
    <div className="flex h-screen w-64 flex-col border-r border-[#E5E7EB] bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-[#E5E7EB] px-6 py-5 bg-white">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="transition-transform group-hover:scale-110 group-hover:rotate-3 duration-300">
            <LogoIcon size={32} />
          </div>
          <span className="text-lg font-bold text-[#0F172A] tracking-tight">FairPay</span>
        </Link>
        {isPremium && (
          <div className="mt-3 rounded-lg bg-gradient-to-r from-[#16A34A] to-[#22C55E] px-3 py-2 flex items-center gap-2 shadow-sm">
            <Crown className="h-4 w-4 text-white" />
            <span className="text-xs font-semibold text-white">Premium</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const displayTitle = item.getTitle && user ? item.getTitle(user.role) : item.title;
          const badgeCount = item.badgeKey && counts ? counts[item.badgeKey] : undefined;
          
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-[#0F172A] text-white shadow-sm"
                    : "text-[#0F172A]/70 hover:bg-[#E5E7EB] hover:text-[#0F172A]"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5" />
                  <span>{displayTitle}</span>
                </div>
                {badgeCount !== undefined && badgeCount > 0 && (
                  <span
                    className={cn(
                      "ml-2 rounded-full px-2 py-0.5 text-xs font-semibold",
                      isActive
                        ? "bg-white/20 text-white"
                        : "bg-[#0F172A] text-white"
                    )}
                  >
                    {badgeCount}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-[#E5E7EB] p-4 bg-white">
        {user && (
          <Link href="/dashboard/profile">
            <div className="mb-4 flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-[#E5E7EB] cursor-pointer transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-[#0F172A] text-white text-xs font-semibold">
                  {user.nom && user.prenom
                    ? `${user.prenom.charAt(0)}${user.nom.charAt(0)}`.toUpperCase()
                    : getInitials(user.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-[#0F172A]">
                  {user.prenom && user.nom
                    ? `${user.prenom} ${user.nom}`
                    : user.email}
                </p>
                <p className="text-xs text-[#0F172A]/60 truncate">
                  {user.email}
                </p>
              </div>
              <User className="h-4 w-4 text-[#0F172A]/60" />
            </div>
          </Link>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start text-[#0F172A]/70 hover:text-[#0F172A] hover:bg-[#E5E7EB]"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Déconnexion
        </Button>
      </div>
    </div>
  );
}


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
  X,
  MessageCircle,
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
    nouveaux?: number;
    nouveauxName?: string;
  };
  isOpen?: boolean;
  onClose?: () => void;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[]; // Si non spécifié, accessible à tous
  getTitle?: (role: UserRole) => string; // Fonction pour obtenir le titre selon le rôle
  badgeKey?: "dashboard" | "injonctions" | "brouillons" | "nouveaux"; // Clé pour récupérer le badge
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
    badgeKey: "nouveaux",
  },
  {
    title: "Injonctions de paiement",
    href: "/dashboard/injonctions-avocat",
    icon: Scale,
    roles: [UserRole.AVOCAT, UserRole.JURISTE],
    badgeKey: "injonctions",
    getTitle: (role) => role === UserRole.AVOCAT ? "Demande IHP" : "Injonctions de paiement",
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
  {
    title: "Chat avec avocat",
    href: "/dashboard/chat",
    icon: MessageCircle,
    roles: [UserRole.USER],
  },
  {
    title: "Chat avec clients",
    href: "/dashboard/chat-avocat",
    icon: MessageCircle,
    roles: [UserRole.AVOCAT, UserRole.JURISTE],
  },
];

export function Sidebar({ user, onLogout, isPremium = false, counts, isOpen = true, onClose }: SidebarProps) {
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

  const handleLinkClick = () => {
    if (onClose) {
      onClose();
    }
  };

  return (
    <>
      {/* Overlay pour mobile */}
      {isOpen && onClose && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 flex h-screen w-64 flex-col bg-white shadow-lg border-r border-[#E5E7EB] transition-transform duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Header */}
        <div className="border-b-2 border-[#16A34A]/20 px-6 py-5 bg-gradient-to-r from-[#F0FDF4] to-white">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-3 group" onClick={handleLinkClick}>
              <div className="transition-transform group-hover:scale-110 group-hover:rotate-3 duration-300">
                <LogoIcon size={32} />
              </div>
              <span className="text-lg font-black text-[#16A34A] tracking-tight">FairPay</span>
            </Link>
            {onClose && (
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden hover:bg-[#F0FDF4] rounded-lg"
                onClick={onClose}
              >
                <X className="h-5 w-5 text-[#16A34A]" />
              </Button>
            )}
          </div>
          {isPremium && (
            <div className="mt-3 rounded-xl bg-gradient-to-r from-[#16A34A] to-[#22C55E] px-3 py-2 flex items-center gap-2 shadow-lg">
              <Crown className="h-4 w-4 text-white" />
              <span className="text-xs font-bold text-white">Premium</span>
            </div>
          )}
        </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 p-4 overflow-y-auto">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          // Pour le Dashboard, on vérifie seulement l'égalité exacte, pas les sous-routes
          const isActive = item.href === "/dashboard" 
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
          const displayTitle = item.getTitle && user ? item.getTitle(user.role) : item.title;
          const badgeCount = item.badgeKey && counts ? counts[item.badgeKey] : undefined;
          
          return (
            <Link key={item.href} href={item.href} onClick={handleLinkClick}>
              <div
                className={cn(
                  "flex items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-200 group",
                  isActive
                    ? "bg-gradient-to-r from-[#16A34A] to-[#22C55E] text-white shadow-lg"
                    : "text-[#0F172A]/70 hover:bg-[#F0FDF4] hover:text-[#16A34A] hover:shadow-sm"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn(
                    "h-5 w-5 transition-transform duration-200",
                    isActive ? "" : "group-hover:scale-110"
                  )} />
                  <span>{displayTitle}</span>
                </div>
                {badgeCount !== undefined && badgeCount > 0 ? (
                  <span
                    className={cn(
                      "ml-2 rounded-full px-2.5 py-1 text-xs font-bold min-w-[24px] text-center",
                      isActive
                        ? "bg-white/30 text-white"
                        : "bg-[#0F172A] text-white shadow-sm"
                    )}
                  >
                    {badgeCount}
                  </span>
                ) : null}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-[#E5E7EB] p-4 bg-white">
        {user && (
          <Link href="/dashboard/profile" onClick={handleLinkClick}>
            <div className="mb-4 flex items-center gap-3 rounded-xl px-4 py-3 hover:bg-[#F0FDF4] cursor-pointer transition-all duration-200 hover:shadow-sm">
              <Avatar className="h-10 w-10 ring-2 ring-[#16A34A]/20">
                <AvatarFallback className="bg-gradient-to-br from-[#16A34A] to-[#22C55E] text-white text-sm font-bold">
                  {user.nom && user.prenom
                    ? `${user.prenom.charAt(0)}${user.nom.charAt(0)}`.toUpperCase()
                    : getInitials(user.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate text-[#0F172A]">
                  {user.prenom && user.nom
                    ? `${user.prenom} ${user.nom}`
                    : user.email}
                </p>
                <p className="text-xs text-[#64748B] truncate font-light">
                  {user.email}
                </p>
              </div>
              <User className="h-4 w-4 text-[#16A34A]" />
            </div>
          </Link>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start text-[#0F172A]/70 hover:text-[#16A34A] hover:bg-[#F0FDF4] rounded-xl py-3 font-semibold transition-all duration-200 hover:shadow-sm"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Déconnexion
        </Button>
      </div>
    </div>
    </>
  );
}


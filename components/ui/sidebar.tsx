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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { UserRole } from "@/app/generated/prisma/enums";

interface SidebarProps {
  user: {
    id: string;
    email: string;
    role: UserRole;
    nom?: string | null;
    prenom?: string | null;
  } | null;
  onLogout: () => void;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[]; // Si non spécifié, accessible à tous
  getTitle?: (role: UserRole) => string; // Fonction pour obtenir le titre selon le rôle
}

const navItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Nouveaux dossiers",
    href: "/dashboard/nouveaux",
    icon: FileText,
    roles: [UserRole.AVOCAT],
  },
  {
    title: "Ajouter un dossier",
    href: "/dashboard/new",
    icon: Plus,
    roles: [UserRole.USER], // Seuls les USER peuvent ajouter un dossier
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
    title: "Brouillons",
    href: "/dashboard/brouillons",
    icon: FileX,
    roles: [UserRole.USER],
  },
  {
    title: "Facturation",
    href: "/dashboard/facturation",
    icon: CreditCard,
    roles: [UserRole.USER],
  },
];

export function Sidebar({ user, onLogout }: SidebarProps) {
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
    <div className="flex h-screen w-64 flex-col border-r bg-card">
      {/* Header */}
      <div className="flex h-16 items-center border-b px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FileText className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold">FairPay</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {filteredNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const displayTitle = item.getTitle && user ? item.getTitle(user.role) : item.title;
          
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{displayTitle}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t p-4">
        {user && (
          <Link href="/dashboard/profile">
            <div className="mb-4 flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted cursor-pointer transition-colors">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {user.nom && user.prenom
                    ? `${user.prenom.charAt(0)}${user.nom.charAt(0)}`.toUpperCase()
                    : getInitials(user.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {user.prenom && user.nom
                    ? `${user.prenom} ${user.nom}`
                    : user.email}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user.email}
                </p>
              </div>
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
          </Link>
        )}
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Déconnexion
        </Button>
      </div>
    </div>
  );
}


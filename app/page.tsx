import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/jwt";
import { LandingPage } from "@/components/landing/landing-page";
import { LandingPageGuard } from "@/components/landing/landing-page-guard";

export default async function Home() {
  // La landing page doit TOUJOURS être accessible, même sans authentification
  // On vérifie seulement si l'utilisateur est déjà connecté pour le rediriger vers le dashboard
  
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;

    // Seulement si un token existe ET est valide, rediriger vers le dashboard
    if (token) {
      const user = verifyToken(token);
      // Vérification stricte : le token doit être valide ET contenir un userId ET un email
      if (user && user.userId && user.email) {
        // Utilisateur authentifié valide, rediriger vers le dashboard
        // Cette redirection est normale et attendue
        redirect("/dashboard");
      }
      // Si le token est invalide, expiré ou incomplet, continuer et afficher la landing page
    }

    // Afficher la landing page dans tous les autres cas
    // (pas de token, token invalide, token expiré, etc.)
    // IMPORTANT : Cette page ne doit JAMAIS rediriger vers /login
    return (
      <>
        <LandingPageGuard />
        <LandingPage />
      </>
    );
  } catch (error: any) {
    // Si c'est une erreur de redirection Next.js (vers /dashboard), la propager
    // C'est normal si l'utilisateur est authentifié
    if (error && typeof error === 'object' && 'digest' in error && typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT')) {
      throw error;
    }
    // Pour toute autre erreur, afficher la landing page
    // IMPORTANT : Cette page ne doit JAMAIS rediriger vers /login
    return (
      <>
        <LandingPageGuard />
        <LandingPage />
      </>
    );
  }
}

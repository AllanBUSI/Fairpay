"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

/**
 * Composant qui empêche les redirections vers /login depuis la page d'accueil
 */
export function LandingPageGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const isMounted = useRef(false);

  useEffect(() => {
    isMounted.current = true;
    
    // Si on est sur la page d'accueil, empêcher toute redirection vers /login
    if (pathname === "/") {
      console.log('[LandingPageGuard] Protection activée sur la page d\'accueil');
      
      // Sauvegarder la fonction router.push originale
      const originalPush = router.push.bind(router);
      
      // Intercepter router.push
      const interceptedPush = function(href: string, options?: any) {
        if (!isMounted.current || pathname !== "/") {
          return originalPush(href, options);
        }
        
        if (href && (href.includes('/login') || href === '/login')) {
          console.warn('[LandingPageGuard] Redirection vers /login bloquée sur la page d\'accueil');
          return Promise.resolve(false);
        }
        return originalPush(href, options);
      };
      
      // Remplacer router.push
      (router as any).push = interceptedPush;

      // Surveiller les changements de navigation via popstate
      const handlePopState = () => {
        // Si on essaie de naviguer vers /login depuis la page d'accueil, empêcher
        if (isMounted.current && pathname === '/' && window.location.pathname === '/login') {
          console.warn('[LandingPageGuard] Navigation vers /login détectée et bloquée');
          window.history.pushState(null, '', '/');
        }
      };

      window.addEventListener('popstate', handlePopState);

      return () => {
        isMounted.current = false;
        // Restaurer la fonction originale lors du démontage
        (router as any).push = originalPush;
        window.removeEventListener('popstate', handlePopState);
      };
    }
    
    // Retourner undefined si on n'est pas sur la page d'accueil
    return undefined;
  }, [pathname, router]);

  return null;
}


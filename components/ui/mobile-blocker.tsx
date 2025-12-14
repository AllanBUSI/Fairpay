"use client";

import { useEffect, useState } from "react";

export function MobileBlocker({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      // Vérifier la largeur de l'écran (mobile généralement < 768px)
      const isMobileDevice = window.innerWidth < 768;
      setIsMobile(isMobileDevice);
    };

    // Vérifier au chargement
    checkMobile();

    // Vérifier lors du redimensionnement
    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  if (isMobile) {
    return (
      <div className="flex h-screen items-center justify-center bg-background p-4">
        <div className="max-w-md text-center space-y-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Fairpay</h1>
            <p className="text-lg text-muted-foreground">
              Fairpay n'est pas disponible sur mobile.
            </p>
            <p className="text-sm text-muted-foreground">
              Veuillez accéder à l'application depuis un ordinateur ou une tablette.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}


"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { LandingNavigation } from "./navigation";
import { HeroSection } from "./hero-section";
import { ProblemSection } from "./problem-section";
import { SolutionSection } from "./solution-section";
import { ProofSection } from "./proof-section";
import { DifferentiationSection } from "./differentiation-section";
import { PricingSection } from "./pricing-section";
import { PriceComparisonSection } from "./price-comparison-section";
import { RCProSection } from "./rc-pro-section";
import { FAQSection } from "./faq-section";
import { CTASection } from "./cta-section";
import { LandingFooter } from "./footer";

export function LandingPage() {
  const pathname = usePathname();

  useEffect(() => {
    // Protection immédiate : empêcher toute redirection vers /login depuis la page d'accueil
    if (pathname === "/") {
      // Intercepter immédiatement les redirections
      const preventLoginRedirect = (e: BeforeUnloadEvent | PopStateEvent) => {
        if (window.location.pathname === "/" && window.location.href.includes("/login")) {
          e.preventDefault();
          window.history.pushState(null, "", "/");
          return false;
        }
        return undefined;
      };

      // Empêcher la navigation vers /login
      const originalPushState = window.history.pushState;
      window.history.pushState = function(...args) {
        const url = args[2];
        if (url && typeof url === 'string' && (url.includes('/login') || url === '/login')) {
          console.warn('[LandingPage] Redirection vers /login bloquée');
          return;
        }
        return originalPushState.apply(window.history, args);
      };

      return () => {
        window.history.pushState = originalPushState;
      };
    }
    
    // Retourner undefined si on n'est pas sur la page d'accueil
    return undefined;
  }, [pathname]);

  return (
    <div className="min-h-screen bg-white">
      <LandingNavigation />
      <main>
        <HeroSection />
        <ProblemSection />
        <SolutionSection />
        <ProofSection />
        <DifferentiationSection />
        <div id="pricing">
          <PricingSection />
        </div>
        <PriceComparisonSection />
        <RCProSection />
        <div id="faq">
          <FAQSection />
        </div>
        <CTASection />
      </main>
      <LandingFooter />
    </div>
  );
}


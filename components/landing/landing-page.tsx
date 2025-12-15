"use client";

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


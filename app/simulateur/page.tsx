"use client";

import { PriceComparisonSection } from "@/components/landing/price-comparison-section";
import { LandingNavigation } from "@/components/landing/navigation";
import { LandingFooter } from "@/components/landing/footer";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function SimulateurPage() {
  return (
    <div className="min-h-screen bg-white">
      <LandingNavigation />

      {/* Simulator Section */}
      <PriceComparisonSection />

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#0F172A] text-white">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl sm:text-5xl font-black mb-6 tracking-tight">
            Prêt à récupérer votre argent ?
          </h2>
          <p className="text-xl text-white/80 mb-10 font-light leading-relaxed">
            Rejoignez des centaines d'entreprises qui font confiance à FairPay pour récupérer leurs créances impayées. 
            Un réseau d'avocats inscrits aux barreaux de Paris à votre service.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login">
              <Button size="lg" className="text-lg px-10 py-7 bg-[#16A34A] text-white hover:bg-[#16A34A]/90 border-2 border-[#16A34A] rounded-none font-bold transition-all hover:scale-105 shadow-lg">
                Lancer mon recouvrement maintenant
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/">
              <Button size="lg" variant="outline" className="text-lg px-10 py-7 bg-transparent text-white hover:bg-white/10 border-2 border-white rounded-none font-bold">
                En savoir plus
              </Button>
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-white/70 font-light">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#16A34A]"></div>
              <span>Réseau d'avocats qualifiés</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#16A34A]"></div>
              <span>Tarifs transparents</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#16A34A]"></div>
              <span>Confidentialité garantie</span>
            </div>
          </div>
        </div>
      </section>

      <LandingFooter />
    </div>
  );
}


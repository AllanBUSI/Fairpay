"use client";

import { PriceComparisonSection } from "@/components/landing/price-comparison-section";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Calculator, ArrowRight } from "lucide-react";
import { LogoIcon } from "@/components/landing/logo-icon";

export default function SimulateurPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b-2 border-[#E5E7EB] bg-white sticky top-0 z-50">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="transition-transform group-hover:scale-110 group-hover:rotate-3 duration-300">
                <LogoIcon size={40} />
              </div>
              <span className="text-xl font-black text-[#0F172A] tracking-tight">FairPay</span>
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/login">
                <Button variant="ghost" className="text-[#0F172A] hover:bg-[#E5E7EB]">
                  Connexion
                </Button>
              </Link>
              <Link href="/login">
                <Button className="bg-[#16A34A] text-white hover:bg-[#16A34A]/90 border-2 border-[#16A34A] rounded-none font-bold">
                  Lancer mon recouvrement
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white to-[#E5E7EB]">
        <div className="container mx-auto max-w-7xl text-center">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-[#0F172A] mb-8">
            <Calculator className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-[#0F172A] mb-6 tracking-[-0.03em]">
            Simulateur de recouvrement
          </h1>
          <p className="text-xl sm:text-2xl text-[#0F172A]/70 max-w-3xl mx-auto font-light mb-8 leading-relaxed">
            Calculez combien vous économisez avec FairPay par rapport aux plateformes de recouvrement classiques
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-[#0F172A]/60 font-light">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#16A34A]"></div>
              <span>100% gratuit</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#16A34A]"></div>
              <span>Sans inscription</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#16A34A]"></div>
              <span>Résultats instantanés</span>
            </div>
          </div>
        </div>
      </section>

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

      {/* Footer */}
      <footer className="border-t-2 border-[#E5E7EB] bg-white py-12 px-4 sm:px-6 lg:px-8">
        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="transition-transform hover:scale-110 hover:rotate-3 duration-300">
                <LogoIcon size={32} />
              </div>
              <span className="text-lg font-black text-[#0F172A] tracking-tight">FairPay</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-[#0F172A]/60 font-light">
              <Link href="/" className="hover:text-[#2563EB] transition-colors">
                Accueil
              </Link>
              <Link href="/login" className="hover:text-[#2563EB] transition-colors">
                Connexion
              </Link>
              <Link href="/login" className="hover:text-[#2563EB] transition-colors">
                Créer un compte
              </Link>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-[#E5E7EB] text-center text-sm text-[#0F172A]/50 font-light">
            <p>© {new Date().getFullYear()} FairPay. Tous droits réservés.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}


"use client";

import { X, Check } from "lucide-react";
import { DecorativeLines } from "./decorative-lines";
import { ScrollAnimation } from "./scroll-animation";

export function DifferentiationSection() {
  return (
    <section className="relative py-32 px-4 sm:px-6 lg:px-8 bg-[#0F172A] text-white overflow-hidden">
      {/* Lignes décoratives - Masquées sur mobile */}
      <div className="absolute inset-0 pointer-events-none opacity-30 hidden md:block">
        <DecorativeLines variant="diagonal" />
      </div>

      <div className="container mx-auto max-w-7xl relative z-10">
        <ScrollAnimation animation="fadeInDown" delay={0}>
          <div className="text-center mb-20">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-6 tracking-[-0.03em]">
              Ce qui nous différencie
            </h2>
            <p className="text-xl sm:text-2xl text-white/70 max-w-3xl mx-auto font-light">
              Pas de plateforme opaque, pas de relances douteuses, pas d'honoraires cachés.
            </p>
          </div>
        </ScrollAnimation>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <ScrollAnimation animation="fadeInLeft" delay={100}>
            <div className="p-6 sm:p-10 rounded-lg border-2 border-[#2563EB] bg-[#0F172A] hover:bg-[#2563EB]/10 transition-all duration-300 group hover:scale-105 hover:shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
                <div className="w-16 h-16 rounded-full bg-[#2563EB]/20 flex items-center justify-center group-hover:bg-[#2563EB] transition-colors">
                  <X className="h-8 w-8 text-[#2563EB] group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-2xl font-black text-white">
                  Les autres plateformes
                </h3>
              </div>
              <ul className="space-y-4 text-white/80 text-lg">
                <li className="flex items-start gap-3">
                  <X className="h-6 w-6 text-[#2563EB] flex-shrink-0 mt-1" />
                  <span>Plateformes opaques sans visibilité sur le traitement</span>
                </li>
                <li className="flex items-start gap-3">
                  <X className="h-6 w-6 text-[#2563EB] flex-shrink-0 mt-1" />
                  <span>Relances automatisées peu professionnelles</span>
                </li>
                <li className="flex items-start gap-3">
                  <X className="h-6 w-6 text-[#2563EB] flex-shrink-0 mt-1" />
                  <span>Honoraires cachés et frais surprises</span>
                </li>
                <li className="flex items-start gap-3">
                  <X className="h-6 w-6 text-[#2563EB] flex-shrink-0 mt-1" />
                  <span>Traitement robotisé sans suivi humain</span>
                </li>
              </ul>
            </div>
          </ScrollAnimation>

          <ScrollAnimation animation="fadeInRight" delay={200}>
            <div className="p-6 sm:p-10 rounded-lg border-2 border-[#16A34A] bg-[#0F172A] hover:bg-[#16A34A]/10 transition-all duration-300 group hover:scale-105 hover:shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
                <div className="w-16 h-16 rounded-full bg-[#16A34A]/20 flex items-center justify-center group-hover:bg-[#16A34A] transition-colors">
                  <Check className="h-8 w-8 text-[#16A34A] group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-2xl font-black text-white">
                  FairPay
                </h3>
              </div>
              <ul className="space-y-4 text-white/80 text-lg">
                <li className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-[#16A34A] flex-shrink-0 mt-1" />
                  <span>Transparence totale sur chaque étape du processus</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-[#16A34A] flex-shrink-0 mt-1" />
                  <span>Relances professionnelles par des avocats qualifiés</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-[#16A34A] flex-shrink-0 mt-1" />
                  <span>Tarifs clairs et transparents, aucun frais caché</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-[#16A34A] flex-shrink-0 mt-1" />
                  <span>Suivi humain personnalisé par un avocat dédié</span>
                </li>
              </ul>
            </div>
          </ScrollAnimation>
        </div>
      </div>
    </section>
  );
}

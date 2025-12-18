"use client";

import { AlertCircle, Clock, DollarSign, TrendingDown } from "lucide-react";
import { DecorativeLines } from "./decorative-lines";
import { ScrollAnimation } from "./scroll-animation";

export function ProblemSection() {
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
              Vous avez une facture impayée ?
            </h2>
            <p className="text-xl sm:text-2xl text-white/70 max-w-3xl mx-auto font-light tracking-tight">
              Vous n'êtes pas seul. Des milliers d'entreprises font face à ce problème chaque année.
            </p>
          </div>
        </ScrollAnimation>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ScrollAnimation animation="fadeInLeft" delay={100}>
            <div className="p-8 rounded-lg border-2 border-[#2563EB] bg-[#0F172A] hover:bg-[#2563EB]/10 transition-all duration-300 group hover:scale-105 hover:shadow-xl">
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 rounded-full bg-[#2563EB]/20 flex items-center justify-center group-hover:bg-[#2563EB] transition-colors">
                  <DollarSign className="h-8 w-8 text-[#2563EB] group-hover:text-white transition-colors" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white mb-3">
                  Trésorerie bloquée
                </h3>
                <p className="text-white/70 leading-relaxed text-lg">
                  Chaque facture impayée impacte directement votre trésorerie et peut mettre en péril 
                  la santé financière de votre entreprise.
                </p>
              </div>
            </div>
          </div>
          </ScrollAnimation>
          
          <ScrollAnimation animation="fadeInRight" delay={200}>
            <div className="p-8 rounded-lg border-2 border-[#2563EB] bg-[#0F172A] hover:bg-[#2563EB]/10 transition-all duration-300 group hover:scale-105 hover:shadow-xl">
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-full bg-[#2563EB]/20 flex items-center justify-center group-hover:bg-[#2563EB] transition-colors group-hover:scale-110">
                    <Clock className="h-8 w-8 text-[#2563EB] group-hover:text-white transition-colors" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-3">
                    Temps perdu
                  </h3>
                  <p className="text-white/70 leading-relaxed text-lg">
                    Les relances manuelles prennent du temps que vous pourriez consacrer à développer 
                    votre activité.
                  </p>
                </div>
              </div>
            </div>
          </ScrollAnimation>
          
          <ScrollAnimation animation="fadeInLeft" delay={300}>
            <div className="p-8 rounded-lg border-2 border-[#2563EB] bg-[#0F172A] hover:bg-[#2563EB]/10 transition-all duration-300 group hover:scale-105 hover:shadow-xl">
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-full bg-[#2563EB]/20 flex items-center justify-center group-hover:bg-[#2563EB] transition-colors group-hover:scale-110">
                    <AlertCircle className="h-8 w-8 text-[#2563EB] group-hover:text-white transition-colors" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-3">
                    Stress et incertitude
                  </h3>
                  <p className="text-white/70 leading-relaxed text-lg">
                    L'incertitude sur le recouvrement crée du stress et de l'anxiété, 
                    surtout quand les montants sont importants.
                  </p>
                </div>
              </div>
            </div>
          </ScrollAnimation>
          
          <ScrollAnimation animation="fadeInRight" delay={400}>
            <div className="p-8 rounded-lg border-2 border-[#2563EB] bg-[#0F172A] hover:bg-[#2563EB]/10 transition-all duration-300 group hover:scale-105 hover:shadow-xl">
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0">
                <div className="w-16 h-16 rounded-full bg-[#2563EB]/20 flex items-center justify-center group-hover:bg-[#2563EB] transition-colors">
                  <TrendingDown className="h-8 w-8 text-[#2563EB] group-hover:text-white transition-colors" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white mb-3">
                  Risque d'escalade
                </h3>
                <p className="text-white/70 leading-relaxed text-lg">
                  Plus vous attendez, plus il devient difficile de récupérer votre dû. 
                  Le temps joue contre vous.
                </p>
              </div>
            </div>
          </div>
          </ScrollAnimation>
        </div>
      </div>
    </section>
  );
}

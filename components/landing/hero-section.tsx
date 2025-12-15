"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { DecorativeLines } from "./decorative-lines";
import { ScrollAnimation } from "./scroll-animation";

export function HeroSection() {
  return (
    <section className="relative pt-32 pb-32 px-4 sm:px-6 lg:px-8 bg-white overflow-hidden">
      {/* Éléments décoratifs subtils */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#2563EB]/10 rounded-full blur-3xl opacity-30 -z-0 animate-float"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#16A34A]/10 rounded-full blur-3xl opacity-30 -z-0 animate-float" style={{ animationDelay: "1s" }}></div>
      
      {/* Lignes décoratives */}
      <div className="absolute inset-0 -z-0 pointer-events-none">
        <DecorativeLines variant="diagonal" />
      </div>
      
      <div className="container mx-auto max-w-7xl text-center relative z-10">
        <ScrollAnimation animation="fadeInDown" delay={0}>
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0F172A] text-white text-sm font-medium mb-8 border-2 border-[#0F172A] animate-scale-in">
            <CheckCircle2 className="h-4 w-4" />
            <span>Réseau d'avocats inscrits aux barreaux de Paris</span>
          </div>
        </ScrollAnimation>
        
        <ScrollAnimation animation="fadeInUp" delay={100}>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black text-[#0F172A] mb-8 leading-[1.1] tracking-[-0.03em]">
            Vous avez travaillé,
            <br />
            <span className="text-[#16A34A]">vous méritez d'être payé</span>
          </h1>
        </ScrollAnimation>
        
        <ScrollAnimation animation="fadeInUp" delay={200}>
          <p className="text-xl sm:text-2xl text-[#0F172A]/70 mb-12 max-w-3xl mx-auto font-light leading-relaxed tracking-tight">
            Un avocat réel traite votre dossier de recouvrement de créances. 
            <br className="hidden sm:block" />
            Procédures conformes, confidentialité totale, aucun frais caché.
          </p>
        </ScrollAnimation>
        
        <ScrollAnimation animation="fadeInUp" delay={300}>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
          <Link href="/login">
            <Button size="lg" className="text-lg px-10 py-7 bg-[#16A34A] text-white hover:bg-[#16A34A]/90 border-2 border-[#16A34A] rounded-none font-semibold transition-all hover:scale-105 shadow-lg">
              Lancer mon recouvrement
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Link href="/simulateur">
            <Button variant="outline" size="lg" className="text-lg px-10 py-7 border-2 border-[#16A34A] text-[#16A34A] hover:bg-[#16A34A] hover:text-white rounded-none font-semibold transition-all">
              Calculer mes économies
            </Button>
          </Link>
          <Link href="#processus">
            <Button variant="outline" size="lg" className="text-lg px-10 py-7 border-2 border-[#0F172A] text-[#0F172A] hover:bg-[#0F172A] hover:text-white rounded-none font-semibold transition-all">
              Découvrir le processus
            </Button>
          </Link>
          </div>
        </ScrollAnimation>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-6xl mx-auto text-left">
          <ScrollAnimation animation="fadeInLeft" delay={400}>
            <div className="flex items-start gap-4 p-6 border-2 border-[#E5E7EB] rounded-lg hover:border-[#16A34A] transition-all duration-300 bg-white hover:shadow-lg hover:-translate-y-1">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-[#16A34A]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="h-6 w-6 text-[#16A34A]" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-[#0F172A] mb-2 text-lg tracking-tight">Tarifs transparents</h3>
                <p className="text-sm text-[#0F172A]/60 leading-relaxed font-light tracking-tight">Aucun frais caché</p>
              </div>
            </div>
          </ScrollAnimation>
          <ScrollAnimation animation="fadeInUp" delay={500}>
            <div className="flex items-start gap-4 p-6 border-2 border-[#E5E7EB] rounded-lg hover:border-[#16A34A] transition-all duration-300 bg-white hover:shadow-lg hover:-translate-y-1">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-[#16A34A]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="h-6 w-6 text-[#16A34A]" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-[#0F172A] mb-2 text-lg tracking-tight">Traitement humain</h3>
                <p className="text-sm text-[#0F172A]/60 leading-relaxed font-light tracking-tight">Un avocat dédié suit votre dossier</p>
              </div>
            </div>
          </ScrollAnimation>
          <ScrollAnimation animation="fadeInRight" delay={600}>
            <div className="flex items-start gap-4 p-6 border-2 border-[#E5E7EB] rounded-lg hover:border-[#16A34A] transition-all duration-300 bg-white hover:shadow-lg hover:-translate-y-1">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full bg-[#16A34A]/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="h-6 w-6 text-[#16A34A]" />
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-[#0F172A] mb-2 text-lg tracking-tight">Confidentialité totale</h3>
                <p className="text-sm text-[#0F172A]/60 leading-relaxed font-light tracking-tight">Vos données sont protégées</p>
              </div>
            </div>
          </ScrollAnimation>
        </div>
      </div>
    </section>
  );
}

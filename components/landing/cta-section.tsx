"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Clock, Users } from "lucide-react";
import { DecorativeLines } from "./decorative-lines";
import { ScrollAnimation } from "./scroll-animation";

export function CTASection() {
  return (
    <section className="py-32 px-4 sm:px-6 lg:px-8 bg-[#0F172A] text-white relative overflow-hidden">
      {/* Éléments décoratifs */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-[#2563EB]/10 rounded-full blur-3xl animate-float"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#16A34A]/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "1s" }}></div>
      
      {/* Lignes décoratives */}
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <DecorativeLines variant="diagonal" />
      </div>
      
      <div className="container mx-auto max-w-7xl text-center relative z-10">
        <ScrollAnimation animation="fadeInDown" delay={0}>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-8 tracking-[-0.03em]">
            Prêt à récupérer votre argent ?
          </h2>
        </ScrollAnimation>
        <ScrollAnimation animation="fadeInUp" delay={100}>
          <p className="text-xl sm:text-2xl mb-12 text-white/80 max-w-3xl mx-auto font-light leading-relaxed">
            Ne laissez plus vos factures impayées impacter votre trésorerie. 
            Un avocat qualifié est prêt à prendre en charge votre dossier dès aujourd'hui.
          </p>
        </ScrollAnimation>
        
        <ScrollAnimation animation="scaleIn" delay={200}>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Link href="/login">
              <Button size="lg" className="text-lg px-10 py-7 bg-[#16A34A] text-white hover:bg-[#16A34A]/90 border-2 border-[#16A34A] rounded-none font-bold transition-all hover:scale-105 shadow-lg animate-pulse">
                Lancer mon recouvrement maintenant
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </ScrollAnimation>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <ScrollAnimation animation="fadeInLeft" delay={300}>
            <div className="flex flex-col items-center p-6 border-2 border-white/20 rounded-lg hover:border-[#16A34A] transition-all duration-300 hover:scale-105 hover:shadow-xl">
              <div className="w-16 h-16 rounded-full bg-[#16A34A]/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Shield className="h-8 w-8 text-[#16A34A]" />
              </div>
              <p className="text-white">
                <strong className="text-white font-bold text-lg">100% sécurisé</strong><br />
                <span className="text-white/70">Données protégées</span>
              </p>
            </div>
          </ScrollAnimation>
          <ScrollAnimation animation="fadeInUp" delay={400}>
            <div className="flex flex-col items-center p-6 border-2 border-white/20 rounded-lg hover:border-[#16A34A] transition-all duration-300 hover:scale-105 hover:shadow-xl">
              <div className="w-16 h-16 rounded-full bg-[#16A34A]/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Clock className="h-8 w-8 text-[#16A34A]" />
              </div>
              <p className="text-white">
                <strong className="text-white font-bold text-lg">Rapide</strong><br />
                <span className="text-white/70">Dossier créé en 5 min</span>
              </p>
            </div>
          </ScrollAnimation>
          <ScrollAnimation animation="fadeInRight" delay={500}>
            <div className="flex flex-col items-center p-6 border-2 border-white/20 rounded-lg hover:border-[#16A34A] transition-all duration-300 hover:scale-105 hover:shadow-xl">
              <div className="w-16 h-16 rounded-full bg-[#16A34A]/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Users className="h-8 w-8 text-[#16A34A]" />
              </div>
              <p className="text-white">
                <strong className="text-white font-bold text-lg">Réseau d'avocats</strong><br />
                <span className="text-white/70">Réseau qualifié</span>
              </p>
            </div>
          </ScrollAnimation>
        </div>
      </div>
    </section>
  );
}

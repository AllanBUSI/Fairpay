"use client";

import { Users, Shield, Award, FileCheck } from "lucide-react";
import { DecorativeLines } from "./decorative-lines";
import { ScrollAnimation } from "./scroll-animation";

export function ProofSection() {
  return (
    <section className="relative py-32 px-4 sm:px-6 lg:px-8 bg-white overflow-hidden">
      {/* Lignes décoratives */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <DecorativeLines variant="diagonal" />
      </div>
      
      <div className="container mx-auto max-w-7xl relative z-10">
        <ScrollAnimation animation="fadeInDown" delay={0}>
          <div className="text-center mb-20">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#0F172A] mb-6 tracking-[-0.03em]">
              Pourquoi nous faire confiance ?
            </h2>
            <p className="text-xl sm:text-2xl text-[#0F172A]/70 max-w-3xl mx-auto font-light">
              Un réseau solide, une expertise reconnue, une méthode éprouvée.
            </p>
          </div>
        </ScrollAnimation>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          <ScrollAnimation animation="fadeInLeft" delay={100}>
            <div className="p-10 rounded-lg border-2 border-[#0F172A] bg-white hover:shadow-2xl transition-all duration-300 group hover:-translate-y-2">
            <div className="flex items-center gap-6 mb-6">
              <div className="w-20 h-20 rounded-full bg-[#0F172A] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <Users className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-3xl font-black text-[#0F172A]">
                Réseau d'avocats
              </h3>
            </div>
            <p className="text-[#0F172A]/70 text-lg leading-relaxed">
              Un <strong className="text-[#0F172A] font-bold">réseau d'avocats inscrits aux barreaux de Paris</strong>, 
              tous spécialisés en recouvrement de créances. Chaque dossier est confié 
              à un professionnel qualifié.
            </p>
          </div>
          </ScrollAnimation>
          
          <ScrollAnimation animation="fadeInRight" delay={200}>
            <div className="p-10 rounded-lg border-2 border-[#16A34A] bg-white hover:shadow-2xl transition-all duration-300 group hover:-translate-y-2">
              <div className="flex items-center gap-6 mb-6">
                <div className="w-20 h-20 rounded-full bg-[#16A34A] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <Shield className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-3xl font-black text-[#0F172A]">
                  Conformité légale
                </h3>
              </div>
              <p className="text-[#0F172A]/70 text-lg leading-relaxed">
                Toutes nos procédures sont <strong className="text-[#0F172A] font-bold">strictement conformes au droit français</strong>. 
                Nous respectons scrupuleusement la réglementation en vigueur.
              </p>
            </div>
          </ScrollAnimation>
          
          <ScrollAnimation animation="fadeInLeft" delay={300}>
            <div className="p-10 rounded-lg border-2 border-[#0F172A] bg-white hover:shadow-2xl transition-all duration-300 group hover:-translate-y-2">
              <div className="flex items-center gap-6 mb-6">
                <div className="w-20 h-20 rounded-full bg-[#0F172A] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <Award className="h-10 w-10 text-white" />
                </div>
                <h3 className="text-3xl font-black text-[#0F172A]">
                  Expertise juridique
                </h3>
              </div>
              <p className="text-[#0F172A]/70 text-lg leading-relaxed">
                Nos avocats maîtrisent parfaitement les mécanismes de recouvrement amiable 
                et judiciaire. Ils connaissent les meilleures stratégies pour récupérer votre dû.
              </p>
            </div>
          </ScrollAnimation>
          
          <ScrollAnimation animation="fadeInRight" delay={400}>
            <div className="p-10 rounded-lg border-2 border-[#2563EB] bg-white hover:shadow-2xl transition-all duration-300 group hover:-translate-y-2">
            <div className="flex items-center gap-6 mb-6">
              <div className="w-20 h-20 rounded-full bg-[#2563EB] flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                <FileCheck className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-3xl font-black text-[#0F172A]">
                Méthode éprouvée
              </h3>
            </div>
            <p className="text-[#0F172A]/70 text-lg leading-relaxed">
              Notre processus a été testé et optimisé sur des centaines de dossiers. 
              Nous savons ce qui fonctionne et ce qui ne fonctionne pas.
            </p>
          </div>
          </ScrollAnimation>
        </div>
        
        <ScrollAnimation animation="scaleIn" delay={500}>
          <div className="mt-16 p-10 rounded-lg bg-[#0F172A] text-white border-2 border-[#0F172A] hover:shadow-xl transition-all duration-300">
            <div className="text-center">
              <h3 className="text-3xl font-black text-white mb-6">
                Confidentialité totale garantie
              </h3>
              <p className="text-white/80 text-lg max-w-3xl mx-auto leading-relaxed">
                Vos données sont protégées et traitées en toute confidentialité. 
                Nous respectons le RGPD et toutes les normes de sécurité en vigueur.
              </p>
            </div>
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}

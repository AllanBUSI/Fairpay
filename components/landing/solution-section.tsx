"use client";

import { FileText, Scale, CheckCircle2 } from "lucide-react";
import { DecorativeLines } from "./decorative-lines";
import { ScrollAnimation } from "./scroll-animation";

export function SolutionSection() {
  return (
    <section id="processus" className="relative py-32 px-4 sm:px-6 lg:px-8 bg-white overflow-hidden">
      {/* Lignes décoratives */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
        <DecorativeLines variant="top" />
      </div>
      
      <div className="container mx-auto max-w-7xl relative z-10">
        <ScrollAnimation animation="fadeInDown" delay={0}>
          <div className="text-center mb-20">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#0F172A] mb-6 tracking-[-0.03em]">
              Un processus simple en 3 étapes
            </h2>
            <p className="text-xl sm:text-2xl text-[#0F172A]/70 max-w-3xl mx-auto font-light">
              De la création de votre dossier à la récupération de votre créance, 
              nous vous accompagnons à chaque étape.
            </p>
          </div>
        </ScrollAnimation>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <ScrollAnimation animation="fadeInLeft" delay={100}>
            <div className="relative group">
            <div className="absolute -top-6 -left-6 w-16 h-16 rounded-full bg-[#0F172A] text-white flex items-center justify-center font-black text-2xl z-10 border-4 border-white shadow-lg">
              1
            </div>
            <div className="p-10 rounded-lg border-2 border-[#0F172A] bg-white h-full pt-16 hover:shadow-2xl transition-all hover:-translate-y-2">
              <div className="flex justify-center mb-8">
                <div className="w-20 h-20 rounded-full bg-[#0F172A] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <FileText className="h-10 w-10 text-white" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-[#0F172A] mb-4 text-center">
                Créez votre dossier
              </h3>
              <p className="text-[#0F172A]/70 text-center leading-relaxed text-lg">
                Remplissez notre formulaire en ligne avec les informations de votre facture impayée. 
                C'est rapide, simple et sécurisé.
              </p>
            </div>
            </div>
          </ScrollAnimation>
          
          <ScrollAnimation animation="fadeInUp" delay={200}>
            <div className="relative group">
              <div className="absolute -top-6 -left-6 w-16 h-16 rounded-full bg-[#16A34A] text-white flex items-center justify-center font-black text-2xl z-10 border-4 border-white shadow-lg animate-float">
                2
              </div>
              <div className="p-10 rounded-lg border-2 border-[#16A34A] bg-white h-full pt-16 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
              <div className="flex justify-center mb-8">
                <div className="w-20 h-20 rounded-full bg-[#16A34A] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Scale className="h-10 w-10 text-white" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-[#0F172A] mb-4 text-center">
                Un avocat prend le relais
              </h3>
              <p className="text-[#0F172A]/70 text-center leading-relaxed text-lg">
                Dès que nécessaire, un avocat inscrit au barreau de Paris intervient 
                pour relancer votre débiteur de manière professionnelle et légale.
              </p>
            </div>
            </div>
          </ScrollAnimation>
          
          <ScrollAnimation animation="fadeInRight" delay={300}>
            <div className="relative group">
              <div className="absolute -top-6 -left-6 w-16 h-16 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-black text-2xl z-10 border-4 border-white shadow-lg animate-float" style={{ animationDelay: "0.5s" }}>
                3
              </div>
              <div className="p-10 rounded-lg border-2 border-[#2563EB] bg-white h-full pt-16 hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
              <div className="flex justify-center mb-8">
                <div className="w-20 h-20 rounded-full bg-[#2563EB] flex items-center justify-center group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="h-10 w-10 text-white" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-[#0F172A] mb-4 text-center">
                Récupérez votre argent
              </h3>
              <p className="text-[#0F172A]/70 text-center leading-relaxed text-lg">
                Suivez l'avancement de votre dossier en temps réel. 
                Vous êtes informé à chaque étape jusqu'au recouvrement complet.
              </p>
            </div>
            </div>
          </ScrollAnimation>
        </div>
        
        <ScrollAnimation animation="scaleIn" delay={400}>
          <div className="mt-16 p-8 rounded-lg bg-[#0F172A] text-white border-2 border-[#0F172A] hover:shadow-xl transition-all duration-300">
            <p className="text-center text-lg">
              <strong className="font-bold">Important :</strong> Chaque dossier est traité par un avocat réel, 
              pas par un robot. Vous bénéficiez d'un accompagnement humain et personnalisé 
              à chaque étape du processus.
            </p>
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}

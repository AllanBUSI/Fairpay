"use client";

import { Shield, Check, X, AlertCircle, FileText } from "lucide-react";
import { DecorativeLines } from "./decorative-lines";
import { ScrollAnimation } from "./scroll-animation";

export function RCProSection() {
  return (
    <section className="relative py-32 px-4 sm:px-6 lg:px-8 bg-white overflow-hidden">
      {/* Lignes décoratives - Masquées sur mobile */}
      <div className="absolute inset-0 pointer-events-none opacity-20 hidden md:block">
        <DecorativeLines variant="diagonal" />
      </div>
      
      <div className="container mx-auto max-w-7xl relative z-10">
        <ScrollAnimation animation="fadeInDown" delay={0}>
          <div className="text-center mb-20">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#0F172A] mb-6 animate-float">
              <Shield className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#0F172A] mb-6 tracking-[-0.03em]">
              Faites valoir votre assurance RC Pro
            </h2>
            <p className="text-xl sm:text-2xl text-[#0F172A]/70 max-w-3xl mx-auto font-light tracking-tight">
              Un avantage exclusif : seul un avocat peut activer votre protection juridique
            </p>
          </div>
        </ScrollAnimation>

        {/* Alerte importante */}
        <ScrollAnimation animation="scaleIn" delay={100}>
          <div className="mb-16 p-10 rounded-lg bg-[#2563EB]/10 border-2 border-[#2563EB] hover:shadow-xl transition-all duration-300">
          <div className="flex items-start gap-6">
            <AlertCircle className="h-10 w-10 text-[#2563EB] flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-2xl font-black text-[#0F172A] mb-4 tracking-tight">
                Important : Les services de recouvrement ne peuvent pas activer votre RC Pro
              </h3>
              <p className="text-[#0F172A] text-lg leading-relaxed font-light">
                Votre assurance Responsabilité Civile Professionnelle (RC Pro) couvre généralement 
                les frais d'avocat en cas de recouvrement de créances. Cependant, cette protection 
                n'est activable que par un avocat inscrit au barreau. Les plateformes de recouvrement 
                sans avocat ne peuvent pas faire valoir cette garantie.
              </p>
            </div>
          </div>
          </div>
        </ScrollAnimation>

        {/* Comparaison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          <ScrollAnimation animation="fadeInLeft" delay={200}>
            <div className="p-10 rounded-lg border-2 border-[#2563EB] bg-white hover:shadow-2xl transition-all duration-300 group hover:-translate-y-2">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-16 h-16 rounded-full bg-[#2563EB]/20 flex items-center justify-center group-hover:bg-[#2563EB] transition-colors">
                <X className="h-8 w-8 text-[#2563EB] group-hover:text-white transition-colors" />
              </div>
              <h3 className="text-2xl font-black text-[#0F172A] tracking-tight">
                Services de recouvrement classiques
              </h3>
            </div>
            <ul className="space-y-4 text-[#0F172A]/70 text-lg">
              <li className="flex items-start gap-3">
                <X className="h-6 w-6 text-[#2563EB] flex-shrink-0 mt-0.5" />
                <span className="font-light">Ne peuvent pas activer votre RC Pro</span>
              </li>
              <li className="flex items-start gap-3">
                <X className="h-6 w-6 text-[#2563EB] flex-shrink-0 mt-0.5" />
                <span className="font-light">Vous payez 100% des frais de votre poche</span>
              </li>
              <li className="flex items-start gap-3">
                <X className="h-6 w-6 text-[#2563EB] flex-shrink-0 mt-0.5" />
                <span className="font-light">Pas d'intervention d'un avocat qualifié</span>
              </li>
              <li className="flex items-start gap-3">
                <X className="h-6 w-6 text-[#2563EB] flex-shrink-0 mt-0.5" />
                <span className="font-light">Votre assurance ne peut pas vous rembourser</span>
              </li>
            </ul>
            </div>
          </ScrollAnimation>

          <ScrollAnimation animation="fadeInRight" delay={300}>
            <div className="p-10 rounded-lg border-2 border-[#16A34A] bg-white hover:shadow-2xl transition-all duration-300 group hover:-translate-y-2">
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 rounded-full bg-[#16A34A]/20 flex items-center justify-center group-hover:bg-[#16A34A] transition-colors">
                  <Check className="h-8 w-8 text-[#16A34A] group-hover:text-white transition-colors" />
                </div>
                <h3 className="text-2xl font-black text-[#0F172A] tracking-tight">
                  FairPay avec avocat
                </h3>
              </div>
              <ul className="space-y-4 text-[#0F172A]/70 text-lg">
                <li className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-[#16A34A] flex-shrink-0 mt-0.5" />
                  <span className="font-light">Activation possible de votre RC Pro</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-[#16A34A] flex-shrink-0 mt-0.5" />
                  <span className="font-light">Votre assurance peut prendre en charge les frais</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-[#16A34A] flex-shrink-0 mt-0.5" />
                  <span className="font-light">Intervention d'un avocat inscrit au barreau</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-[#16A34A] flex-shrink-0 mt-0.5" />
                  <span className="font-light">Remboursement possible selon votre contrat</span>
                </li>
              </ul>
            </div>
          </ScrollAnimation>
        </div>

        {/* Comment ça marche */}
        <ScrollAnimation animation="scaleIn" delay={400}>
          <div className="bg-[#0F172A] rounded-lg border-2 border-[#0F172A] p-12 text-white hover:shadow-xl transition-all duration-300">
            <h3 className="text-3xl sm:text-4xl font-black text-white mb-12 text-center tracking-[-0.03em]">
              Comment activer votre RC Pro ?
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-white text-[#0F172A] flex items-center justify-center mx-auto mb-6 font-black text-2xl">
                1
              </div>
              <div className="flex justify-center mb-4">
                <FileText className="h-10 w-10 text-white" />
              </div>
              <h4 className="font-black text-white mb-4 text-xl tracking-tight">
                Vérifiez votre contrat
              </h4>
              <p className="text-white/80 text-lg font-light leading-relaxed">
                Consultez votre contrat d'assurance RC Pro pour vérifier que le recouvrement 
                de créances est couvert.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-white text-[#0F172A] flex items-center justify-center mx-auto mb-6 font-black text-2xl">
                2
              </div>
              <div className="flex justify-center mb-4">
                <Shield className="h-10 w-10 text-white" />
              </div>
              <h4 className="font-black text-white mb-4 text-xl tracking-tight">
                Contactez votre assureur
              </h4>
              <p className="text-white/80 text-lg font-light leading-relaxed">
                Informez votre assureur que vous souhaitez faire intervenir un avocat 
                pour le recouvrement d'une créance.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-white text-[#0F172A] flex items-center justify-center mx-auto mb-6 font-black text-2xl">
                3
              </div>
              <div className="flex justify-center mb-4">
                <Check className="h-10 w-10 text-[#16A34A]" />
              </div>
              <h4 className="font-black text-white mb-4 text-xl tracking-tight">
                Faites intervenir un avocat
              </h4>
              <p className="text-white/80 text-lg font-light leading-relaxed">
                Avec FairPay, un avocat inscrit au barreau intervient. Votre assurance 
                peut alors prendre en charge les frais selon votre contrat.
              </p>
            </div>
          </div>
          </div>
        </ScrollAnimation>

        {/* Note importante */}
        <ScrollAnimation animation="fadeInUp" delay={500}>
          <div className="mt-16 p-8 rounded-lg bg-[#E5E7EB] border-2 border-[#E5E7EB] hover:shadow-xl transition-all duration-300">
            <p className="text-center text-[#0F172A]/70 text-lg leading-relaxed font-light">
              <strong className="font-bold text-[#0F172A]">Note importante :</strong> Les conditions de remboursement varient selon votre contrat d'assurance. 
              Vérifiez auprès de votre assureur les modalités de prise en charge des frais d'avocat pour le recouvrement de créances. 
              Seul un avocat inscrit au barreau peut activer cette garantie.
            </p>
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}

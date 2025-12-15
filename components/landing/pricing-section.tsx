"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Check, X, AlertTriangle, Scale, Shield } from "lucide-react";
import { DecorativeLines } from "./decorative-lines";
import { ScrollAnimation } from "./scroll-animation";

export function PricingSection() {
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
              Nos offres de recouvrement
            </h2>
            <p className="text-xl sm:text-2xl text-[#0F172A]/70 max-w-3xl mx-auto font-light tracking-tight">
              Tarifs transparents, sans surprise. Comparez avec les autres solutions.
            </p>
          </div>
        </ScrollAnimation>
        
        {/* Comparaison avec les concurrents */}
        <ScrollAnimation animation="scaleIn" delay={100}>
          <div className="mb-16 p-8 rounded-lg bg-[#2563EB]/10 border-2 border-[#2563EB] hover:shadow-xl transition-all duration-300">
          <div className="flex items-start gap-4">
            <AlertTriangle className="h-8 w-8 text-[#2563EB] flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-2xl font-black text-[#0F172A] mb-3 tracking-tight">
                Attention : Les recommandés sans lettre d'avocat n'ont pas de valeur légale
              </h3>
              <p className="text-[#0F172A] text-lg leading-relaxed font-light">
                Les plateformes qui envoient des recommandés sans intervention d'un avocat inscrit au barreau 
                n'ont aucune valeur juridique. Votre débiteur peut les ignorer sans conséquence. 
                Seule une mise en demeure signée par un avocat a une valeur légale réelle.
              </p>
            </div>
          </div>
          </div>
        </ScrollAnimation>

        {/* Tableau de comparaison */}
        <ScrollAnimation animation="fadeInUp" delay={200}>
          <div className="mb-16 overflow-x-auto">
          <table className="w-full border-collapse border-2 border-[#0F172A]">
            <thead>
              <tr className="bg-[#0F172A] text-white">
                <th className="border-2 border-[#0F172A] p-6 text-left font-bold text-lg">Caractéristiques</th>
                <th className="border-2 border-[#0F172A] p-6 text-center font-bold text-lg bg-[#2563EB]">
                  <div>Concurrents</div>
                  <div className="text-sm font-light mt-1">(sans avocat)</div>
                </th>
                <th className="border-2 border-[#0F172A] p-6 text-center font-bold text-lg bg-[#16A34A] relative">
                  <div className="absolute top-2 right-2 px-3 py-1 bg-white text-[#0F172A] text-xs font-bold rounded">
                    Recommandé
                  </div>
                  <div className="mt-4">FairPay</div>
                  <div className="text-sm font-light mt-1">(avec avocat)</div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border-2 border-[#0F172A] p-6 font-medium text-lg text-[#0F172A]">Mise en demeure par avocat</td>
                <td className="border-2 border-[#0F172A] p-6 text-center bg-[#2563EB]/10">
                  <X className="h-6 w-6 text-[#2563EB] mx-auto" />
                </td>
                <td className="border-2 border-[#0F172A] p-6 text-center bg-[#16A34A]/10">
                  <Check className="h-6 w-6 text-[#16A34A] mx-auto" />
                </td>
              </tr>
              <tr>
                <td className="border-2 border-[#0F172A] p-6 font-medium text-lg text-[#0F172A]">IHP</td>
                <td className="border-2 border-[#0F172A] p-6 text-center bg-[#2563EB]/10">
                  <span className="text-[#2563EB] font-bold">199 € HT</span>
                </td>
                <td className="border-2 border-[#0F172A] p-6 text-center bg-[#16A34A]/10">
                  <span className="text-[#16A34A] font-bold">79 € HT</span>
                </td>
              </tr>
              <tr>
                <td className="border-2 border-[#0F172A] p-6 font-medium text-lg text-[#0F172A]">Requête au juge commissaire</td>
                <td className="border-2 border-[#0F172A] p-6 text-center bg-[#2563EB]/10">
                  <span className="text-[#2563EB] font-bold">199 € HT</span>
                </td>
                <td className="border-2 border-[#0F172A] p-6 text-center bg-[#16A34A]/10">
                  <span className="text-[#16A34A] font-bold">250 € HT</span>
                </td>
              </tr>
              <tr>
                <td className="border-2 border-[#0F172A] p-6 font-medium text-lg text-[#0F172A]">Valeur légale du recommandé</td>
                <td className="border-2 border-[#0F172A] p-6 text-center bg-[#2563EB]/10">
                  <span className="text-[#2563EB] font-bold">Aucune</span>
                </td>
                <td className="border-2 border-[#0F172A] p-6 text-center bg-[#16A34A]/10">
                  <span className="text-[#16A34A] font-bold">Totale</span>
                </td>
              </tr>
              <tr>
                <td className="border-2 border-[#0F172A] p-6 font-medium text-lg text-[#0F172A]">Avis d'un expert avocat</td>
                <td className="border-2 border-[#0F172A] p-6 text-center bg-[#2563EB]/10">
                  <X className="h-6 w-6 text-[#2563EB] mx-auto" />
                </td>
                <td className="border-2 border-[#0F172A] p-6 text-center bg-[#16A34A]/10">
                  <Check className="h-6 w-6 text-[#16A34A] mx-auto" />
                </td>
              </tr>
              <tr>
                <td className="border-2 border-[#0F172A] p-6 font-medium text-lg text-[#0F172A]">Commission sur recouvrement</td>
                <td className="border-2 border-[#0F172A] p-6 text-center bg-[#2563EB]/10">
                  <span className="text-[#2563EB] font-bold">10% du montant</span>
                </td>
                <td className="border-2 border-[#0F172A] p-6 text-center bg-[#16A34A]/10">
                  <span className="text-[#16A34A] font-bold">Aucune</span>
                </td>
              </tr>
              <tr>
                <td className="border-2 border-[#0F172A] p-6 font-medium text-lg text-[#0F172A]">Suivi par un avocat dédié</td>
                <td className="border-2 border-[#0F172A] p-6 text-center bg-[#2563EB]/10">
                  <X className="h-6 w-6 text-[#2563EB] mx-auto" />
                </td>
                <td className="border-2 border-[#0F172A] p-6 text-center bg-[#16A34A]/10">
                  <Check className="h-6 w-6 text-[#16A34A] mx-auto" />
                </td>
              </tr>
              <tr>
                <td className="border-2 border-[#0F172A] p-6 font-medium text-lg text-[#0F172A]">Conformité légale garantie</td>
                <td className="border-2 border-[#0F172A] p-6 text-center bg-[#2563EB]/10">
                  <X className="h-6 w-6 text-[#2563EB] mx-auto" />
                </td>
                <td className="border-2 border-[#0F172A] p-6 text-center bg-[#16A34A]/10">
                  <Check className="h-6 w-6 text-[#16A34A] mx-auto" />
                </td>
              </tr>
            </tbody>
          </table>
          </div>
        </ScrollAnimation>

        {/* Nos tarifs */}
        <div className="mb-16">
          <ScrollAnimation animation="fadeInDown" delay={300}>
            <h3 className="text-3xl sm:text-4xl font-black text-[#0F172A] mb-12 text-center tracking-[-0.03em]">
              Nos tarifs transparents
            </h3>
          </ScrollAnimation>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <ScrollAnimation animation="fadeInLeft" delay={400}>
              <div className="p-10 rounded-lg border-2 border-[#0F172A] bg-white hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-16 h-16 rounded-full bg-[#0F172A] flex items-center justify-center">
                    <Scale className="h-8 w-8 text-white" />
                  </div>
                  <h4 className="text-2xl font-black text-[#0F172A] tracking-tight">
                    Mise en demeure
                  </h4>
                </div>
                <p className="text-[#0F172A]/70 text-lg mb-6 font-light">
                  Relance professionnelle par un avocat inscrit au barreau
                </p>
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-4 border-b-2 border-[#E5E7EB]">
                    <span className="text-[#0F172A]/70 font-light text-lg">Sans abonnement</span>
                    <span className="text-3xl font-black text-[#0F172A]">179 € HT</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-[#0F172A]/70 font-light text-lg">Avec abonnement</span>
                    <span className="text-3xl font-black text-[#16A34A]">99 € HT</span>
                  </div>
                </div>
              </div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-[#16A34A] flex-shrink-0 mt-0.5" />
                  <span className="text-[#0F172A]/70 text-lg font-light">Mise en demeure signée par un avocat</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-[#16A34A] flex-shrink-0 mt-0.5" />
                  <span className="text-[#0F172A]/70 text-lg font-light">Valeur légale garantie</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-[#16A34A] flex-shrink-0 mt-0.5" />
                  <span className="text-[#0F172A]/70 text-lg font-light">Suivi personnalisé par un avocat</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-[#16A34A] flex-shrink-0 mt-0.5" />
                  <span className="text-[#0F172A]/70 text-lg font-light">Aucune commission sur recouvrement</span>
                </li>
              </ul>
              </div>
            </ScrollAnimation>
            
            <ScrollAnimation animation="fadeInRight" delay={500}>
              <div className="p-10 rounded-lg border-2 border-[#16A34A] bg-white hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 relative">
              <div className="absolute top-6 right-6 px-4 py-2 bg-[#16A34A] text-white text-sm font-bold rounded">
                Recommandé
              </div>
              
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-16 h-16 rounded-full bg-[#16A34A] flex items-center justify-center">
                    <Shield className="h-8 w-8 text-white" />
                  </div>
                  <h4 className="text-2xl font-black text-[#0F172A] tracking-tight">
                    Écheancier de paiement
                  </h4>
                </div>
                <p className="text-[#0F172A]/70 text-lg mb-6 font-light">
                  Écheancier personnalisé pour organiser le remboursement
                </p>
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-4 border-b-2 border-[#E5E7EB]">
                    <span className="text-[#0F172A]/70 font-light text-lg">Sans abonnement</span>
                    <span className="text-3xl font-black text-[#0F172A]">49 € HT</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-[#0F172A]/70 font-light text-lg">Avec abonnement</span>
                    <span className="text-3xl font-black text-[#16A34A]">Gratuit</span>
                  </div>
                </div>
              </div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-[#16A34A] flex-shrink-0 mt-0.5" />
                  <span className="text-[#0F172A]/70 text-lg font-light">Écheancier personnalisé selon vos besoins</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-[#16A34A] flex-shrink-0 mt-0.5" />
                  <span className="text-[#0F172A]/70 text-lg font-light">Gratuit avec l'abonnement</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-[#16A34A] flex-shrink-0 mt-0.5" />
                  <span className="text-[#0F172A]/70 text-lg font-light">Créé par un avocat expert</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-[#16A34A] flex-shrink-0 mt-0.5" />
                  <span className="text-[#0F172A]/70 text-lg font-light">Conforme à la réglementation</span>
                </li>
              </ul>
              </div>
            </ScrollAnimation>

            <ScrollAnimation animation="fadeInLeft" delay={600}>
              <div className="p-10 rounded-lg border-2 border-[#0F172A] bg-white hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-16 h-16 rounded-full bg-[#0F172A] flex items-center justify-center">
                    <Scale className="h-8 w-8 text-white" />
                  </div>
                  <h4 className="text-2xl font-black text-[#0F172A] tracking-tight">
                    Injonction de payer (IHP)
                  </h4>
                </div>
                <p className="text-[#0F172A]/70 text-lg mb-6 font-light">
                  Procédure accélérée pour récupérer rapidement votre créance
                </p>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[#0F172A]/70 font-light text-lg">Tarif unique</span>
                    <span className="text-3xl font-black text-[#0F172A]">79 € HT</span>
                  </div>
                </div>
              </div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-[#16A34A] flex-shrink-0 mt-0.5" />
                  <span className="text-[#0F172A]/70 text-lg font-light">Procédure accélérée</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-[#16A34A] flex-shrink-0 mt-0.5" />
                  <span className="text-[#0F172A]/70 text-lg font-light">Décision rapide du juge</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-[#16A34A] flex-shrink-0 mt-0.5" />
                  <span className="text-[#0F172A]/70 text-lg font-light">Gestion par un avocat expert</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-[#16A34A] flex-shrink-0 mt-0.5" />
                  <span className="text-[#0F172A]/70 text-lg font-light">Efficace pour les créances certaines</span>
                </li>
              </ul>
              </div>
            </ScrollAnimation>

            <ScrollAnimation animation="fadeInRight" delay={700}>
              <div className="p-10 rounded-lg border-2 border-[#2563EB] bg-white hover:shadow-2xl transition-all duration-300 hover:-translate-y-2">
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-16 h-16 rounded-full bg-[#2563EB] flex items-center justify-center">
                    <Scale className="h-8 w-8 text-white" />
                  </div>
                  <h4 className="text-2xl font-black text-[#0F172A] tracking-tight">
                    Recouvrement judiciaire
                  </h4>
                </div>
                <p className="text-[#0F172A]/70 text-lg mb-6 font-light">
                  Encadré par avocat et commissaire de justice
                </p>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-[#0F172A]/70 font-light text-lg">Tarif unique</span>
                    <span className="text-3xl font-black text-[#0F172A]">250 € HT</span>
                  </div>
                </div>
              </div>
              
              <ul className="space-y-4 mb-8">
                <li className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-[#16A34A] flex-shrink-0 mt-0.5" />
                  <span className="text-[#0F172A]/70 text-lg font-light">Procédure judiciaire complète</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-[#16A34A] flex-shrink-0 mt-0.5" />
                  <span className="text-[#0F172A]/70 text-lg font-light">Encadré par un avocat expert</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-[#16A34A] flex-shrink-0 mt-0.5" />
                  <span className="text-[#0F172A]/70 text-lg font-light">Commissaire de justice dédié</span>
                </li>
                <li className="flex items-start gap-3">
                  <Check className="h-6 w-6 text-[#16A34A] flex-shrink-0 mt-0.5" />
                  <span className="text-[#0F172A]/70 text-lg font-light">Tarif fixe, pas de commission</span>
                </li>
              </ul>
              </div>
            </ScrollAnimation>

          </div>
        </div>

        {/* Avantages de l'avocat */}
        <ScrollAnimation animation="scaleIn" delay={800}>
          <div className="mb-16 p-12 rounded-lg bg-[#0F172A] text-white border-2 border-[#0F172A] hover:shadow-xl transition-all duration-300">
          <h3 className="text-3xl sm:text-4xl font-black text-white mb-12 text-center tracking-[-0.03em]">
            Pourquoi choisir un avocat ?
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-6">
                <Scale className="h-10 w-10 text-white" />
              </div>
              <h4 className="font-black text-white mb-4 text-xl tracking-tight">Valeur légale</h4>
              <p className="text-white/80 text-lg font-light leading-relaxed">
                Seule une mise en demeure signée par un avocat inscrit au barreau a une valeur légale réelle. 
                Votre débiteur ne peut pas l'ignorer.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-6">
                <Shield className="h-10 w-10 text-white" />
              </div>
              <h4 className="font-black text-white mb-4 text-xl tracking-tight">Expertise juridique</h4>
              <p className="text-white/80 text-lg font-light leading-relaxed">
                Un avocat expert en recouvrement connaît les meilleures stratégies pour récupérer votre dû 
                rapidement et efficacement.
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-6">
                <Check className="h-10 w-10 text-[#16A34A]" />
              </div>
              <h4 className="font-black text-white mb-4 text-xl tracking-tight">Pas de commission</h4>
              <p className="text-white/80 text-lg font-light leading-relaxed">
                Contrairement aux autres plateformes qui prennent 10% du montant récupéré, 
                nous ne prenons aucune commission. Vous récupérez 100% de votre dû.
              </p>
            </div>
          </div>
          </div>
        </ScrollAnimation>

        {/* CTA */}
        <ScrollAnimation animation="fadeInUp" delay={900}>
          <div className="text-center">
          <Link href="/login">
            <Button size="lg" className="text-lg px-10 py-7 bg-[#16A34A] text-white hover:bg-[#16A34A]/90 border-2 border-[#16A34A] rounded-none font-bold transition-all hover:scale-105 shadow-lg">
              Lancer mon recouvrement avec un avocat
            </Button>
          </Link>
          <p className="text-sm text-[#0F172A]/60 mt-6 font-light">
            Transparence totale : Aucun frais caché, aucune commission sur recouvrement
          </p>
        </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}

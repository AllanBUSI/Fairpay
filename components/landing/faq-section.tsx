"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { DecorativeLines } from "./decorative-lines";
import { ScrollAnimation } from "./scroll-animation";

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: "Quels sont les délais de recouvrement ?",
    answer: "Les délais varient selon la complexité du dossier et la réactivité du débiteur. En général, le recouvrement amiable prend entre 2 à 4 semaines. Si une procédure judiciaire est nécessaire, les délais peuvent s'étendre de 3 à 6 mois selon les cas. Nous vous tenons informé régulièrement de l'avancement de votre dossier."
  },
  {
    question: "Quels sont les coûts ?",
    answer: "Nos tarifs sont transparents et adaptés à chaque situation. Pour le recouvrement amiable, les coûts sont clairement indiqués lors de la création de votre dossier. Pour le recouvrement judiciaire, un devis personnalisé vous est proposé par l'avocat en charge de votre dossier. Aucun frais caché, aucune surprise."
  },
  {
    question: "Quelles sont mes chances de succès ?",
    answer: "Le taux de succès dépend de nombreux facteurs : la solvabilité du débiteur, l'ancienneté de la créance, la qualité des preuves, etc. Nos avocats évaluent chaque dossier individuellement et vous informent des chances de recouvrement. En moyenne, le recouvrement amiable fonctionne dans environ 60 à 70% des cas. Si nécessaire, la procédure judiciaire augmente significativement les chances de succès."
  },
  {
    question: "Mes données sont-elles confidentielles ?",
    answer: "Absolument. La confidentialité est une priorité absolue. Toutes vos données sont protégées et traitées en conformité avec le RGPD. Seuls les avocats en charge de votre dossier ont accès aux informations nécessaires. Nous ne partageons jamais vos données avec des tiers sans votre consentement explicite."
  },
  {
    question: "Puis-je suivre l'avancement de mon dossier ?",
    answer: "Oui, vous avez accès à un espace personnel où vous pouvez suivre en temps réel l'avancement de votre dossier. Vous recevez également des notifications à chaque étape importante : envoi de la mise en demeure, réponse du débiteur, démarrage d'une procédure judiciaire, etc."
  },
  {
    question: "Que se passe-t-il si le débiteur ne paie pas ?",
    answer: "Si le recouvrement amiable échoue, nous vous proposons de passer à une procédure judiciaire. Un avocat vous accompagne dans cette démarche et vous fournit un devis détaillé. Vous décidez ensuite si vous souhaitez poursuivre ou non. Nous ne vous engageons jamais dans une procédure judiciaire sans votre accord explicite."
  },
  {
    question: "Puis-je annuler mon dossier ?",
    answer: "Oui, vous pouvez demander l'annulation de votre dossier à tout moment. Cependant, les frais engagés jusqu'à la date d'annulation restent dus. Nous vous informons clairement des conditions d'annulation lors de la création de votre dossier."
  },
  {
    question: "Travaillez-vous avec tous types d'entreprises ?",
    answer: "Oui, nous travaillons avec tous types d'entreprises : TPE, PME, indépendants, professions libérales, etc. Notre réseau d'avocats est capable de traiter des dossiers de toutes tailles et de tous secteurs d'activité."
  }
];

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="relative py-32 px-4 sm:px-6 lg:px-8 bg-[#0F172A] text-white overflow-hidden">
      {/* Lignes décoratives */}
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <DecorativeLines variant="diagonal" />
      </div>
      
      <div className="container mx-auto max-w-5xl relative z-10">
        <ScrollAnimation animation="fadeInDown" delay={0}>
          <div className="text-center mb-20">
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white mb-6 tracking-[-0.03em]">
              Questions fréquentes
            </h2>
            <p className="text-xl sm:text-2xl text-white/70 font-light tracking-tight">
              Tout ce que vous devez savoir sur notre service de recouvrement
            </p>
          </div>
        </ScrollAnimation>
        
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <ScrollAnimation key={index} animation="fadeInUp" delay={index * 50}>
              <div
                className="border-2 border-white/20 rounded-lg bg-[#0F172A] overflow-hidden hover:border-[#16A34A] transition-all duration-300 hover:scale-[1.02] hover:shadow-xl"
              >
              <button
                onClick={() => toggleFAQ(index)}
                className="w-full px-8 py-6 text-left flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <span className="font-bold text-white text-lg pr-4 tracking-tight">
                  {faq.question}
                </span>
                {openIndex === index ? (
                  <ChevronUp className="h-6 w-6 text-white flex-shrink-0" />
                ) : (
                  <ChevronDown className="h-6 w-6 text-white flex-shrink-0" />
                )}
              </button>
              {openIndex === index && (
                <div className="px-8 pb-6 border-t border-white/10 pt-6">
                  <p className="text-white/80 leading-relaxed text-lg font-light">
                    {faq.answer}
                  </p>
                </div>
              )}
              </div>
            </ScrollAnimation>
          ))}
        </div>
      </div>
    </section>
  );
}

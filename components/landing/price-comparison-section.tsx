"use client";

import { useState } from "react";
import { Calculator, TrendingDown, TrendingUp, Check } from "lucide-react";
import { DecorativeLines } from "./decorative-lines";
import { ScrollAnimation } from "./scroll-animation";

export function PriceComparisonSection() {
  const [montant, setMontant] = useState<number>(2000);
  const [hasAbonnement, setHasAbonnement] = useState<boolean>(true);
  const [hasEcheancier, setHasEcheancier] = useState<boolean>(false);
  const [hasIHP, setHasIHP] = useState<boolean>(false);
  const [hasCJ, setHasCJ] = useState<boolean>(false);

  // Calculs corrigés
  const tarifMiseEnDemeureHT = hasAbonnement ? 99 : 179;
  const tarifEcheancierHT = hasAbonnement ? 0 : 49;
  const tarifIHPHT = hasIHP ? 79 : 0;
  const tarifCJHT = hasCJ ? 250 : 0;
  const tarifAbonnementHT = hasAbonnement ? 29 : 0;
  const tarifTotalHT =
    tarifMiseEnDemeureHT +
    (hasEcheancier ? tarifEcheancierHT : 0) +
    tarifIHPHT +
    tarifCJHT +
    tarifAbonnementHT;
  const tarifTotalTTC = tarifTotalHT * 1.2;

  const commissionConcurrentsHT = montant * 0.1;
  const tarifConcurrentsIHPHT = hasIHP ? 199 : 0;
  const tarifConcurrentsRequeteHT = hasCJ ? 199 : 0;
  const totalConcurrentsHT =
    commissionConcurrentsHT + tarifConcurrentsIHPHT + tarifConcurrentsRequeteHT;
  const totalConcurrentsTTC = totalConcurrentsHT * 1.2;
  const montantRecuConcurrents = montant - totalConcurrentsTTC;

  // Remboursement article 700 : uniquement sur les frais de justice (IHP/CJ), pas sur abonnements ou lettres simples
  const remboursementArticle700 =
    hasIHP || hasCJ
      ? (hasIHP ? tarifIHPHT : 0) + (hasCJ ? tarifCJHT : 0)
      : 0;
  const montantRecuFairPay = montant - tarifTotalTTC + remboursementArticle700;
  const economie = montantRecuFairPay - montantRecuConcurrents;

  return (
    <section className="relative py-32 px-4 sm:px-6 lg:px-8 bg-white overflow-hidden">
      {/* Lignes décoratives */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <DecorativeLines variant="diagonal" />
      </div>

      <div className="container mx-auto max-w-7xl relative z-10">
        <ScrollAnimation animation="fadeInDown" delay={0}>
          <div className="text-center mb-20">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-[#0F172A] mb-6">
              <Calculator className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black text-[#0F172A] mb-6 tracking-[-0.03em]">
              Simulateur de recouvrement
            </h2>
            <p className="text-xl sm:text-2xl text-[#0F172A]/70 max-w-3xl mx-auto font-light tracking-tight">
              Calculez combien vous économisez avec FairPay par rapport aux concurrents
            </p>
          </div>
        </ScrollAnimation>

        {/* Formulaire de simulation */}
        <ScrollAnimation animation="scaleIn" delay={100}>
          <div className="mb-16 p-12 rounded-lg bg-[#E5E7EB] border-2 border-[#E5E7EB] hover:shadow-xl transition-all duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
              {/* Input montant */}
              <div>
                <label htmlFor="montant" className="block text-lg font-bold text-[#0F172A] mb-4 tracking-tight">
                  Montant de votre créance (€)
                </label>
                <input
                  id="montant"
                  type="number"
                  min="0"
                  step="1"
                  value={montant}
                  onChange={(e) => setMontant(Number(e.target.value) || 0)}
                  className="w-full px-6 py-4 text-2xl font-bold border-2 border-[#0F172A] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F172A]"
                  placeholder="1000"
                />
              </div>

              {/* Options */}
              <div className="space-y-4">
                <label className="block text-lg font-bold text-[#0F172A] mb-4 tracking-tight">
                  Options
                </label>

                <label className="flex items-center gap-4 p-4 rounded-lg border-2 border-[#E5E7EB] hover:border-[#16A34A] transition-colors cursor-pointer bg-white">
                  <input
                    type="checkbox"
                    checked={hasAbonnement}
                    onChange={(e) => setHasAbonnement(e.target.checked)}
                    className="w-5 h-5 rounded border-2 border-[#0F172A] text-[#16A34A] focus:ring-2 focus:ring-[#16A34A]"
                  />
                  <div className="flex-1">
                    <div className="font-bold text-[#0F172A]">
                      Abonnement mensuel (29 € HT/mois)
                    </div>
                    <div className="text-sm text-[#0F172A]/60 font-light">
                      Mise en demeure à 99 € HT au lieu de 179 € HT
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-4 p-4 rounded-lg border-2 border-[#E5E7EB] hover:border-[#16A34A] transition-colors cursor-pointer bg-white">
                  <input
                    type="checkbox"
                    checked={hasEcheancier}
                    onChange={(e) => setHasEcheancier(e.target.checked)}
                    className="w-5 h-5 rounded border-2 border-[#0F172A] text-[#16A34A] focus:ring-2 focus:ring-[#16A34A]"
                  />
                  <div className="flex-1">
                    <div className="font-bold text-[#0F172A]">
                      Écheancier de paiement
                    </div>
                    <div className="text-sm text-[#0F172A]/60 font-light">
                      {hasAbonnement ? "Gratuit avec l'abonnement" : "49 € HT"}
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-4 p-4 rounded-lg border-2 border-[#E5E7EB] hover:border-[#16A34A] transition-colors cursor-pointer bg-white">
                  <input
                    type="checkbox"
                    checked={hasIHP}
                    onChange={(e) => setHasIHP(e.target.checked)}
                    className="w-5 h-5 rounded border-2 border-[#0F172A] text-[#16A34A] focus:ring-2 focus:ring-[#16A34A]"
                  />
                  <div className="flex-1">
                    <div className="font-bold text-[#0F172A]">
                      Injonction de payer (IHP)
                    </div>
                    <div className="text-sm text-[#0F172A]/60 font-light">
                      79 € HT - Procédure accélérée pour récupérer rapidement
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-4 p-4 rounded-lg border-2 border-[#E5E7EB] hover:border-[#16A34A] transition-colors cursor-pointer bg-white">
                  <input
                    type="checkbox"
                    checked={hasCJ}
                    onChange={(e) => setHasCJ(e.target.checked)}
                    className="w-5 h-5 rounded border-2 border-[#0F172A] text-[#16A34A] focus:ring-2 focus:ring-[#16A34A]"
                  />
                  <div className="flex-1">
                    <div className="font-bold text-[#0F172A]">
                      Recouvrement judiciaire
                    </div>
                    <div className="text-sm text-[#0F172A]/60 font-light">
                      250 € HT - Encadré par avocat et commissaire de justice
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </ScrollAnimation>

        {/* Résultats de comparaison */}
        <ScrollAnimation animation="fadeInUp" delay={200}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Concurrents */}
            <div className="p-10 rounded-lg border-2 border-[#2563EB] bg-white">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-[#2563EB]/20 flex items-center justify-center">
                  <TrendingDown className="h-8 w-8 text-[#2563EB]" />
                </div>
                <h3 className="text-2xl font-black text-[#0F172A] tracking-tight">
                  Concurrents
                </h3>
              </div>
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center pb-4 border-b-2 border-[#E5E7EB]">
                  <span className="text-[#0F172A]/70 font-light text-lg">
                    Montant récupéré
                  </span>
                  <span className="text-2xl font-black text-[#0F172A]">
                    {montant.toLocaleString("fr-FR")} €
                  </span>
                </div>
                <div className="space-y-2 pb-4 border-b-2 border-[#E5E7EB]">
                  <div className="flex justify-between items-center">
                    <span className="text-[#0F172A]/70 font-light text-sm">
                      Commission (10%) HT
                    </span>
                    <span className="text-lg font-bold text-[#0F172A]">
                      - {commissionConcurrentsHT.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
                    </span>
                  </div>
                  {hasIHP && (
                    <div className="flex justify-between items-center">
                      <span className="text-[#0F172A]/70 font-light text-sm">
                        IHP HT
                      </span>
                      <span className="text-lg font-bold text-[#0F172A]">
                        - {tarifConcurrentsIHPHT.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
                      </span>
                    </div>
                  )}
                  {hasCJ && (
                    <div className="flex justify-between items-center">
                      <span className="text-[#0F172A]/70 font-light text-sm">
                        Requête au juge commissaire HT
                      </span>
                      <span className="text-lg font-bold text-[#0F172A]">
                        - {tarifConcurrentsRequeteHT.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-[#0F172A]/70 font-light text-sm">
                      Sous-total HT
                    </span>
                    <span className="text-lg font-bold text-[#0F172A]">
                      - {totalConcurrentsHT.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#0F172A]/70 font-light text-sm">
                      TVA (20%)
                    </span>
                    <span className="text-lg font-bold text-[#0F172A]">
                      - {(totalConcurrentsTTC - totalConcurrentsHT).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-[#E5E7EB]">
                    <span className="text-[#0F172A]/70 font-light text-lg">
                      Total frais TTC
                    </span>
                    <span className="text-2xl font-black text-[#2563EB]">
                      - {totalConcurrentsTTC.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-4">
                  <span className="text-[#0F172A] font-bold text-xl">
                    Vous recevez
                  </span>
                  <span className="text-3xl font-black text-[#0F172A]">
                    {montantRecuConcurrents.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
                  </span>
                </div>
              </div>
              <div className="p-4 rounded-lg bg-[#2563EB]/10 border-2 border-[#2563EB]/20">
                <p className="text-[#2563EB] text-sm font-light">
                  <strong className="font-bold">Attention :</strong> Plus le montant est élevé, plus la commission augmente.
                  Sur {Math.round(montant * 5).toLocaleString("fr-FR")} €, vous perdez {Math.round(montant * 5 * 0.1).toLocaleString("fr-FR")} € !
                </p>
              </div>
            </div>
            {/* FairPay */}
            <div className="p-10 rounded-lg border-2 border-[#16A34A] bg-white relative">
              <div className="absolute top-6 right-6 px-4 py-2 bg-[#16A34A] text-white text-sm font-bold rounded">
                Recommandé
              </div>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-[#16A34A] flex items-center justify-center">
                  <TrendingUp className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-2xl font-black text-[#0F172A] tracking-tight">
                  FairPay
                </h3>
              </div>
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center pb-4 border-b-2 border-[#E5E7EB]">
                  <span className="text-[#0F172A]/70 font-light text-lg">
                    Montant récupéré
                  </span>
                  <span className="text-2xl font-black text-[#0F172A]">
                    {montant.toLocaleString("fr-FR")} €
                  </span>
                </div>
                <div className="space-y-2 pb-4 border-b-2 border-[#E5E7EB]">
                  <div className="flex justify-between items-center">
                    <span className="text-[#0F172A]/70 font-light text-sm">
                      Mise en demeure HT
                    </span>
                    <span className="text-lg font-bold text-[#0F172A]">
                      - {tarifMiseEnDemeureHT} €
                    </span>
                  </div>
                  {hasEcheancier && (
                    <div className="flex justify-between items-center">
                      <span className="text-[#0F172A]/70 font-light text-sm">
                        Écheancier HT
                      </span>
                      <span className="text-lg font-bold text-[#0F172A]">
                        - {tarifEcheancierHT} €
                      </span>
                    </div>
                  )}
                  {hasIHP && (
                    <div className="flex justify-between items-center">
                      <span className="text-[#0F172A]/70 font-light text-sm">
                        Injonction de payer (IHP) HT
                      </span>
                      <span className="text-lg font-bold text-[#0F172A]">
                        - {tarifIHPHT} €
                      </span>
                    </div>
                  )}
                  {hasCJ && (
                    <div className="flex justify-between items-center">
                      <span className="text-[#0F172A]/70 font-light text-sm">
                        Recouvrement judiciaire HT
                      </span>
                      <span className="text-lg font-bold text-[#0F172A]">
                        - {tarifCJHT} €
                      </span>
                    </div>
                  )}
                  {hasAbonnement && (
                    <div className="flex justify-between items-center">
                      <span className="text-[#0F172A]/70 font-light text-sm">
                        Abonnement (1 mois) HT
                      </span>
                      <span className="text-lg font-bold text-[#0F172A]">
                        - {tarifAbonnementHT} €
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-[#E5E7EB]">
                    <span className="text-[#0F172A]/70 font-light text-sm">
                      Sous-total HT
                    </span>
                    <span className="text-lg font-bold text-[#0F172A]">
                      - {tarifTotalHT} €
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#0F172A]/70 font-light text-sm">
                      TVA (20%)
                    </span>
                    <span className="text-lg font-bold text-[#0F172A]">
                      - {(tarifTotalTTC - tarifTotalHT).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-4">
                  <span className="text-[#0F172A] font-bold text-xl">
                    Total des frais TTC
                  </span>
                  <span className="text-2xl font-black text-[#16A34A]">
                    - {tarifTotalTTC.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
                  </span>
                </div>
                <div className="flex justify-between items-center pt-4 border-t-2 border-[#E5E7EB]">
                  <span className="text-[#0F172A] font-bold text-xl">
                    Vous recevez
                  </span>
                  <span className="text-3xl font-black text-[#16A34A]">
                    {montantRecuFairPay.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
                  </span>
                </div>
                {(hasIHP || hasCJ) && (
                  <div className="mt-4 pt-4 border-t-2 border-[#16A34A]/20">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[#0F172A]/70 font-light text-sm">
                        Récupération frais de justice (art. 700)
                      </span>
                      <span className="text-lg font-bold text-[#16A34A]">
                        + {remboursementArticle700.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-[#16A34A]/20">
                      <span className="text-[#0F172A] font-bold text-lg">
                        Total avec remboursement
                      </span>
                      <span className="text-2xl font-black text-[#16A34A]">
                        {(montantRecuFairPay + remboursementArticle700).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-4 rounded-lg bg-[#16A34A]/10 border-2 border-[#16A34A]/20">
                <p className="text-[#16A34A] text-sm font-light">
                  <strong className="font-bold">Avantage :</strong> Le tarif reste fixe, même si vous récupérez {Math.round(montant * 10).toLocaleString("fr-FR")} € !
                  Vous gardez {montant > 0 ? ((montant - tarifTotalTTC) / montant * 100).toFixed(2) : "0"}% de votre créance.
                  {(hasIHP || hasCJ) && (
                    <span className="block mt-2">
                      <strong className="font-bold">Bonus :</strong> Avec l&apos;article 700 du Code de procédure civile, vous récupérez vos frais de justice
                      {hasIHP && hasCJ
                        ? " (IHP et CJ)."
                        : hasIHP
                        ? " (IHP)."
                        : hasCJ
                        ? " (CJ)."
                        : ""}
                      {" "}
                      Vos frais sont donc remboursés par le débiteur.
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </ScrollAnimation>

        {/* Économie */}
        <ScrollAnimation animation="scaleIn" delay={300}>
          {economie > 0 && (
            <div className="mt-8 p-8 rounded-lg bg-[#16A34A] text-white border-2 border-[#16A34A] hover:shadow-xl transition-all duration-300">
              <div className="text-center">
                <div className="text-4xl font-black mb-2">
                  Vous économisez {economie.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €
                </div>
                <p className="text-lg font-light text-white/90">
                  avec FairPay par rapport aux concurrents
                </p>
              </div>
            </div>
          )}
          {economie <= 0 && montant > 0 && (
            <div className="mt-8 p-8 rounded-lg bg-[#E5E7EB] border-2 border-[#E5E7EB] hover:shadow-xl transition-all duration-300">
              <div className="text-center">
                <div className="text-2xl font-bold text-[#0F172A] mb-2">
                  Sur {montant.toLocaleString('fr-FR')} €, les tarifs sont équivalents
                </div>
                <p className="text-lg font-light text-[#0F172A]/70">
                  Mais avec FairPay, vous bénéficiez d&apos;un avocat réel et d&apos;une valeur légale garantie
                </p>
              </div>
            </div>
          )}
        </ScrollAnimation>

        {/* Tableau comparatif pour différents montants */}
        <ScrollAnimation animation="fadeInUp" delay={400}>
          <div className="overflow-x-auto mt-16">
            <h3 className="text-2xl font-black text-[#0F172A] mb-8 text-center tracking-tight">
              Comparaison selon le montant récupéré
            </h3>
            <table className="w-full border-collapse border-2 border-[#0F172A]">
              <thead>
                <tr className="bg-[#0F172A] text-white">
                  <th className="border-2 border-[#0F172A] p-6 text-left font-bold text-lg">Montant récupéré</th>
                  <th className="border-2 border-[#0F172A] p-6 text-center font-bold text-lg bg-[#2563EB]">
                    Concurrents<br />
                    <span className="text-sm font-light">(10% de commission + TVA)</span>
                  </th>
                  <th className="border-2 border-[#0F172A] p-6 text-center font-bold text-lg bg-[#16A34A]">
                    FairPay<br />
                    <span className="text-sm font-light">
                      (Tarif fixe {tarifTotalHT} € HT + TVA{hasAbonnement ? " + abonnement" : ""})
                    </span>
                  </th>
                  <th className="border-2 border-[#0F172A] p-6 text-center font-bold text-lg">
                    Économie avec FairPay
                  </th>
                </tr>
              </thead>
              <tbody>
                {[2000, 5000, 10000, 15000, 20000].map((montantExemple) => {
                  const commissionHT = montantExemple * 0.1;
                  const tarifConcurrentsIHPHT = hasIHP ? 199 : 0;
                  const tarifConcurrentsRequeteHT = hasCJ ? 199 : 0;
                  const totalConcurrentsHT =
                    commissionHT + tarifConcurrentsIHPHT + tarifConcurrentsRequeteHT;
                  const totalConcurrentsTTC = totalConcurrentsHT * 1.2;
                  const recuConcurrents = montantExemple - totalConcurrentsTTC;

                  // Correction : ne rembourser que les frais IHP/CJ, pas la totalité
                  const remboursementArticle700 =
                    hasIHP || hasCJ
                      ? (hasIHP ? tarifIHPHT : 0) + (hasCJ ? tarifCJHT : 0)
                      : 0;
                  const recuFairPay = montantExemple - tarifTotalTTC + remboursementArticle700;
                  const economieExemple = recuFairPay - recuConcurrents;

                  return (
                    <tr key={montantExemple}>
                      <td className="border-2 border-[#0F172A] p-6 font-medium text-lg text-[#0F172A]">
                        {montantExemple.toLocaleString("fr-FR")} €
                      </td>
                      <td className="border-2 border-[#0F172A] p-6 text-center bg-[#2563EB]/10">
                        <div className="font-bold text-[#2563EB]">
                          - {totalConcurrentsTTC.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} € TTC
                        </div>
                        <div className="text-xs text-[#0F172A]/60 mt-1">
                          ({totalConcurrentsHT.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} € HT + TVA)
                        </div>
                        <div className="text-sm text-[#0F172A]/70 mt-1">
                          Vous recevez : {recuConcurrents.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
                        </div>
                      </td>
                      <td className="border-2 border-[#0F172A] p-6 text-center bg-[#16A34A]/10">
                        <div className="font-bold text-[#16A34A]">
                          - {tarifTotalTTC.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} € TTC
                        </div>
                        <div className="text-xs text-[#0F172A]/60 mt-1">
                          ({tarifTotalHT.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} € HT + TVA)
                        </div>
                        {(hasIHP || hasCJ) && (
                          <div className="text-xs text-[#16A34A] mt-1 font-medium">
                            + {remboursementArticle700.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} € (art. 700)
                          </div>
                        )}
                        <div className="text-sm text-[#0F172A]/70 mt-1">
                          Vous recevez : {recuFairPay.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
                        </div>
                      </td>
                      <td className="border-2 border-[#0F172A] p-6 text-center">
                        <span className={`font-bold ${economieExemple > 0 ? "text-[#16A34A]" : "text-[#2563EB]"}`}>
                          {economieExemple > 0 ? "+" : ""}
                          {economieExemple.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </ScrollAnimation>

        <ScrollAnimation animation="scaleIn" delay={500}>
          <div className="mt-12 p-8 rounded-lg bg-[#0F172A] text-white border-2 border-[#0F172A] hover:shadow-xl transition-all duration-300">
            <p className="text-center text-lg font-light leading-relaxed">
              <strong className="font-bold">Conclusion :</strong> Plus votre créance est importante, plus vous économisez avec FairPay.
              Avec un tarif fixe, vous gardez une part maximale de votre argent, contrairement aux concurrents qui prennent 10%
              quel que soit le montant.
            </p>
          </div>
        </ScrollAnimation>
      </div>
    </section>
  );
}

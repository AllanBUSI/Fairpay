"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calculator, Percent } from "lucide-react";

export default function SimulationPage() {
  const [prix, setPrix] = useState<string>("");
  const [pourcentage, setPourcentage] = useState<number | null>(null);
  const [montantCommission, setMontantCommission] = useState<number | null>(null);

  const calculerPourcentage = () => {
    const prixNum = parseFloat(prix.replace(",", "."));
    
    if (isNaN(prixNum) || prixNum <= 0) {
      setPourcentage(null);
      setMontantCommission(null);
      return;
    }

    // Simulation : calculer un pourcentage de commission basé sur le prix
    // Par exemple : 10% pour les montants < 1000€, 8% pour 1000-5000€, 6% pour > 5000€
    let tauxCommission = 0;
    
    if (prixNum < 1000) {
      tauxCommission = 10;
    } else if (prixNum >= 1000 && prixNum < 5000) {
      tauxCommission = 8;
    } else {
      tauxCommission = 6;
    }

    const commission = (prixNum * tauxCommission) / 100;
    
    setPourcentage(tauxCommission);
    setMontantCommission(commission);
  };

  const handleReset = () => {
    setPrix("");
    setPourcentage(null);
    setMontantCommission(null);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="border-b p-6">
          <div className="flex items-center gap-2 mb-2">
            <Calculator className="h-6 w-6" />
            <h1 className="text-2xl font-semibold">Simulation de prix</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Entrez un montant pour calculer le pourcentage de commission et le montant correspondant
          </p>
        </div>
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="prix">Montant (€)</Label>
            <Input
              id="prix"
              type="text"
              placeholder="Ex: 1500.00"
              value={prix}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9,.]/g, "");
                setPrix(value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  calculerPourcentage();
                }
              }}
            />
            <p className="text-sm text-muted-foreground">
              Utilisez un point ou une virgule pour les décimales
            </p>
          </div>

          <div className="flex gap-2">
            <Button onClick={calculerPourcentage} className="flex-1">
              <Calculator className="mr-2 h-4 w-4" />
              Calculer
            </Button>
            <Button onClick={handleReset} variant="outline">
              Réinitialiser
            </Button>
          </div>

          {pourcentage !== null && montantCommission !== null && (
            <div className="mt-6 p-6 bg-muted rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Montant saisi :</span>
                <span className="text-lg font-semibold">{parseFloat(prix.replace(",", ".")).toFixed(2)} €</span>
              </div>
              
              <div className="flex items-center justify-between border-t pt-4">
                <div className="flex items-center gap-2">
                  <Percent className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">Pourcentage de commission :</span>
                </div>
                <span className="text-2xl font-bold text-primary">{pourcentage}%</span>
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <span className="text-sm font-medium">Montant de la commission :</span>
                <span className="text-xl font-bold">{montantCommission.toFixed(2)} €</span>
              </div>

              <div className="flex items-center justify-between border-t pt-4">
                <span className="text-sm font-medium">Montant net :</span>
                <span className="text-xl font-semibold">
                  {(parseFloat(prix.replace(",", ".")) - montantCommission).toFixed(2)} €
                </span>
              </div>
            </div>
          )}

          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>Barème de commission :</strong>
            </p>
            <ul className="text-sm text-blue-800 dark:text-blue-200 mt-2 space-y-1 list-disc list-inside">
              <li>Montants inférieurs à 1 000 € : 10%</li>
              <li>Montants entre 1 000 € et 5 000 € : 8%</li>
              <li>Montants supérieurs à 5 000 € : 6%</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}


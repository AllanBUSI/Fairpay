"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { LogoIcon } from "./logo-icon";
import { Calculator, Scale, DollarSign } from "lucide-react";

export function LandingNavigation() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className="fixed top-4 left-4 right-4 z-50 transition-all duration-300">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-lg border border-[#E5E7EB] px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="transition-transform group-hover:scale-110 group-hover:rotate-3 duration-300">
                <LogoIcon size={40} />
              </div>
              <span className="text-xl font-bold text-[#0F172A]">FairPay</span>
            </Link>
            
            {/* Navigation Links avec icônes */}
            <div className="hidden lg:flex items-center gap-8">
              <Link 
                href="/simulateur" 
                className="flex items-center gap-2 text-[#0F172A] hover:text-[#2563EB] transition-colors font-medium group"
              >
                <Calculator className="h-5 w-5 group-hover:scale-110 transition-transform" />
                <span>Simulateur</span>
              </Link>
              <Link 
                href="#processus" 
                className="flex items-center gap-2 text-[#0F172A] hover:text-[#2563EB] transition-colors font-medium group"
              >
                <Scale className="h-5 w-5 group-hover:scale-110 transition-transform" />
                <span>Comment ça marche</span>
              </Link>
              <Link 
                href="#pricing" 
                className="flex items-center gap-2 text-[#0F172A] hover:text-[#2563EB] transition-colors font-medium group"
              >
                <DollarSign className="h-5 w-5 group-hover:scale-110 transition-transform" />
                <span>Tarifs</span>
              </Link>
            </div>
            
            {/* Boutons à droite */}
            <div className="flex items-center gap-3">
              <Link href="/login">
                <Button 
                  variant="ghost"
                  size="lg" 
                  className="text-[#0F172A] hover:text-[#2563EB] hover:bg-transparent rounded-full px-6 py-2.5 font-semibold transition-all"
                >
                  Connexion
                </Button>
              </Link>
              <Link href="/login">
                <Button 
                  size="lg" 
                  className="bg-[#0F172A] text-white hover:bg-[#0F172A]/90 rounded-full px-6 py-2.5 font-semibold transition-all hover:scale-105 shadow-md"
                >
                  Inscription
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

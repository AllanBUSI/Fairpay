"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { LogoIcon } from "./logo-icon";
import { Calculator, Scale, DollarSign, Menu, X } from "lucide-react";

export function LandingNavigation() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    // Fermer le menu mobile quand on scroll
    if (!mobileMenuOpen) return;
    
    const handleScroll = () => setMobileMenuOpen(false);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [mobileMenuOpen]);

  return (
    <nav className="fixed top-2 left-2 right-2 lg:top-4 lg:left-4 lg:right-4 z-50 transition-all duration-300">
      <div className="container mx-auto px-2 sm:px-4 lg:px-8">
        <div className="bg-white rounded-xl lg:rounded-2xl shadow-lg border border-[#E5E7EB] px-4 py-3 lg:px-6 lg:py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 lg:gap-3 group">
              <div className="transition-transform group-hover:scale-110 group-hover:rotate-3 duration-300">
                <LogoIcon size={32} className="lg:w-10 lg:h-10" />
              </div>
              <span className="text-lg lg:text-xl font-bold text-[#0F172A]">FairPay</span>
            </Link>
            
            {/* Navigation Links avec icônes - Desktop */}
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
            
            {/* Boutons à droite - Desktop */}
            <div className="hidden lg:flex items-center gap-3">
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

            {/* Bouton menu mobile */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>

          {/* Menu mobile */}
          {mobileMenuOpen && (
            <div className="lg:hidden mt-4 pt-4 border-t border-[#E5E7EB]">
              <div className="flex flex-col gap-3">
                <Link 
                  href="/simulateur" 
                  className="flex items-center gap-2 text-[#0F172A] hover:text-[#2563EB] transition-colors font-medium py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Calculator className="h-5 w-5" />
                  <span>Simulateur</span>
                </Link>
                <Link 
                  href="#processus" 
                  className="flex items-center gap-2 text-[#0F172A] hover:text-[#2563EB] transition-colors font-medium py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Scale className="h-5 w-5" />
                  <span>Comment ça marche</span>
                </Link>
                <Link 
                  href="#pricing" 
                  className="flex items-center gap-2 text-[#0F172A] hover:text-[#2563EB] transition-colors font-medium py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <DollarSign className="h-5 w-5" />
                  <span>Tarifs</span>
                </Link>
                <div className="flex flex-col gap-2 pt-2 border-t border-[#E5E7EB]">
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button 
                      variant="ghost"
                      className="w-full text-[#0F172A] hover:text-[#2563EB] hover:bg-transparent rounded-full py-2.5 font-semibold"
                    >
                      Connexion
                    </Button>
                  </Link>
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                    <Button 
                      className="w-full bg-[#0F172A] text-white hover:bg-[#0F172A]/90 rounded-full py-2.5 font-semibold shadow-md"
                    >
                      Inscription
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

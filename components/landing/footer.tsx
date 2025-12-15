"use client";

import Link from "next/link";
import { LogoIcon } from "./logo-icon";

export function LandingFooter() {
  return (
    <footer className="bg-[#0F172A] text-white py-16 px-4 sm:px-6 lg:px-8 border-t-2 border-white/10">
      <div className="container mx-auto max-w-7xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="transition-transform hover:scale-110 hover:rotate-3 duration-300">
                <LogoIcon size={40} />
              </div>
              <span className="text-xl font-bold text-white">FairPay</span>
            </div>
            <p className="text-white/70 text-sm leading-relaxed">
              Service de recouvrement de créances par un réseau d'avocats 
              inscrits aux barreaux de Paris.
            </p>
          </div>
          
          <div>
            <h3 className="text-white font-bold mb-6 text-lg">Service</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="#processus" className="text-white/70 hover:text-[#16A34A] transition-colors">
                  Comment ça marche
                </Link>
              </li>
              <li>
                <Link href="#pricing" className="text-white/70 hover:text-[#16A34A] transition-colors">
                  Nos offres
                </Link>
              </li>
              <li>
                <Link href="#faq" className="text-white/70 hover:text-[#16A34A] transition-colors">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-white font-bold mb-6 text-lg">Légal</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/mentions-legales" className="text-white/70 hover:text-[#16A34A] transition-colors">
                  Mentions légales
                </Link>
              </li>
              <li>
                <Link href="/confidentialite" className="text-white/70 hover:text-[#16A34A] transition-colors">
                  Politique de confidentialité
                </Link>
              </li>
              <li>
                <Link href="/cgu" className="text-white/70 hover:text-[#16A34A] transition-colors">
                  CGU
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-white font-bold mb-6 text-lg">Contact</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <a href="mailto:contact@fairpay.fr" className="text-white/70 hover:text-[#16A34A] transition-colors">
                  contact@fairpay.fr
                </a>
              </li>
              <li>
                <a href="tel:+33123456789" className="text-white/70 hover:text-[#16A34A] transition-colors">
                  +33 1 23 45 67 89
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-white/10 pt-8 text-center">
          <p className="text-white/50 text-sm">
            © {new Date().getFullYear()} FairPay. Tous droits réservés. 
            Service de recouvrement de créances par avocats.
          </p>
        </div>
      </div>
    </footer>
  );
}

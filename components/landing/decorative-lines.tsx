"use client";

import { useEffect, useRef } from "react";

interface DecorativeLinesProps {
  className?: string;
  variant?: "top" | "bottom" | "left" | "right" | "diagonal";
}

export function DecorativeLines({ className = "", variant = "diagonal" }: DecorativeLinesProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current) {
      const paths = svgRef.current.querySelectorAll("path");
      paths.forEach((path, index) => {
        const pathElement = path as SVGPathElement;
        const length = pathElement.getTotalLength();
        pathElement.style.strokeDasharray = `${length}`;
        pathElement.style.strokeDashoffset = `${length}`;
        pathElement.style.animation = `drawLine 1.5s ease-out ${index * 0.2}s forwards`;
      });
    }
  }, []);

  const variants = {
    diagonal: (
      <svg
        ref={svgRef}
        className={`absolute inset-0 w-full h-full ${className}`}
        viewBox="0 0 1200 800"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        {/* Lignes asymétriques avec courbes variées */}
        <path
          d="M-50 120 Q250 80 450 180 Q650 280 850 200 Q1050 120 1250 220"
          stroke="url(#gradient1)"
          strokeWidth="2.5"
          opacity="0.4"
          className="animate-pulse"
        />
        <path
          d="M100 350 Q350 300 550 400 Q750 500 950 420 Q1150 340 1300 440"
          stroke="url(#gradient2)"
          strokeWidth="2"
          opacity="0.3"
          className="animate-pulse"
          style={{ animationDelay: "0.2s" }}
        />
        <path
          d="M-30 580 Q200 520 500 620 Q800 720 1000 640 Q1200 560 1350 660"
          stroke="url(#gradient3)"
          strokeWidth="1.8"
          opacity="0.25"
          className="animate-pulse"
          style={{ animationDelay: "0.4s" }}
        />
        {/* Lignes verticales asymétriques */}
        <path
          d="M150 0 Q180 200 200 400 Q220 600 250 800"
          stroke="url(#gradient4)"
          strokeWidth="1.5"
          opacity="0.2"
          className="animate-pulse"
          style={{ animationDelay: "0.6s" }}
        />
        <path
          d="M950 -50 Q980 150 1000 350 Q1020 550 1050 750"
          stroke="url(#gradient5)"
          strokeWidth="1.5"
          opacity="0.2"
          className="animate-pulse"
          style={{ animationDelay: "0.8s" }}
        />
        {/* Lignes diagonales croisées */}
        <path
          d="M0 0 Q400 200 800 100 Q1200 0 1400 200"
          stroke="url(#gradient6)"
          strokeWidth="1.2"
          opacity="0.15"
          className="animate-pulse"
          style={{ animationDelay: "1s" }}
        />
        <path
          d="M0 800 Q400 600 800 700 Q1200 800 1400 600"
          stroke="url(#gradient7)"
          strokeWidth="1.2"
          opacity="0.15"
          className="animate-pulse"
          style={{ animationDelay: "1.2s" }}
        />
        {/* Lignes horizontales supplémentaires */}
        <path
          d="M0 100 L1200 100"
          stroke="url(#gradientHorizontal1)"
          strokeWidth="1"
          opacity="0.2"
          className="animate-pulse"
          style={{ animationDelay: "1.4s" }}
        />
        <path
          d="M0 250 L1200 250"
          stroke="url(#gradientHorizontal2)"
          strokeWidth="1"
          opacity="0.15"
          className="animate-pulse"
          style={{ animationDelay: "1.6s" }}
        />
        <path
          d="M0 450 L1200 450"
          stroke="url(#gradientHorizontal3)"
          strokeWidth="1"
          opacity="0.2"
          className="animate-pulse"
          style={{ animationDelay: "1.8s" }}
        />
        <path
          d="M0 600 L1200 600"
          stroke="url(#gradientHorizontal4)"
          strokeWidth="1"
          opacity="0.15"
          className="animate-pulse"
          style={{ animationDelay: "2s" }}
        />
        <path
          d="M0 750 L1200 750"
          stroke="url(#gradientHorizontal5)"
          strokeWidth="1"
          opacity="0.18"
          className="animate-pulse"
          style={{ animationDelay: "2.2s" }}
        />
        {/* Lignes verticales supplémentaires */}
        <path
          d="M200 0 L200 800"
          stroke="url(#gradientVertical1)"
          strokeWidth="1"
          opacity="0.2"
          className="animate-pulse"
          style={{ animationDelay: "2.4s" }}
        />
        <path
          d="M400 0 L400 800"
          stroke="url(#gradientVertical2)"
          strokeWidth="1"
          opacity="0.15"
          className="animate-pulse"
          style={{ animationDelay: "2.6s" }}
        />
        <path
          d="M600 0 L600 800"
          stroke="url(#gradientVertical3)"
          strokeWidth="1"
          opacity="0.2"
          className="animate-pulse"
          style={{ animationDelay: "2.8s" }}
        />
        <path
          d="M800 0 L800 800"
          stroke="url(#gradientVertical4)"
          strokeWidth="1"
          opacity="0.15"
          className="animate-pulse"
          style={{ animationDelay: "3s" }}
        />
        <path
          d="M1000 0 L1000 800"
          stroke="url(#gradientVertical5)"
          strokeWidth="1"
          opacity="0.18"
          className="animate-pulse"
          style={{ animationDelay: "3.2s" }}
        />
        {/* Lignes verticales courbes supplémentaires */}
        <path
          d="M300 0 Q320 200 300 400 Q280 600 300 800"
          stroke="url(#gradientVerticalCurve1)"
          strokeWidth="1.2"
          opacity="0.15"
          className="animate-pulse"
          style={{ animationDelay: "3.4s" }}
        />
        <path
          d="M700 0 Q680 200 700 400 Q720 600 700 800"
          stroke="url(#gradientVerticalCurve2)"
          strokeWidth="1.2"
          opacity="0.15"
          className="animate-pulse"
          style={{ animationDelay: "3.6s" }}
        />
        <path
          d="M1100 0 Q1080 200 1100 400 Q1120 600 1100 800"
          stroke="url(#gradientVerticalCurve3)"
          strokeWidth="1.2"
          opacity="0.15"
          className="animate-pulse"
          style={{ animationDelay: "3.8s" }}
        />
        <defs>
          <linearGradient id="gradient1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0" />
            <stop offset="30%" stopColor="#2563EB" stopOpacity="0.6" />
            <stop offset="70%" stopColor="#16A34A" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradient2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#16A34A" stopOpacity="0" />
            <stop offset="40%" stopColor="#16A34A" stopOpacity="0.5" />
            <stop offset="60%" stopColor="#2563EB" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#16A34A" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradient3" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0F172A" stopOpacity="0" />
            <stop offset="50%" stopColor="#0F172A" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0F172A" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradient4" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0" />
            <stop offset="50%" stopColor="#2563EB" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradient5" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#16A34A" stopOpacity="0" />
            <stop offset="50%" stopColor="#16A34A" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#16A34A" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradient6" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#16A34A" stopOpacity="0" />
            <stop offset="50%" stopColor="#16A34A" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#16A34A" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradient7" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0" />
            <stop offset="50%" stopColor="#2563EB" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
          </linearGradient>
          {/* Gradients pour lignes horizontales */}
          <linearGradient id="gradientHorizontal1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0" />
            <stop offset="50%" stopColor="#2563EB" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradientHorizontal2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#16A34A" stopOpacity="0" />
            <stop offset="50%" stopColor="#16A34A" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#16A34A" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradientHorizontal3" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0" />
            <stop offset="50%" stopColor="#2563EB" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradientHorizontal4" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#16A34A" stopOpacity="0" />
            <stop offset="50%" stopColor="#16A34A" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#16A34A" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradientHorizontal5" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0F172A" stopOpacity="0" />
            <stop offset="50%" stopColor="#0F172A" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0F172A" stopOpacity="0" />
          </linearGradient>
          {/* Gradients pour lignes verticales */}
          <linearGradient id="gradientVertical1" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0" />
            <stop offset="50%" stopColor="#2563EB" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradientVertical2" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#16A34A" stopOpacity="0" />
            <stop offset="50%" stopColor="#16A34A" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#16A34A" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradientVertical3" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0" />
            <stop offset="50%" stopColor="#2563EB" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradientVertical4" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#16A34A" stopOpacity="0" />
            <stop offset="50%" stopColor="#16A34A" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#16A34A" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradientVertical5" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0F172A" stopOpacity="0" />
            <stop offset="50%" stopColor="#0F172A" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0F172A" stopOpacity="0" />
          </linearGradient>
          {/* Gradients pour lignes verticales courbes */}
          <linearGradient id="gradientVerticalCurve1" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0" />
            <stop offset="50%" stopColor="#2563EB" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradientVerticalCurve2" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#16A34A" stopOpacity="0" />
            <stop offset="50%" stopColor="#16A34A" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#16A34A" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradientVerticalCurve3" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0F172A" stopOpacity="0" />
            <stop offset="50%" stopColor="#0F172A" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#0F172A" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    ),
    top: (
      <svg
        ref={svgRef}
        className={`absolute inset-0 w-full h-full ${className}`}
        viewBox="0 0 1200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <path
          d="M-50 50 Q200 10 450 60 Q700 110 950 40 Q1200 -30 1350 70"
          stroke="url(#gradientTop1)"
          strokeWidth="2.5"
          opacity="0.4"
        />
        <path
          d="M100 0 Q350 25 600 5 Q850 -15 1100 50"
          stroke="url(#gradientTop2)"
          strokeWidth="2"
          opacity="0.3"
          style={{ animationDelay: "0.2s" }}
        />
        <path
          d="M-30 100 Q250 80 550 120 Q850 160 1150 100"
          stroke="url(#gradientTop3)"
          strokeWidth="1.5"
          opacity="0.25"
          style={{ animationDelay: "0.4s" }}
        />
        {/* Lignes horizontales supplémentaires */}
        <path
          d="M0 50 L1200 50"
          stroke="url(#gradientTopHorizontal1)"
          strokeWidth="1"
          opacity="0.2"
          style={{ animationDelay: "0.6s" }}
        />
        <path
          d="M0 100 L1200 100"
          stroke="url(#gradientTopHorizontal2)"
          strokeWidth="1"
          opacity="0.15"
          style={{ animationDelay: "0.8s" }}
        />
        <path
          d="M0 150 L1200 150"
          stroke="url(#gradientTopHorizontal3)"
          strokeWidth="1"
          opacity="0.18"
          style={{ animationDelay: "1s" }}
        />
        {/* Lignes verticales supplémentaires */}
        <path
          d="M300 0 L300 200"
          stroke="url(#gradientTopVertical1)"
          strokeWidth="1"
          opacity="0.2"
          style={{ animationDelay: "1.2s" }}
        />
        <path
          d="M600 0 L600 200"
          stroke="url(#gradientTopVertical2)"
          strokeWidth="1"
          opacity="0.15"
          style={{ animationDelay: "1.4s" }}
        />
        <path
          d="M900 0 L900 200"
          stroke="url(#gradientTopVertical3)"
          strokeWidth="1"
          opacity="0.18"
          style={{ animationDelay: "1.6s" }}
        />
        <defs>
          <linearGradient id="gradientTop1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0" />
            <stop offset="40%" stopColor="#2563EB" stopOpacity="0.6" />
            <stop offset="60%" stopColor="#16A34A" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradientTop2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#16A34A" stopOpacity="0" />
            <stop offset="50%" stopColor="#16A34A" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#16A34A" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradientTop3" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0F172A" stopOpacity="0" />
            <stop offset="50%" stopColor="#0F172A" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0F172A" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradientTopHorizontal1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0" />
            <stop offset="50%" stopColor="#2563EB" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradientTopHorizontal2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#16A34A" stopOpacity="0" />
            <stop offset="50%" stopColor="#16A34A" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#16A34A" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradientTopHorizontal3" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0F172A" stopOpacity="0" />
            <stop offset="50%" stopColor="#0F172A" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0F172A" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradientTopVertical1" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0" />
            <stop offset="50%" stopColor="#2563EB" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradientTopVertical2" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#16A34A" stopOpacity="0" />
            <stop offset="50%" stopColor="#16A34A" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#16A34A" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradientTopVertical3" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0F172A" stopOpacity="0" />
            <stop offset="50%" stopColor="#0F172A" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0F172A" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    ),
    bottom: (
      <svg
        ref={svgRef}
        className={`absolute inset-0 w-full h-full ${className}`}
        viewBox="0 0 1200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <path
          d="M-50 150 Q250 110 550 160 Q850 210 1150 130"
          stroke="url(#gradientBottom1)"
          strokeWidth="2.5"
          opacity="0.4"
        />
        <path
          d="M200 200 Q500 160 800 190 Q1100 220 1400 150"
          stroke="url(#gradientBottom2)"
          strokeWidth="2"
          opacity="0.3"
          style={{ animationDelay: "0.3s" }}
        />
        <path
          d="M-30 100 Q300 130 600 170 Q900 210 1200 100"
          stroke="url(#gradientBottom3)"
          strokeWidth="1.5"
          opacity="0.25"
          style={{ animationDelay: "0.5s" }}
        />
        {/* Lignes horizontales supplémentaires */}
        <path
          d="M0 50 L1200 50"
          stroke="url(#gradientBottomHorizontal1)"
          strokeWidth="1"
          opacity="0.2"
          style={{ animationDelay: "0.7s" }}
        />
        <path
          d="M0 100 L1200 100"
          stroke="url(#gradientBottomHorizontal2)"
          strokeWidth="1"
          opacity="0.15"
          style={{ animationDelay: "0.9s" }}
        />
        <path
          d="M0 150 L1200 150"
          stroke="url(#gradientBottomHorizontal3)"
          strokeWidth="1"
          opacity="0.18"
          style={{ animationDelay: "1.1s" }}
        />
        {/* Lignes verticales supplémentaires */}
        <path
          d="M300 0 L300 200"
          stroke="url(#gradientBottomVertical1)"
          strokeWidth="1"
          opacity="0.2"
          style={{ animationDelay: "1.3s" }}
        />
        <path
          d="M600 0 L600 200"
          stroke="url(#gradientBottomVertical2)"
          strokeWidth="1"
          opacity="0.15"
          style={{ animationDelay: "1.5s" }}
        />
        <path
          d="M900 0 L900 200"
          stroke="url(#gradientBottomVertical3)"
          strokeWidth="1"
          opacity="0.18"
          style={{ animationDelay: "1.7s" }}
        />
        <defs>
          <linearGradient id="gradientBottom1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#16A34A" stopOpacity="0" />
            <stop offset="40%" stopColor="#16A34A" stopOpacity="0.6" />
            <stop offset="60%" stopColor="#2563EB" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#16A34A" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradientBottom2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0" />
            <stop offset="50%" stopColor="#2563EB" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradientBottom3" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0F172A" stopOpacity="0" />
            <stop offset="50%" stopColor="#0F172A" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#0F172A" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradientBottomHorizontal1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#16A34A" stopOpacity="0" />
            <stop offset="50%" stopColor="#16A34A" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#16A34A" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradientBottomHorizontal2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0" />
            <stop offset="50%" stopColor="#2563EB" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradientBottomHorizontal3" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0F172A" stopOpacity="0" />
            <stop offset="50%" stopColor="#0F172A" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0F172A" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradientBottomVertical1" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#16A34A" stopOpacity="0" />
            <stop offset="50%" stopColor="#16A34A" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#16A34A" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradientBottomVertical2" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0" />
            <stop offset="50%" stopColor="#2563EB" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gradientBottomVertical3" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#0F172A" stopOpacity="0" />
            <stop offset="50%" stopColor="#0F172A" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0F172A" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    ),
  };

  return (
    <>
      <style jsx>{`
        @keyframes drawLine {
          to {
            stroke-dashoffset: 0;
          }
        }
        `}
      </style>
      {variants[variant as keyof typeof variants]}
    </>
  );
}


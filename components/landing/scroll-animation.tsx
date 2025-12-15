"use client";

import { useEffect, useRef, useState } from "react";

interface ScrollAnimationProps {
  children: React.ReactNode;
  className?: string;
  animation?: "fadeInUp" | "fadeInDown" | "fadeInLeft" | "fadeInRight" | "scaleIn";
  delay?: number;
}

export function ScrollAnimation({
  children,
  className = "",
  animation = "fadeInUp",
  delay = 0,
}: ScrollAnimationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            setIsVisible(true);
          }, delay);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [delay]);

  const animationClasses = {
    fadeInUp: isVisible ? "animate-fade-in-up" : "opacity-0 translate-y-8",
    fadeInDown: isVisible ? "animate-fade-in-down" : "opacity-0 -translate-y-8",
    fadeInLeft: isVisible ? "animate-fade-in-left" : "opacity-0 -translate-x-8",
    fadeInRight: isVisible ? "animate-fade-in-right" : "opacity-0 translate-x-8",
    scaleIn: isVisible ? "animate-scale-in" : "opacity-0 scale-95",
  };

  return (
    <div
      ref={ref}
      className={`transition-all duration-800 ${animationClasses[animation]} ${className}`}
    >
      {children}
    </div>
  );
}


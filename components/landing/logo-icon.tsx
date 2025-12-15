"use client";

interface LogoIconProps {
  className?: string;
  size?: number;
}

export function LogoIcon({ className = "", size = 40 }: LogoIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Fond arrondi avec effet 3D */}
      <rect
        x="5"
        y="5"
        width="90"
        height="90"
        rx="20"
        fill="#16A34A"
        className="drop-shadow-lg"
      />
      {/* Ombre pour effet 3D */}
      <rect
        x="5"
        y="5"
        width="90"
        height="90"
        rx="20"
        fill="url(#gradientShadow)"
        opacity="0.3"
      />
      {/* Lettre E avec checkmark intégré */}
      <path
        d="M 30 25 L 30 75 M 30 25 L 65 25 M 30 50 L 60 50 M 30 75 L 50 75 L 70 55"
        stroke="white"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Checkmark */}
      <path
        d="M 50 75 L 70 55 L 75 60"
        stroke="white"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <defs>
        <linearGradient id="gradientShadow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}


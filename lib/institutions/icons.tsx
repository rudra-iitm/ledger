import { type SVGProps } from "react";

export function InstitutionLogoSvg({ id, ...props }: { id: string } & SVGProps<SVGSVGElement>) {
  switch (id) {
    case "hdfc":
      return (
        <svg viewBox="1 1 48 48" fill="none" {...props}>
          <path d="m1.07 1.08h47.853v47.853h-47.853z" fill="#ed232a"/>
          <g fill="#fff">
            <path d="m9.445 9.455h31.108v31.108h-31.108z"/>
            <path d="m22.604 1.08h4.784v47.853h-4.784z"/>
            <path d="m1.07 22.62h47.853v4.784h-47.853z"/>
          </g>
          <path d="m17.821 17.83h14.356v14.357h-14.356z" fill="#004c8f"/>
        </svg>
      );
    case "sbi":
      return (
        <svg viewBox="0 0 192.756 192.756" fill="none" {...props}>
          <path fill="#00b0f0" d="M0 0h192.756v192.756H0V0z"/>
          <path d="M75.872 96.378c0-18.603-15.08-33.684-33.684-33.684S8.504 77.775 8.504 96.378c0 17.899 13.812 32.556 31.429 33.685v-26.074c-3.242-.986-5.638-3.945-5.638-7.61 0-4.228 3.523-7.751 7.893-7.751s7.893 3.523 7.893 7.751c0 3.665-2.396 6.624-5.779 7.61v26.074c17.617-1.129 31.57-15.786 31.57-33.685z" fill="#ffffff" />
        </svg>
      );
    case "visa":
      return (
        <svg viewBox="0 0 100 100" fill="none" {...props}>
          <rect width="100" height="100" fill="#FFFFFF" />
          <text x="50" y="65" fontSize="40" fontWeight="900" fontStyle="italic" fontFamily="sans-serif" fill="#1A1F71" textAnchor="middle">VISA</text>
        </svg>
      );
    case "mastercard":
      return (
        <svg viewBox="0 0 100 100" fill="none" {...props}>
          <rect width="100" height="100" fill="#141414" />
          <circle cx="35" cy="50" r="25" fill="#EB001B" />
          <circle cx="65" cy="50" r="25" fill="#F79E1B" />
          <path d="M50 29.5A24.9 24.9 0 0 1 50 70.5 24.9 24.9 0 0 1 50 29.5z" fill="#FF5F00" />
        </svg>
      );
    default:
      return null;
  }
}

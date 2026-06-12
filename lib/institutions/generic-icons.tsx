import { type SVGProps } from "react";
import type { AccountType } from "@/lib/domain/types";

export function GenericAccountSvg({ type, ...props }: { type: AccountType } & SVGProps<SVGSVGElement>) {
  switch (type) {
    case "cash":
      return (
        <svg viewBox="0 0 100 100" fill="none" {...props}>
          <rect width="100" height="100" fill="#052e16" />
          <rect x="15" y="25" width="70" height="50" rx="8" fill="#10B981" />
          <rect x="25" y="35" width="50" height="30" rx="4" fill="#047857" />
          <circle cx="50" cy="50" r="10" fill="#A7F3D0" />
          <path d="M 50 45 L 50 55" stroke="#064E3B" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "credit_card":
    case "debit_card":
      return (
        <svg viewBox="0 0 100 100" fill="none" {...props}>
          <rect width="100" height="100" fill="#2e1065" />
          <rect x="15" y="30" width="70" height="45" rx="6" fill="#8B5CF6" />
          <rect x="15" y="40" width="70" height="10" fill="#4C1D95" />
          <rect x="25" y="60" width="15" height="5" rx="2" fill="#DDD6FE" />
          <rect x="45" y="60" width="20" height="5" rx="2" fill="#DDD6FE" />
        </svg>
      );
    case "wallet":
      return (
        <svg viewBox="0 0 100 100" fill="none" {...props}>
          <rect width="100" height="100" fill="#4c0519" />
          <rect x="20" y="30" width="60" height="45" rx="6" fill="#EC4899" />
          <path d="M 80 45 L 65 45 C 60 45 60 55 65 55 L 80 55 Z" fill="#9D174D" />
          <circle cx="70" cy="50" r="3" fill="#FBCFE8" />
        </svg>
      );
    case "investment":
      return (
        <svg viewBox="0 0 100 100" fill="none" {...props}>
          <rect width="100" height="100" fill="#431407" />
          <rect x="25" y="60" width="12" height="20" rx="2" fill="#EA580C" />
          <rect x="44" y="45" width="12" height="35" rx="2" fill="#F97316" />
          <rect x="63" y="25" width="12" height="55" rx="2" fill="#FDBA74" />
        </svg>
      );
    case "bank":
    case "other":
    default:
      return (
        <svg viewBox="0 0 100 100" fill="none" {...props}>
          <rect width="100" height="100" fill="#0f172a" />
          <path d="M 20 40 L 50 20 L 80 40 Z" fill="#3B82F6" />
          <rect x="25" y="45" width="10" height="30" fill="#2563EB" />
          <rect x="45" y="45" width="10" height="30" fill="#2563EB" />
          <rect x="65" y="45" width="10" height="30" fill="#2563EB" />
          <rect x="20" y="80" width="60" height="5" rx="2" fill="#1D4ED8" />
        </svg>
      );
  }
}

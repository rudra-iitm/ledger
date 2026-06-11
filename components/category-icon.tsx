import {
  Car,
  GraduationCap,
  HeartPulse,
  MoreHorizontal,
  Receipt,
  ShoppingBag,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import type { Category } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

const ICONS: Record<Category, LucideIcon> = {
  Food: UtensilsCrossed,
  Travel: Car,
  Shopping: ShoppingBag,
  Bills: Receipt,
  Health: HeartPulse,
  Education: GraduationCap,
  Other: MoreHorizontal,
};

export function CategoryIcon({
  category,
  className,
}: {
  category: Category;
  className?: string;
}) {
  const Icon = ICONS[category];
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground",
        className,
      )}
    >
      <Icon className="size-4" />
    </span>
  );
}

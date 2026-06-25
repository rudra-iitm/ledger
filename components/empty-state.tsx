import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-border px-6 py-14 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-secondary/60">
        <Icon aria-hidden className="size-6 text-muted-foreground" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-base font-medium">{title}</p>
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

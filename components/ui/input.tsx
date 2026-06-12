import * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-12 w-full min-w-0 rounded-xl border border-input bg-card px-4 py-2 text-base text-foreground placeholder:text-muted-foreground transition-[border-color,box-shadow,background-color] duration-200 outline-none focus-visible:border-ring/60 focus-visible:bg-accent/30 focus-visible:ring-4 focus-visible:ring-ring/15 disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };

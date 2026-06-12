import * as React from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-24 w-full resize-none rounded-xl border border-input bg-card px-4 py-3 text-base text-foreground placeholder:text-muted-foreground transition-[border-color,box-shadow,background-color] duration-200 outline-none focus-visible:border-ring/60 focus-visible:bg-accent/30 focus-visible:ring-4 focus-visible:ring-ring/15 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };

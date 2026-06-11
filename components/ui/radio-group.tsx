"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cn } from "@/lib/utils";

function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      className={cn("grid gap-2", className)}
      {...props}
    />
  );
}

function RadioGroupItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      className={cn(
        "flex items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 text-left text-[15px] outline-none transition-colors data-[state=checked]:border-ring focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    >
      <span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-muted-foreground">
        <RadioGroupPrimitive.Indicator className="size-2 rounded-full bg-primary" />
      </span>
      {children}
    </RadioGroupPrimitive.Item>
  );
}

export { RadioGroup, RadioGroupItem };

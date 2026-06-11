"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { cn } from "@/lib/utils";

const Sheet = ({
  repositionInputs = false,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root repositionInputs={repositionInputs} {...props} />
);
const SheetTrigger = DrawerPrimitive.Trigger;
const SheetClose = DrawerPrimitive.Close;
const SheetPortal = DrawerPrimitive.Portal;

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Overlay>) {
  return (
    <DrawerPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn("fixed inset-0 z-50 bg-black/70", className)}
      {...props}
    />
  );
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const localRef = React.useRef<HTMLDivElement>(null);
  
  React.useImperativeHandle(ref, () => localRef.current as HTMLDivElement);

  React.useEffect(() => {
    if (!window.visualViewport) return;
    
    const onResize = () => {
      if (!localRef.current) return;
      const vv = window.visualViewport;
      
      // Calculate how far the visual viewport is offset from the bottom of the layout viewport.
      // This ensures the drawer sticks to the keyboard perfectly on iOS PWAs.
      const offsetBottom = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      localRef.current.style.bottom = `${offsetBottom}px`;
      
      // Force max-height to the visual viewport minus the top safe area
      // 47px is the standard iOS safe area top, we subtract it to prevent overlap
      localRef.current.style.maxHeight = `calc(${vv.height}px - env(safe-area-inset-top, 47px) - 1rem)`;
    };

    window.visualViewport.addEventListener("resize", onResize);
    window.visualViewport.addEventListener("scroll", onResize);
    onResize();

    return () => {
      window.visualViewport?.removeEventListener("resize", onResize);
      window.visualViewport?.removeEventListener("scroll", onResize);
    };
  }, []);

  return (
    <SheetPortal>
      <SheetOverlay />
      <DrawerPrimitive.Content
        ref={localRef}
        data-slot="sheet-content"
        className={cn(
          "fixed inset-x-0 z-50 mx-auto flex w-full max-w-lg flex-col rounded-t-3xl border border-border bg-popover outline-none",
          className,
        )}
        style={{ bottom: 0 }}
        {...props}
      >
        <div
          aria-hidden
          className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-muted"
        />
        <div className="overflow-y-auto px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
          {children}
        </div>
      </DrawerPrimitive.Content>
    </SheetPortal>
  );
});
SheetContent.displayName = "SheetContent";

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("mb-4 flex flex-col gap-1", className)}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Title>) {
  return (
    <DrawerPrimitive.Title
      data-slot="sheet-title"
      className={cn("text-lg font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
};

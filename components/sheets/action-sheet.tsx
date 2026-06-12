"use client";

import { useRouter } from "next/navigation";

import {
  CalendarClock,
  LayoutGrid,
  ReceiptText,
  RefreshCw,
  Target,
  Users,
  ArrowRightLeft,
  Handshake,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { QuickAddInput } from "@/components/quick-add-input";
import { useSheets } from "./sheet-context";

const ACTIONS = [
  {
    icon: ReceiptText,
    label: "Add expense",
    description: "Record a one-time expense",
    action: "expense",
  },
  {
    icon: ArrowRightLeft,
    label: "Transfer",
    description: "Move money between accounts",
    action: "transfer",
  },
  {
    icon: RefreshCw,
    label: "New subscription",
    description: "Netflix, Spotify, and more",
    action: "subscription",
  },
  {
    icon: LayoutGrid,
    label: "New space",
    description: "Group expenses by trip or project",
    action: "space",
  },
  {
    icon: CalendarClock,
    label: "Add recurring",
    description: "Rent, bills, instalments",
    action: "recurring",
  },
  {
    icon: Users,
    label: "New group",
    description: "Split bills with friends",
    action: "group",
  },
  {
    icon: Target,
    label: "Set budget",
    description: "Monthly spending limit",
    action: "budget",
  },
] as const;

export function ActionSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const sheets = useSheets();
  const router = useRouter();

  const handle = (action: (typeof ACTIONS)[number]["action"]) => {
    if (action === "expense") sheets.openExpense();
    if (action === "subscription") sheets.openSubscription();
    if (action === "space") sheets.openSpace();
    if (action === "recurring") sheets.openRecurring();
    if (action === "group") sheets.openGroup();
    if (action === "budget") sheets.openBudget();
    if (action === "transfer") sheets.openTransfer();
  };

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Quick add</SheetTitle>
        </SheetHeader>
        <QuickAddInput onAdded={onClose} />
        <nav aria-label="Actions" className="mt-2 flex flex-col gap-0.5">
          {ACTIONS.map(({ icon: Icon, label, description, action }) => (
            <button
              key={action}
              type="button"
              onClick={() => handle(action)}
              className="flex items-center gap-3.5 rounded-2xl px-3 py-3 text-left outline-none transition-colors duration-200 hover:bg-accent active:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                aria-hidden
                className="flex size-10 items-center justify-center rounded-xl border border-border bg-card"
              >
                <Icon className="size-[18px]" />
              </span>
              <span className="flex flex-col">
                <span className="text-[15px] font-medium">{label}</span>
                <span className="text-[13px] text-muted-foreground">
                  {description}
                </span>
              </span>
            </button>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

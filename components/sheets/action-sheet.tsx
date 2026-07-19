"use client";

import { useRouter } from "next/navigation";
import {
  CalendarClock,
  ClipboardPaste,
  ReceiptText,
  ArrowRightLeft,
  TrendingUp,
  LineChart,
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
    icon: TrendingUp,
    label: "Add income",
    description: "Salary, freelance, refunds, and more",
    action: "income",
  },
  {
    icon: ArrowRightLeft,
    label: "Transfer",
    description: "Move money between accounts",
    action: "transfer",
  },
  {
    icon: LineChart,
    label: "Add investment",
    description: "Gold, silver, SIPs & more",
    action: "investment",
  },
  {
    icon: CalendarClock,
    label: "Add recurring",
    description: "Rent, bills, instalments",
    action: "recurring",
  },
  {
    icon: ClipboardPaste,
    label: "Paste a payment SMS",
    description: "Parsed into your Inbox — no typing",
    action: "capture",
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
    if (action === "income") sheets.openIncome();
    if (action === "investment") sheets.openInvestment();
    if (action === "recurring") sheets.openRecurring();
    if (action === "transfer") sheets.openTransfer();
    if (action === "capture") {
      onClose();
      router.push("/capture");
    }
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

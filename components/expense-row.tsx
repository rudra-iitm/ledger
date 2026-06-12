"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarClock, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CategoryIcon } from "@/components/category-icon";
import type { Expense } from "@/lib/domain/types";
import { formatDisplayDate } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { useSheets } from "@/components/sheets/sheet-context";
import { useAppStore } from "@/lib/store/app-store";
import { cn } from "@/lib/utils";

const ACTIONS_WIDTH = 144;

let closeActiveRow: (() => void) | null = null;

export function ExpenseRow({ expense }: { expense: Expense }) {
  const sheets = useSheets();
  const currency = useAppStore((state) => state.data.settings.currency);
  const deleteExpense = useAppStore((state) => state.deleteExpense);

  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const offsetRef = useRef(0);
  const start = useRef<{ x: number; y: number; offset: number } | null>(null);
  const engaged = useRef(false);
  const swiped = useRef(false);

  const moveTo = useRef((next: number) => {
    offsetRef.current = next;
    setOffset(next);
  }).current;

  const close = useRef(() => {
    offsetRef.current = 0;
    setOffset(0);
  }).current;

  useEffect(() => {
    return () => {
      if (closeActiveRow === close) closeActiveRow = null;
    };
  }, [close]);

  const open = () => {
    if (closeActiveRow && closeActiveRow !== close) closeActiveRow();
    closeActiveRow = close;
    moveTo(-ACTIONS_WIDTH);
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    start.current = { x: event.clientX, y: event.clientY, offset: offsetRef.current };
    engaged.current = false;
    swiped.current = false;
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    if (!engaged.current) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        engaged.current = true;
        setDragging(true);
        if (event.nativeEvent.isTrusted) {
          event.currentTarget.setPointerCapture(event.pointerId);
        }
      } else if (Math.abs(dy) > 8) {
        start.current = null;
        return;
      } else {
        return;
      }
    }
    swiped.current = true;
    const raw = start.current.offset + dx;
    moveTo(
      raw < -ACTIONS_WIDTH
        ? -ACTIONS_WIDTH + (raw + ACTIONS_WIDTH) / 3
        : Math.min(0, raw),
    );
  };

  const settle = () => {
    if (!start.current) return;
    if (engaged.current) {
      if (offsetRef.current < -ACTIONS_WIDTH / 2) open();
      else {
        if (closeActiveRow === close) closeActiveRow = null;
        close();
      }
    }
    start.current = null;
    engaged.current = false;
    setDragging(false);
  };

  const onRowClick = () => {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    if (offsetRef.current !== 0) {
      close();
      return;
    }
    sheets.openExpense(expense);
  };

  const onEdit = () => {
    close();
    sheets.openExpense(expense);
  };

  const onDelete = () => {
    close();
    deleteExpense(expense.id);
    toast.success("Expense deleted");
  };

  return (
    <li className="relative overflow-hidden rounded-2xl">
      <div
        aria-hidden={offset === 0}
        className="absolute inset-y-0 right-0 flex"
        style={{ width: ACTIONS_WIDTH }}
      >
        <button
          type="button"
          aria-label={`Edit ${expense.description}`}
          tabIndex={offset === 0 ? -1 : 0}
          onClick={onEdit}
          className="flex flex-1 flex-col items-center justify-center gap-1 bg-accent text-[11px] font-medium text-foreground outline-none transition-colors active:bg-accent/80 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Pencil aria-hidden className="size-4.5" />
          Edit
        </button>
        <button
          type="button"
          aria-label={`Delete ${expense.description}`}
          tabIndex={offset === 0 ? -1 : 0}
          onClick={onDelete}
          className="flex flex-1 flex-col items-center justify-center gap-1 bg-destructive text-[11px] font-medium text-destructive-foreground outline-none transition-colors active:bg-destructive/85 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Trash2 aria-hidden className="size-4.5" />
          Delete
        </button>
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={settle}
        onPointerCancel={settle}
        className={cn(
          "relative touch-pan-y bg-background",
          dragging
            ? "transition-none"
            : "transition-transform duration-300 ease-spring",
        )}
        style={{ transform: `translateX(${offset}px)` }}
      >
        <button
          type="button"
          onClick={onRowClick}
          className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left outline-none transition-colors duration-200 hover:bg-accent/50 active:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CategoryIcon category={expense.category} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex items-center gap-1.5 truncate text-[15px] font-medium">
              {expense.description}
              {expense.recurringId && (
                <CalendarClock
                  aria-label="Recurring"
                  className="size-3.5 shrink-0 text-muted-foreground"
                />
              )}
            </span>
            <span className="text-[13px] text-muted-foreground">
              {expense.category} · {formatDisplayDate(expense.date)}
            </span>
          </span>
          <span className="text-[15px] font-semibold tabular-nums">
            {formatMoney(expense.amount, currency)}
          </span>
        </button>
      </div>
    </li>
  );
}

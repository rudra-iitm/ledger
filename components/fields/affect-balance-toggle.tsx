"use client";

export function AffectBalanceToggle({
  checked,
  onChange,
  title = "Affect account balance",
  description = "Turn off for planned or draft entries",
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 shadow-soft">
      <div className="flex flex-col pr-3">
        <span className="text-[15px] font-medium">{title}</span>
        <span className="text-[13px] text-muted-foreground">{description}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
          checked ? "bg-emerald-500" : "bg-muted"
        }`}
      >
        <span
          className={`pointer-events-none block size-5 rounded-full bg-background shadow-sm transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

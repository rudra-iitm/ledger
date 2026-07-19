"use client";

import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Snapshot } from "@/lib/domain/types";
import { formatMoney } from "@/lib/domain/money";
import { formatDisplayMonth } from "@/lib/domain/dates";

export function NetWorthChart({
  snapshots,
  currency,
}: {
  snapshots: Snapshot[];
  currency: string;
}) {
  const data = snapshots.map((snapshot) => ({
    month: snapshot.month,
    label: formatDisplayMonth(snapshot.month),
    netWorth: snapshot.netWorth,
  }));

  return (
    <div className="h-36 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="netWorthFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--positive)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--positive)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip
            cursor={{ stroke: "var(--border)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const point = payload[0].payload as {
                label: string;
                netWorth: number;
              };
              return (
                <div className="rounded-xl border border-border bg-popover px-3 py-2 text-[12px] shadow-float">
                  <p className="text-muted-foreground">{point.label}</p>
                  <p className="font-semibold tabular-nums">
                    {formatMoney(point.netWorth, currency)}
                  </p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="netWorth"
            stroke="var(--positive)"
            strokeWidth={2}
            fill="url(#netWorthFill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

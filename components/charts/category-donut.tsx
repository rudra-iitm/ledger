"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { CATEGORY_COLORS } from "@/lib/domain/category-meta";
import type { CategoryBreakdown } from "@/lib/domain/analytics";
import { formatMoney } from "@/lib/domain/money";

export function CategoryDonut({
  data,
  total,
  currency,
}: {
  data: CategoryBreakdown[];
  total: number;
  currency: string;
}) {
  return (
    <div className="relative mx-auto h-48 w-48">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="category"
            innerRadius={62}
            outerRadius={88}
            paddingAngle={data.length > 1 ? 2 : 0}
            stroke="none"
          >
            {data.map((entry) => (
              <Cell key={entry.category} fill={CATEGORY_COLORS[entry.category]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Total
        </span>
        <span className="text-xl font-semibold tabular-nums">
          {formatMoney(total, currency)}
        </span>
      </div>
    </div>
  );
}

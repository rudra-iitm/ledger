"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  XAxis,
} from "recharts";
import type { BucketPoint } from "@/lib/domain/analytics";

export function SpendBars({
  data,
  color = "var(--primary)",
}: {
  data: BucketPoint[];
  color?: string;
}) {
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={16}
          />
          <Bar dataKey="total" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.key} fill={color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

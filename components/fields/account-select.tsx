"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/lib/store/app-store";

const NONE = "__none__";

export function AccountSelect({
  value,
  onChange,
  id,
  allowNone = true,
}: {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  id?: string;
  allowNone?: boolean;
}) {
  const accounts = useAppStore((state) => state.data.accounts);
  const active = accounts.filter((account) => !account.archived);

  return (
    <Select
      value={value ?? NONE}
      onValueChange={(next) => onChange(next === NONE ? undefined : next)}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder="Account" />
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NONE}>None</SelectItem>}
        {active.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            {account.icon} {account.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

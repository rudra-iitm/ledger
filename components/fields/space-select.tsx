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

export function SpaceSelect({
  value,
  onChange,
  id,
}: {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  id?: string;
}) {
  const spaces = useAppStore((state) => state.data.spaces);
  const active = spaces.filter((space) => !space.archived);

  return (
    <Select
      value={value ?? NONE}
      onValueChange={(next) => onChange(next === NONE ? undefined : next)}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder="Space" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>No space</SelectItem>
        {active.map((space) => (
          <SelectItem key={space.id} value={space.id}>
            {space.icon} {space.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAppStore } from "@/lib/store/app-store";
import { resolveInstitution } from "@/lib/institutions/registry";
import { InstitutionIcon } from "@/components/institution-icon";

const NONE = "__none__";

export function AccountSelect({
  value,
  onChange,
  id,
  allowNone = true,
  includeInvestment = false,
}: {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  id?: string;
  allowNone?: boolean;
  includeInvestment?: boolean;
}) {
  const accounts = useAppStore((state) => state.data.accounts);
  const active = accounts.filter(
    (account) =>
      !account.archived &&
      (includeInvestment || account.type !== "investment"),
  );

  return (
    <Select
      // With no selection, pass undefined so the placeholder shows — the NONE
      // sentinel only exists as an item when allowNone is on.
      value={value ?? (allowNone ? NONE : undefined)}
      onValueChange={(next) => onChange(next === NONE ? undefined : next)}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder="Account" />
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value={NONE}>None</SelectItem>}
        {active.map((account) => {
          const institution = resolveInstitution(account.name);
          const isGold = account.assetType === "gold";
          const isSilver = account.assetType === "silver";
          const displayName = account.type === "investment" ? account.name : (institution ? institution.name : account.name);

          return (
            <SelectItem key={account.id} value={account.id}>
              <div className="flex items-center gap-2">
                <InstitutionIcon 
                  institution={isGold || isSilver ? null : institution} 
                  type={account.type} 
                  assetType={account.assetType}
                  size="xs" 
                />
                <span>{displayName}</span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

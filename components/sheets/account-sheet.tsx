"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { EmojiPicker } from "@/components/fields/emoji-picker";
import {
  ACCOUNT_ICONS,
  ACCOUNT_TYPES,
  accountTypeSchema,
  type Account,
  type AccountType,
} from "@/lib/domain/types";
import { useAppStore } from "@/lib/store/app-store";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: "Cash",
  bank: "Bank Account",
  credit_card: "Credit Card",
  debit_card: "Debit Card",
  wallet: "Wallet",
  investment: "Investment Account",
  other: "Other",
};

export function AccountSheet({
  open,
  account,
  onClose,
}: {
  open: boolean;
  account?: Account;
  onClose: () => void;
}) {
  const addAccount = useAppStore((state) => state.addAccount);
  const updateAccount = useAppStore((state) => state.updateAccount);
  const deleteAccount = useAppStore((state) => state.deleteAccount);
  const currency = useAppStore((state) => state.data.settings.currency);

  const [name, setName] = useState("");
  const [type, setType] = useState<AccountType>("bank");
  const [balance, setBalance] = useState("");
  const [icon, setIcon] = useState(ACCOUNT_ICONS[1]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (account) {
      setName(account.name);
      setType(account.type);
      setBalance(String(account.balance));
      setIcon(account.icon);
    } else {
      setName("");
      setType("bank");
      setBalance("");
      setIcon(ACCOUNT_ICONS[1]);
    }
    setError(null);
  }, [open, account]);

  const submit = () => {
    if (!name.trim()) {
      setError("Add a name");
      return;
    }
    const payload = {
      name: name.trim(),
      type,
      balance: Number(balance) || 0,
      icon,
      currency,
    };
    if (account) {
      updateAccount(account.id, payload);
      toast.success("Account updated");
    } else {
      addAccount({ ...payload, archived: false });
      toast.success("Account created");
    }
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(value) => !value && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{account ? "Edit account" : "New account"}</SheetTitle>
        </SheetHeader>
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-col gap-2">
            <Label>Icon</Label>
            <EmojiPicker value={icon} onChange={setIcon} options={ACCOUNT_ICONS} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="account-name">Name</Label>
            <Input
              id="account-name"
              placeholder="HDFC Savings"
              autoComplete="off"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="account-type">Type</Label>
              <Select
                value={type}
                onValueChange={(value) => setType(accountTypeSchema.parse(value))}
              >
                <SelectTrigger id="account-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {ACCOUNT_TYPE_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="account-balance">Balance</Label>
              <div className="flex items-center gap-2 rounded-xl border border-input bg-card px-3.5">
                <span className="text-muted-foreground">{currency}</span>
                <input
                  id="account-balance"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="0"
                  value={balance}
                  onChange={(event) => setBalance(event.target.value)}
                  className="h-10 w-full bg-transparent text-base outline-none"
                />
              </div>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="mt-1 flex flex-col gap-2">
            <Button type="submit" size="lg">
              {account ? "Save changes" : "Create account"}
            </Button>
            {account && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="lg"
                  onClick={() => {
                    updateAccount(account.id, { archived: !account.archived });
                    toast.success(
                      account.archived ? "Account restored" : "Account archived",
                    );
                    onClose();
                  }}
                >
                  {account.archived ? "Restore account" : "Archive account"}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="lg"
                  onClick={() => {
                    deleteAccount(account.id);
                    toast.success("Account deleted");
                    onClose();
                  }}
                >
                  Delete account
                </Button>
              </>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

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
import {
  ACCOUNT_TYPES,
  accountTypeSchema,
  bankAccountTypeSchema,
  type Account,
  type AccountType,
  type BankAccountType,
} from "@/lib/domain/types";
import { DateField } from "@/components/fields/date-field";
import { todayISO } from "@/lib/domain/dates";
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
  const [openingDate, setOpeningDate] = useState(todayISO());
  const [statementDueDate, setStatementDueDate] = useState("");
  const [minimumDue, setMinimumDue] = useState("");

  // Metadata state
  const [holderName, setHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [branchName, setBranchName] = useState("");
  const [bankAccountType, setBankAccountType] = useState<BankAccountType | undefined>();
  const [minimumBalance, setMinimumBalance] = useState("");
  const [creditLimit, setCreditLimit] = useState("");
  const [statementBalance, setStatementBalance] = useState("");

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (account) {
      setName(account.name);
      setType(account.type);
      setBalance(String(account.openingBalance));
      setOpeningDate(account.openingDate ?? todayISO());
      setStatementDueDate(account.statementDueDate ?? "");
      setMinimumDue(account.minimumDue !== undefined ? String(account.minimumDue) : "");
      setHolderName(account.holderName ?? "");
      setAccountNumber(account.accountNumber ?? "");
      setIfscCode(account.ifscCode ?? "");
      setBranchName(account.branchName ?? "");
      setBankAccountType(account.bankAccountType);
      setMinimumBalance(account.minimumBalance !== undefined ? String(account.minimumBalance) : "");
      setCreditLimit(account.creditLimit !== undefined ? String(account.creditLimit) : "");
      setStatementBalance(account.statementBalance !== undefined ? String(account.statementBalance) : "");
    } else {
      setName("");
      setType("bank");
      setBalance("");
      setOpeningDate(todayISO());
      setStatementDueDate("");
      setMinimumDue("");
      setHolderName("");
      setAccountNumber("");
      setIfscCode("");
      setBranchName("");
      setBankAccountType(undefined);
      setMinimumBalance("");
      setCreditLimit("");
      setStatementBalance("");
    }
    setError(null);
  }, [open, account]);

  const submit = () => {
    if (!name.trim()) {
      setError("Add a name");
      return;
    }
    const openingBalance = Number(balance) || 0;
    const payload = {
      name: name.trim(),
      type,
      balance: openingBalance,
      openingBalance,
      openingDate,
      icon: account ? account.icon : "🏦", // Keep legacy field populated for database compat
      currency,
      debitCards: account ? account.debitCards : [],
      holderName: type === "bank" && holderName.trim() ? holderName.trim() : undefined,
      accountNumber: type === "bank" && accountNumber.trim() ? accountNumber.trim() : undefined,
      ifscCode: type === "bank" && ifscCode.trim() ? ifscCode.trim() : undefined,
      branchName: type === "bank" && branchName.trim() ? branchName.trim() : undefined,
      bankAccountType: type === "bank" ? bankAccountType : undefined,
      minimumBalance: type === "bank" && minimumBalance ? Number(minimumBalance) : undefined,
      creditLimit: type === "credit_card" && creditLimit ? Number(creditLimit) : undefined,
      statementBalance: type === "credit_card" && statementBalance ? Number(statementBalance) : undefined,
      minimumDue: type === "credit_card" && minimumDue ? Number(minimumDue) : undefined,
      statementDueDate: type === "credit_card" && statementDueDate ? statementDueDate : undefined,
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
              <Label htmlFor="account-balance">
                {type === "credit_card" ? "Opening outstanding" : "Opening balance"}
              </Label>
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

          <div className="flex flex-col gap-2">
            <Label htmlFor="account-opening-date">As of</Label>
            <DateField
              id="account-opening-date"
              value={openingDate}
              onChange={(next) => next && setOpeningDate(next)}
            />
          </div>

          {type === "bank" && (
            <div className="flex flex-col gap-3.5 rounded-xl border border-border p-4 bg-muted/30">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Account Details</span>
              <div className="grid grid-cols-2 gap-3.5">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="holder-name">Account Holder</Label>
                  <Input id="holder-name" placeholder="John Doe" value={holderName} onChange={(e) => setHolderName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="account-number">Account Number</Label>
                  <Input id="account-number" placeholder="000012345678" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="ifsc-code">IFSC Code</Label>
                  <Input id="ifsc-code" placeholder="HDFC0001234" value={ifscCode} onChange={(e) => setIfscCode(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="branch-name">Branch</Label>
                  <Input id="branch-name" placeholder="Main Branch" value={branchName} onChange={(e) => setBranchName(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="bank-account-type">Account Variant</Label>
                  <Select value={bankAccountType} onValueChange={(value) => setBankAccountType(bankAccountTypeSchema.parse(value))}>
                    <SelectTrigger id="bank-account-type"><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {bankAccountTypeSchema.options.map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="min-balance">Minimum Balance</Label>
                  <Input id="min-balance" type="number" inputMode="decimal" step="0.01" placeholder="10000" value={minimumBalance} onChange={(e) => setMinimumBalance(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {type === "credit_card" && (
            <div className="flex flex-col gap-3.5 rounded-xl border border-border p-4 bg-muted/30">
              <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Credit Limits</span>
              <div className="grid grid-cols-2 gap-3.5">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="credit-limit">Total Credit Limit</Label>
                  <Input id="credit-limit" type="number" inputMode="decimal" step="0.01" placeholder="200000" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="statement-balance">Statement Balance</Label>
                  <Input id="statement-balance" type="number" inputMode="decimal" step="0.01" placeholder="0" value={statementBalance} onChange={(e) => setStatementBalance(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="minimum-due">Minimum Due</Label>
                  <Input id="minimum-due" type="number" inputMode="decimal" step="0.01" placeholder="0" value={minimumDue} onChange={(e) => setMinimumDue(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="statement-due-date">Due Date</Label>
                  <DateField id="statement-due-date" value={statementDueDate || null} onChange={(next) => setStatementDueDate(next)} />
                </div>
              </div>
            </div>
          )}

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

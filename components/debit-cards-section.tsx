"use client";

import { useState } from "react";
import { Plus, CreditCard, Trash2 } from "lucide-react";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppStore } from "@/lib/store/app-store";
import type { Account, DebitCard } from "@/lib/domain/types";
import { formatMoney } from "@/lib/domain/money";
import { todayISO } from "@/lib/domain/dates";

export function DebitCardsSection({ account, currency }: { account: Account; currency: string }) {
  const [open, setOpen] = useState(false);
  const [network, setNetwork] = useState<DebitCard["network"]>("Visa");
  const [expiryDate, setExpiryDate] = useState("");
  const [last4Digits, setLast4Digits] = useState("");
  
  const addDebitCard = useAppStore((state) => state.addDebitCard);
  const deleteDebitCard = useAppStore((state) => state.deleteDebitCard);
  const expenses = useAppStore((state) => state.data.expenses);

  if (account.type !== "bank") return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (last4Digits.length !== 4 || isNaN(Number(last4Digits))) {
      toast.error("Please enter a valid 4-digit number");
      return;
    }
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiryDate)) {
      toast.error("Please enter a valid expiry date (MM/YY)");
      return;
    }

    addDebitCard(account.id, { network, expiryDate, last4Digits });
    setOpen(false);
    setExpiryDate("");
    setLast4Digits("");
    toast.success("Debit card added");
  };

  const today = todayISO();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Linked Debit Cards</h3>
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="-mr-3">
          <Plus className="size-4" />
          Add Card
        </Button>
      </div>

      {account.debitCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 py-8 text-center">
          <CreditCard className="size-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">No debit cards linked.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {account.debitCards.map((card) => {
            const todaysSpending = expenses
              .filter((e) => e.debitCardId === card.id && e.date === today && e.type === "expense")
              .reduce((sum, e) => sum + e.amount, 0);

            return (
              <div key={card.id} className="group relative overflow-hidden rounded-2xl p-5 shadow-soft border border-border/10 bg-gradient-to-br from-zinc-800 to-zinc-950 text-white">
                <div className="absolute top-0 left-0 w-full h-full bg-[url('/noise.png')] opacity-10 pointer-events-none" />
                
                <div className="relative flex justify-between items-start mb-6">
                  <span className="font-semibold tracking-widest text-white/90">
                    {card.network}
                  </span>
                  <button 
                    onClick={() => deleteDebitCard(account.id, card.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-black/20 hover:bg-black/40 rounded-full"
                    aria-label="Remove card"
                  >
                    <Trash2 className="size-3.5 text-white/70 hover:text-red-400 transition-colors" />
                  </button>
                </div>
                
                <div className="relative flex flex-col gap-1">
                  <div className="flex items-center gap-3 text-lg font-mono tracking-widest text-white/80">
                    <span>••••</span>
                    <span>••••</span>
                    <span>••••</span>
                    <span className="text-white">{card.last4Digits}</span>
                  </div>
                  <div className="flex justify-between items-end mt-2">
                    <span className="text-xs font-medium text-white/60">EXPIRES {card.expiryDate}</span>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] uppercase text-white/50 tracking-wider">Today&apos;s Spending</span>
                      <span className="font-semibold text-white">{formatMoney(todaysSpending, currency)}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Debit Card</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="flex flex-col gap-5 pt-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="card-network">Network</Label>
              <Select value={network} onValueChange={(v) => setNetwork(v as DebitCard["network"])}>
                <SelectTrigger id="card-network">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Visa">Visa</SelectItem>
                  <SelectItem value="Mastercard">Mastercard</SelectItem>
                  <SelectItem value="RuPay">RuPay</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="card-last4">Last 4 Digits</Label>
                <Input 
                  id="card-last4" 
                  placeholder="1234" 
                  maxLength={4} 
                  value={last4Digits} 
                  onChange={(e) => setLast4Digits(e.target.value.replace(/\D/g, ""))} 
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="card-expiry">Expiry Date</Label>
                <Input 
                  id="card-expiry" 
                  placeholder="MM/YY" 
                  maxLength={5} 
                  value={expiryDate} 
                  onChange={(e) => {
                    let val = e.target.value.replace(/[^\d/]/g, "");
                    if (val.length === 2 && !val.includes("/")) {
                      val += "/";
                    }
                    setExpiryDate(val);
                  }} 
                />
              </div>
            </div>

            <Button type="submit" size="lg" className="mt-2">
              Add Card
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

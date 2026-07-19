"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, FileUp, Inbox } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AccountSelect } from "@/components/fields/account-select";
import {
  guessMapping,
  parseCsv,
  parseStatementCsv,
} from "@/lib/domain/ingest/csv";
import type { CsvMapping, ImportBatch } from "@/lib/domain/types";
import { formatDisplayDate } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { useAppStore } from "@/lib/store/app-store";

const NONE = "__none__";

type Role = keyof Omit<CsvMapping, "hasHeader">;

const ROLES: { key: Role; label: string; required?: boolean }[] = [
  { key: "dateCol", label: "Date", required: true },
  { key: "descCol", label: "Description", required: true },
  { key: "debitCol", label: "Withdrawal / debit" },
  { key: "creditCol", label: "Deposit / credit" },
  { key: "amountCol", label: "Signed amount" },
  { key: "refCol", label: "Reference no." },
  { key: "balanceCol", label: "Balance" },
];

const DEFAULT_MAPPING: CsvMapping = {
  dateCol: 0,
  descCol: 1,
  hasHeader: true,
};

export function ImportView() {
  const accounts = useAppStore((state) => state.data.accounts);
  const currency = useAppStore((state) => state.data.settings.currency);
  const importStatement = useAppStore((state) => state.importStatement);
  const updateAccount = useAppStore((state) => state.updateAccount);

  const fileInput = useRef<HTMLInputElement>(null);
  const [accountId, setAccountId] = useState<string | undefined>(undefined);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileText, setFileText] = useState<string | null>(null);
  const [mapping, setMapping] = useState<CsvMapping>(DEFAULT_MAPPING);
  const [result, setResult] = useState<ImportBatch | null>(null);

  const table = useMemo(
    () => (fileText ? parseCsv(fileText) : []),
    [fileText],
  );
  const headers = table[0] ?? [];
  const parsed = useMemo(
    () => (fileText ? parseStatementCsv(fileText, mapping) : null),
    [fileText, mapping],
  );

  const columnLabel = (index: number) =>
    mapping.hasHeader && headers[index]?.trim()
      ? headers[index].trim()
      : `Column ${index + 1}`;

  const onPickFile = async (file: File) => {
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      toast.error("That file looks empty.");
      return;
    }
    setFileName(file.name);
    setFileText(text);
    setResult(null);
    const account = accounts.find((item) => item.id === accountId);
    const guessed = account?.csvMapping ?? guessMapping(rows[0] ?? []);
    setMapping(guessed ?? { ...DEFAULT_MAPPING });
    if (!guessed) {
      toast("Map the columns below — Ledger couldn't recognize the headers.");
    }
  };

  const setRole = (role: Role, value: string) => {
    setMapping((current) => ({
      ...current,
      [role]: value === NONE ? undefined : Number(value),
    }));
  };

  const runImport = () => {
    if (!accountId || !parsed || parsed.rows.length === 0 || !fileName) return;
    const batch = importStatement(accountId, fileName, parsed.rows);
    updateAccount(accountId, { csvMapping: mapping });
    setResult(batch);
  };

  if (result) {
    const account = accounts.find((item) => item.id === result.accountId);
    return (
      <div className="flex flex-col items-center gap-5 rounded-3xl border border-border bg-card px-6 py-10 text-center shadow-soft">
        <CheckCircle2 aria-hidden className="size-10 text-positive" />
        <div className="flex flex-col gap-1">
          <p className="text-lg font-semibold">Statement imported</p>
          <p className="text-[13px] text-muted-foreground">
            {result.fileName}
            {account ? ` → ${account.name}` : ""}
          </p>
        </div>
        <dl className="grid w-full grid-cols-2 gap-2 text-left">
          {[
            ["Rows in statement", result.rowCount],
            ["New drafts", result.newCount],
            ["Matched to existing", result.autoMergedCount],
            ["Need your review", result.reviewCount],
            ["Already imported", result.duplicateCount],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-2xl border border-border px-3 py-2"
            >
              <dt className="text-[11px] uppercase text-muted-foreground">
                {label}
              </dt>
              <dd className="text-lg font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
          {result.closingBalance !== undefined && (
            <div className="rounded-2xl border border-border px-3 py-2">
              <dt className="text-[11px] uppercase text-muted-foreground">
                Statement closing balance
              </dt>
              <dd className="text-lg font-semibold tabular-nums">
                {formatMoney(result.closingBalance, currency)}
              </dd>
            </div>
          )}
        </dl>
        <div className="flex w-full gap-2">
          <Button asChild className="flex-1">
            <Link href="/inbox">
              <Inbox aria-hidden />
              Open Inbox
            </Link>
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              setFileName(null);
              setFileText(null);
              setResult(null);
            }}
          >
            Import another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label>Into account</Label>
        <AccountSelect
          value={accountId}
          onChange={setAccountId}
          allowNone={false}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>Statement file (CSV)</Label>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onPickFile(file);
            event.target.value = "";
          }}
        />
        <Button
          variant="outline"
          className="justify-start"
          disabled={!accountId}
          onClick={() => fileInput.current?.click()}
        >
          <FileUp aria-hidden />
          {fileName ?? "Choose file…"}
        </Button>
        <p className="text-[12px] text-muted-foreground">
          Download the CSV/Excel-as-CSV statement from your bank. Dates are read
          day-first (DD/MM/YYYY). Re-importing the same statement is safe —
          already-imported rows are skipped.
        </p>
      </div>

      {fileText && (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
              Column mapping
            </h2>
            <button
              type="button"
              onClick={() =>
                setMapping((current) => ({
                  ...current,
                  hasHeader: !current.hasHeader,
                }))
              }
              className="w-fit rounded-full border border-border px-3 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              First row is {mapping.hasHeader ? "a header ✓" : "data"}
            </button>
            <div className="grid grid-cols-2 gap-3">
              {ROLES.map(({ key, label, required }) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <Label className="text-[12px]">
                    {label}
                    {required ? "" : " (optional)"}
                  </Label>
                  <Select
                    value={
                      mapping[key] !== undefined ? String(mapping[key]) : NONE
                    }
                    onValueChange={(value) => setRole(key, value)}
                  >
                    <SelectTrigger className="h-9 text-[13px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {!required && <SelectItem value={NONE}>None</SelectItem>}
                      {headers.map((_, index) => (
                        <SelectItem key={index} value={String(index)}>
                          {columnLabel(index)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
              Preview
              {parsed
                ? ` — ${parsed.rows.length} transactions${parsed.skipped ? `, ${parsed.skipped} rows skipped` : ""}`
                : ""}
            </h2>
            {parsed && parsed.rows.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {parsed.rows.slice(0, 5).map((row, index) => (
                  <li
                    key={index}
                    className="flex items-center gap-3 rounded-xl border border-border px-3 py-2 text-[13px]"
                  >
                    <span className="w-16 shrink-0 text-muted-foreground">
                      {formatDisplayDate(row.date)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {row.description}
                    </span>
                    <span
                      className={
                        "font-semibold tabular-nums " +
                        (row.direction === "credit" ? "text-positive" : "")
                      }
                    >
                      {row.direction === "credit" ? "+" : "−"}
                      {formatMoney(row.amount, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-[13px] text-muted-foreground">
                No rows parse with this mapping yet — check the date and amount
                columns.
              </p>
            )}
          </section>

          <Button
            size="lg"
            disabled={!accountId || !parsed || parsed.rows.length === 0}
            onClick={runImport}
          >
            Import {parsed?.rows.length ?? 0} transactions
            <ArrowRight aria-hidden />
          </Button>
        </>
      )}
    </div>
  );
}

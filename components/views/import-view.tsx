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
  type StatementRow,
} from "@/lib/domain/ingest/csv";
import {
  collectStatementPasswords,
  parseStatementLines,
  type PdfLine,
} from "@/lib/domain/ingest/pdf";
import { extractPdfLines, PdfPasswordError } from "@/lib/pdf/extract";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  const [pdfRows, setPdfRows] = useState<{
    rows: StatementRow[];
    skipped: number;
  } | null>(null);
  const [extracting, setExtracting] = useState(false);
  const pendingPdf = useRef<{ file: File; buffer: ArrayBuffer } | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [rememberPassword, setRememberPassword] = useState(true);
  const [mapping, setMapping] = useState<CsvMapping>(DEFAULT_MAPPING);
  const [result, setResult] = useState<ImportBatch | null>(null);

  const table = useMemo(
    () => (fileText ? parseCsv(fileText) : []),
    [fileText],
  );
  const headers = table[0] ?? [];
  const parsed = useMemo(
    () =>
      pdfRows ?? (fileText ? parseStatementCsv(fileText, mapping) : null),
    [fileText, mapping, pdfRows],
  );

  const columnLabel = (index: number) =>
    mapping.hasHeader && headers[index]?.trim()
      ? headers[index].trim()
      : `Column ${index + 1}`;

  const completePdf = (file: File, lines: PdfLine[]): boolean => {
    const extracted = parseStatementLines(lines);
    if (extracted.rows.length === 0) {
      toast.error(
        "Couldn't find transactions in this PDF — it may be a scanned image. Export CSV from your bank instead.",
      );
      return false;
    }
    setFileName(file.name);
    setFileText(null);
    setPdfRows(extracted);
    return true;
  };

  const onPickFile = async (file: File) => {
    setResult(null);
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      setExtracting(true);
      try {
        const buffer = await file.arrayBuffer();
        try {
          completePdf(file, await extractPdfLines(buffer));
          return;
        } catch (error) {
          if (!(error instanceof PdfPasswordError)) throw error;
        }
        // Encrypted: quietly try every saved statement password first.
        for (const saved of collectStatementPasswords(accounts, accountId)) {
          try {
            const lines = await extractPdfLines(buffer, saved.password);
            if (completePdf(file, lines)) {
              toast.success(`Unlocked with ${saved.accountName}'s saved password`);
            }
            return;
          } catch (error) {
            if (!(error instanceof PdfPasswordError)) throw error;
          }
        }
        pendingPdf.current = { file, buffer };
        setPasswordValue("");
        setPasswordError(null);
        setRememberPassword(true);
        setPasswordDialogOpen(true);
      } catch {
        toast.error(
          "Couldn't read this PDF. Try exporting CSV from your bank instead.",
        );
      } finally {
        setExtracting(false);
      }
      return;
    }
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      toast.error("That file looks empty.");
      return;
    }
    setFileName(file.name);
    setPdfRows(null);
    setFileText(text);
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
    if (!pdfRows) updateAccount(accountId, { csvMapping: mapping });
    setResult(batch);
  };

  const submitPassword = async (password: string, fromSaved = false) => {
    const pending = pendingPdf.current;
    if (!pending || !password) return;
    setExtracting(true);
    setPasswordError(null);
    try {
      const lines = await extractPdfLines(pending.buffer, password);
      const ok = completePdf(pending.file, lines);
      setPasswordDialogOpen(false);
      pendingPdf.current = null;
      if (ok && !fromSaved && rememberPassword && accountId) {
        updateAccount(accountId, { statementPassword: password });
        toast.success("Password saved for this account");
      }
    } catch (error) {
      if (error instanceof PdfPasswordError) {
        setPasswordError("That password didn't unlock this file. Try again.");
      } else {
        setPasswordDialogOpen(false);
        toast.error("Couldn't read this PDF after unlocking. Try CSV instead.");
      }
    } finally {
      setExtracting(false);
    }
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
              setPdfRows(null);
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
        <Label>Statement file (CSV or PDF)</Label>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,.pdf,text/csv,text/plain,application/pdf"
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
          disabled={!accountId || extracting}
          onClick={() => fileInput.current?.click()}
        >
          <FileUp aria-hidden />
          {extracting ? "Reading PDF…" : (fileName ?? "Choose file…")}
        </Button>
        <p className="text-[12px] text-muted-foreground">
          Bank or credit-card statements. CSV is most reliable; PDF text
          statements work too (unlock password-protected ones first). Dates are
          read day-first (DD/MM/YYYY). Re-importing the same statement is safe —
          already-imported rows are skipped.
        </p>
      </div>

      {pdfRows && (
        <p className="rounded-xl border border-border bg-card px-3 py-2 text-[12px] text-muted-foreground">
          Parsed from PDF — check the preview below before importing
          {pdfRows.skipped > 0 ? ` (${pdfRows.skipped} lines skipped)` : ""}.
        </p>
      )}

      {(fileText || pdfRows) && (
        <>
          {fileText && (
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
          )}

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

      <Dialog
        open={passwordDialogOpen}
        onOpenChange={(open) => {
          setPasswordDialogOpen(open);
          if (!open) pendingPdf.current = null;
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Statement password</DialogTitle>
            <DialogDescription>
              {pendingPdf.current?.file.name ?? "This PDF"} is
              password-protected. Banks usually use your PAN, date of birth, or
              a combination — check the statement email.
            </DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void submitPassword(passwordValue.trim());
            }}
          >
            {collectStatementPasswords(accounts, accountId).length > 0 && (
              <div className="flex flex-col gap-2">
                <Label>Saved passwords</Label>
                <div className="flex flex-wrap gap-2">
                  {collectStatementPasswords(accounts, accountId).map(
                    (saved) => (
                      <button
                        key={saved.accountId}
                        type="button"
                        disabled={extracting}
                        onClick={() => void submitPassword(saved.password, true)}
                        className="rounded-full border border-border bg-card px-3.5 py-1.5 text-[13px] font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                      >
                        {saved.accountName} · ••••
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="pdf-password">Password</Label>
              <Input
                id="pdf-password"
                type="password"
                autoComplete="off"
                autoFocus
                value={passwordValue}
                onChange={(event) => {
                  setPasswordValue(event.target.value);
                  setPasswordError(null);
                }}
              />
              {passwordError && (
                <p className="text-[13px] text-destructive">{passwordError}</p>
              )}
            </div>
            <button
              type="button"
              role="checkbox"
              aria-checked={rememberPassword}
              onClick={() => setRememberPassword((value) => !value)}
              className="flex items-center gap-2.5 rounded-xl px-1 py-1 text-left text-[13px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                aria-hidden
                className={
                  "flex size-4.5 shrink-0 items-center justify-center rounded-md border transition-colors " +
                  (rememberPassword
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border")
                }
              >
                {rememberPassword ? "✓" : ""}
              </span>
              Remember for{" "}
              {accounts.find((account) => account.id === accountId)?.name ??
                "this account"}
            </button>
            <Button
              type="submit"
              disabled={!passwordValue.trim() || extracting}
            >
              {extracting ? "Unlocking…" : "Unlock statement"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

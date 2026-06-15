import type { ReportData } from "@/lib/domain/reports";

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  triggerDownload(filename, URL.createObjectURL(blob));
}

export function downloadJson(filename: string, content: string): void {
  const blob = new Blob([content], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  triggerDownload(filename, url);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadReportPdf(
  filename: string,
  report: ReportData,
  currency: string,
): Promise<void> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF();
  const money = (value: number) =>
    `${currency}${Math.round(value).toLocaleString("en-IN")}`;

  doc.setFontSize(18);
  doc.text(report.title, 14, 20);
  doc.setFontSize(11);
  doc.setTextColor(120);
  doc.text(report.generatedFor, 14, 27);
  doc.setTextColor(20);
  doc.setFontSize(13);
  doc.text(`Total ${money(report.total)} · ${report.count} transactions`, 14, 37);

  autoTable(doc, {
    startY: 44,
    head: [["Category", "Amount", "Share"]],
    body: report.categories.map((entry) => [
      entry.category,
      money(entry.total),
      `${Math.round(entry.percentage)}%`,
    ]),
    theme: "striped",
    headStyles: { fillColor: [30, 30, 30] },
  });

  const lastY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? 60;

  autoTable(doc, {
    startY: lastY + 8,
    head: [["Date", "Description", "Category", "Amount"]],
    body: report.rows.map((row) => [
      row.date,
      row.description,
      row.category,
      money(row.amount),
    ]),
    theme: "grid",
    headStyles: { fillColor: [30, 30, 30] },
    styles: { fontSize: 9 },
  });

  doc.save(filename);
}

function triggerDownload(filename: string, url: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

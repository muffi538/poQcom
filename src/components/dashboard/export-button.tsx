"use client";

import { Download } from "lucide-react";
import { toCsv, downloadCsv, CsvCell } from "@/lib/export/csv";

export function ExportButton({
  headers,
  rows,
  filename,
  label = "Export",
}: {
  headers: string[];
  rows: CsvCell[][];
  filename: string;
  label?: string;
}) {
  return (
    <button
      onClick={() => downloadCsv(filename, toCsv(headers, rows))}
      disabled={rows.length === 0}
      title="Export to Excel (downloads a .csv file — opens directly in Excel)"
      className="inline-flex items-center gap-1 rounded-full border border-frido-border px-2.5 py-1 text-[11px] font-medium text-neutral-500 transition-colors hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:hover:bg-neutral-900"
    >
      <Download size={12} />
      {label}
    </button>
  );
}

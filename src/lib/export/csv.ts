"use client";

// Client-side CSV export — no library needed, and CSV opens directly in
// Excel (double-click, or Excel's own "Open" dialog) without requiring a
// binary .xlsx encoder. A UTF-8 BOM is prepended so Excel renders non-ASCII
// characters (₹, →, etc.) correctly instead of mangling them — a plain
// CSV without it reads as Windows-1252 in Excel on Windows.
export type CsvCell = string | number | null;

function escapeCell(value: CsvCell): string {
  const str = value === null ? "" : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(","));
  return lines.join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

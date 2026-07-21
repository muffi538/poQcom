export function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtCurrency(n: number | null): string {
  return n === null ? "—" : `₹${Math.round(n).toLocaleString("en-IN")}`;
}

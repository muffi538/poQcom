import { PoRow } from "./po-rows";

const EXPIRY_BUCKETS: Array<{ label: string; test: (days: number) => boolean }> = [
  { label: "Overdue", test: (d) => d < 0 },
  { label: "0–3 days", test: (d) => d >= 0 && d <= 3 },
  { label: "4–7 days", test: (d) => d > 3 && d <= 7 },
  { label: "8–14 days", test: (d) => d > 7 && d <= 14 },
  { label: "15–30 days", test: (d) => d > 14 && d <= 30 },
  { label: "30+ days", test: (d) => d > 30 },
];

// A blank expiry date (e.g. BigBasket/Amazon Now, whose real sheets carry
// no Expiry Date column) must never fall into "0–3 days" just because
// daysRemaining defaults to 0 for math-safety elsewhere — it gets its own
// honest bucket instead of being silently mixed into "urgent" or dropped.
export function expiryTimeline(rows: PoRow[]) {
  const withDate = rows.filter((r) => r.hasExpiryDate);
  const withoutDate = rows.length - withDate.length;
  const buckets = EXPIRY_BUCKETS.map((bucket) => ({
    label: bucket.label,
    value: withDate.filter((r) => bucket.test(r.daysRemaining)).length,
  }));
  if (withoutDate > 0) buckets.push({ label: "No Expiry Date", value: withoutDate });
  return buckets;
}

export function poValueByMarketplace(rows: PoRow[]) {
  const byMarketplace = new Map<string, number>();
  for (const r of rows) {
    if (r.po.poValue === null) continue;
    byMarketplace.set(r.po.marketplace, (byMarketplace.get(r.po.marketplace) ?? 0) + r.po.poValue);
  }
  return Array.from(byMarketplace, ([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

export function pendingQtyByCity(rows: PoRow[], topN = 10) {
  const byCity = new Map<string, number>();
  for (const r of rows) {
    byCity.set(r.po.city, (byCity.get(r.po.city) ?? 0) + r.po.pendingQty);
  }
  return Array.from(byCity, ([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, topN);
}

// Average days late (today − expiry) among currently-overdue POs, per
// marketplace — the Operational Delay replacement for the retired SLA %
// chart. Only counts POs that are actually overdue; a marketplace with
// none shows 0, not a negative "days remaining" average.
export function operationalDelayByMarketplace(rows: PoRow[]) {
  const sums = new Map<string, { total: number; count: number }>();
  for (const r of rows) {
    if (!r.isOverdue || r.operationalDelayDays === null) continue;
    const cur = sums.get(r.po.marketplace) ?? { total: 0, count: 0 };
    cur.total += r.operationalDelayDays;
    cur.count += 1;
    sums.set(r.po.marketplace, cur);
  }
  return Array.from(sums, ([label, { total, count }]) => ({
    label,
    value: count > 0 ? Math.round((total / count) * 10) / 10 : 0,
  })).sort((a, b) => b.value - a.value);
}

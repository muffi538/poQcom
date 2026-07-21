import { PurchaseOrder, PoTimeline } from "@/types/purchase-order";
import { daysBetween } from "./dates";
import { EngineConfig } from "@/lib/config/store";

// SLA window = Expiry − PO Raised (confirmed). "Today" is the actual
// current date — date filters (Year/Month/etc.) narrow which POs are
// compared, they don't change what "today" means for SLA math.
//
// Appointment Delay is NOT yet a confirmed formula — there's no separate
// "expected appointment date" field in the sheet, so this uses the gap
// between Expiry Date and Appointment Date (days the appointment sits past
// the PO's own expiry) as a working proxy. Flag this for confirmation
// before it drives real scoring.
//
// Missing/unparseable dates (a handful of rows have blank PO Date or
// Expiry Date even after forward-filling) produce NaN from daysBetween —
// guarded here so one bad row doesn't poison averages downstream.
export function computeTimeline(
  po: PurchaseOrder,
  config: EngineConfig,
  today: Date = new Date()
): PoTimeline {
  const todayIso = today.toISOString().slice(0, 10);
  const totalProcessingWindowDaysRaw = daysBetween(po.poRaisedDate, po.expiryDate);
  const totalProcessingWindowDays = Number.isFinite(totalProcessingWindowDaysRaw)
    ? totalProcessingWindowDaysRaw
    : 0;
  const daysUsedRaw = daysBetween(po.poRaisedDate, todayIso);
  const daysUsed = Number.isFinite(daysUsedRaw) ? daysUsedRaw : 0;
  const daysRemainingRaw = daysBetween(todayIso, po.expiryDate);
  const daysRemaining = Number.isFinite(daysRemainingRaw) ? daysRemainingRaw : 0;

  const slaConsumedPercent =
    totalProcessingWindowDays > 0
      ? Math.max(0, (daysUsed / totalProcessingWindowDays) * 100)
      : 0;

  const appointmentDelayRaw = po.appointmentDate
    ? daysBetween(po.expiryDate, po.appointmentDate)
    : null;
  const appointmentDelayDays =
    appointmentDelayRaw !== null && Number.isFinite(appointmentDelayRaw)
      ? Math.max(0, appointmentDelayRaw)
      : null;

  const normalizedCity = po.city.trim().toLowerCase();
  const isMetroCity = config.metroCities.some(
    (city) => city.trim().toLowerCase() === normalizedCity
  );

  return {
    totalProcessingWindowDays,
    daysUsed,
    daysRemaining,
    slaConsumedPercent,
    appointmentDelayDays,
    isMetroCity,
  };
}

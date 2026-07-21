import { PurchaseOrder, PoTimeline, isTerminalStatus } from "@/types/purchase-order";
import { daysBetween } from "./dates";
import { EngineConfig } from "@/lib/config/store";

// "Today" is the actual current date — date filters (Year/Month/etc.)
// narrow which POs are compared, they don't change what "today" means.
//
// Operational Delay (confirmed, replaces SLA % consumed entirely) = today
// − expiry date for any PO that isn't Delivered/terminal and has a real
// expiry date. Positive means days late, negative means days remaining.
// Never computed for Delivered/terminal POs (edge case: never mark those
// expired) or when Expiry Date is blank (edge case: show "Unknown"
// instead of a fabricated number).
//
// Appointment Delay (still a working, unconfirmed proxy — no "expected
// appointment date" field exists) is the gap between Expiry Date and
// Appointment Date; also flagged as `appointmentScheduledTooLate` per the
// edge case for an appointment booked after the PO already expired.
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
  const expiryDateValid = Number.isFinite(daysRemainingRaw);
  const daysRemaining = expiryDateValid ? daysRemainingRaw : 0;

  const operationalDelayDays =
    !isTerminalStatus(po.status) && expiryDateValid ? -daysRemaining : null;
  const isOverdue = operationalDelayDays !== null && operationalDelayDays > 0;

  const hasDataError =
    Number.isFinite(totalProcessingWindowDaysRaw) && totalProcessingWindowDaysRaw < 0;

  const appointmentDelayRaw = po.appointmentDate
    ? daysBetween(po.expiryDate, po.appointmentDate)
    : null;
  const appointmentDelayDays =
    appointmentDelayRaw !== null && Number.isFinite(appointmentDelayRaw)
      ? Math.max(0, appointmentDelayRaw)
      : null;
  const appointmentScheduledTooLate =
    appointmentDelayRaw !== null && Number.isFinite(appointmentDelayRaw) && appointmentDelayRaw > 0;

  const normalizedCity = po.city.trim().toLowerCase();
  const isMetroCity = config.metroCities.some(
    (city) => city.trim().toLowerCase() === normalizedCity
  );

  return {
    totalProcessingWindowDays,
    daysUsed,
    daysRemaining,
    operationalDelayDays,
    isOverdue,
    hasDataError,
    appointmentDelayDays,
    appointmentScheduledTooLate,
    isMetroCity,
  };
}

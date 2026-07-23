"use client";

import { useEffect, useState } from "react";
import { DateFilterState, DEFAULT_DATE_FILTER } from "./date-filter";

// One shared key across Overview AND every marketplace page — the date
// filter is confirmed global, not per-page: set it on Overview, navigate
// to a marketplace page, it's still applied. sessionStorage (not
// localStorage) matches "persist until the user changes it or refreshes
// the session" — cleared when the tab/session ends, kept across
// in-session navigation and reloads.
const STORAGE_KEY = "frido-dashboard-date-filter";

export function useDateFilter(): [DateFilterState, (next: DateFilterState) => void] {
  const [filter, setFilter] = useState<DateFilterState>(DEFAULT_DATE_FILTER);

  // sessionStorage isn't available during server rendering — read it
  // once after mount rather than in useState's initializer.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) setFilter(JSON.parse(raw));
    } catch {
      // Malformed JSON or storage unavailable (private browsing) —
      // fall back to the default filter rather than throwing.
    }
  }, []);

  function update(next: DateFilterState) {
    setFilter(next);
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Storage write failures (quota, private browsing) shouldn't break
      // the filter itself — it just won't persist across navigation.
    }
  }

  return [filter, update];
}

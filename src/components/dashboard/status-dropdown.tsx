"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export interface StatusOption {
  key: string;
  label: string;
  count: number;
}

// Custom-built (not a native <select>) so its popup renders with the
// app's own font/styling everywhere, rather than the browser's native
// dropdown chrome — and so counts can sit inline with each option.
export function StatusDropdown({
  options,
  active,
  onChange,
}: {
  options: StatusOption[];
  active: string;
  onChange: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const activeOption = options.find((o) => o.key === active) ?? options[0];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg border border-frido-border bg-white px-2.5 py-1.5 text-[12px] font-semibold shadow-sm outline-none transition-colors hover:bg-neutral-50 dark:border-white/10 dark:bg-neutral-900 dark:hover:bg-neutral-800"
      >
        <span>Status: {activeOption?.label ?? "All"}</span>
        <span className="tabular-nums text-neutral-400">({activeOption?.count ?? 0})</span>
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-30 mt-1 max-h-80 w-56 overflow-y-auto rounded-lg border border-frido-border bg-white py-1 shadow-lg dark:border-white/10 dark:bg-neutral-900"
        >
          {options.map((o) => (
            <button
              key={o.key}
              role="option"
              aria-selected={o.key === active}
              onClick={() => {
                onChange(o.key);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-[13px] transition-colors ${
                o.key === active
                  ? "bg-neutral-100 font-semibold dark:bg-neutral-800"
                  : "hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
              }`}
            >
              <span>{o.label}</span>
              <span className="tabular-nums text-neutral-400">{o.count}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

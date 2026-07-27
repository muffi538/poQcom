"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

type ThemePreference = "light" | "dark" | "system";

function applyTheme(pref: ThemePreference) {
  const isDark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

const OPTIONS: Array<{ value: ThemePreference; icon: typeof Sun; label: string }> = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "System" },
];

export function ThemeToggle({ collapsed }: { collapsed: boolean }) {
  const [pref, setPref] = useState<ThemePreference>("system");

  useEffect(() => {
    const stored = (localStorage.getItem("theme") as ThemePreference | null) ?? "system";
    setPref(stored);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if ((localStorage.getItem("theme") ?? "system") === "system") applyTheme("system");
    };
    media.addEventListener("change", onSystemChange);
    return () => media.removeEventListener("change", onSystemChange);
  }, []);

  function choose(next: ThemePreference) {
    setPref(next);
    localStorage.setItem("theme", next);
    applyTheme(next);
  }

  if (collapsed) {
    const current = OPTIONS.find((o) => o.value === pref) ?? OPTIONS[2];
    const Icon = current.icon;
    return (
      <button
        onClick={() => choose(pref === "light" ? "dark" : pref === "dark" ? "system" : "light")}
        title={`Theme: ${current.label} (click to change)`}
        className="flex items-center justify-center rounded-md border border-white/20 p-1.5 text-white/80 transition-colors hover:bg-white/10 dark:border-white/10 dark:text-neutral-500 dark:hover:bg-neutral-900"
      >
        <Icon size={16} />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-0.5 rounded-md border border-white/20 p-0.5 dark:border-white/10">
      {OPTIONS.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          onClick={() => choose(value)}
          title={label}
          aria-pressed={pref === value}
          className={`flex flex-1 items-center justify-center gap-1 rounded px-2 py-1.5 text-xs font-medium transition-colors ${
            pref === value
              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
              : "text-white/80 hover:bg-white/10 dark:text-neutral-500 dark:hover:bg-neutral-900"
          }`}
        >
          <Icon size={13} />
        </button>
      ))}
    </div>
  );
}

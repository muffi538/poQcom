"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

// Renders its children into document.body instead of in place. A
// `position: fixed` slide-over panel only stays pinned to the real
// viewport (not some ancestor's scroll position) as long as nothing
// between it and the page root ever gets a CSS transform/filter — that
// ancestor becomes the panel's containing block instead (confirmed bug,
// once caused by an animated wrapper div in the root layout that's since
// been removed). A portal sidesteps the whole class of bug permanently,
// regardless of what any future ancestor does.
export function SlideOverPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

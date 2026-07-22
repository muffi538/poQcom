"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

// Renders its children into document.body instead of in place. Needed
// because the root layout wraps the whole app in an `animate-fade-in-up`
// div — any CSS transform on an ancestor makes it the containing block
// for `position: fixed` descendants (per spec), so a slide-over panel
// rendered in the normal tree pins to the page's scroll position instead
// of the viewport. Invisible on short pages, visibly broken once a page
// (like a marketplace page with the Top Performing SKUs table) is tall
// enough to scroll. A portal escapes the transformed ancestor entirely.
export function SlideOverPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

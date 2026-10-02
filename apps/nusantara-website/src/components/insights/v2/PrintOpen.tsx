"use client";

import { useEffect } from "react";

/** Opens every <details> before printing so expandable research prints in full. */
export function PrintOpen() {
  useEffect(() => {
    const open = () => document.querySelectorAll("details").forEach((d) => d.setAttribute("open", ""));
    window.addEventListener("beforeprint", open);
    return () => window.removeEventListener("beforeprint", open);
  }, []);
  return null;
}

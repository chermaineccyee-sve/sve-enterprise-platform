"use client";

import { useEffect, type ReactNode } from "react";
import { track, type AnalyticsEvent } from "@/lib/analytics";

/** Fires an analytics event once when mounted (e.g. an article was opened). Renders nothing. */
export function TrackOnMount({ event }: { event: AnalyticsEvent }) {
  const key = JSON.stringify(event);
  useEffect(() => {
    track(JSON.parse(key) as AnalyticsEvent);
  }, [key]);
  return null;
}

/** A <details> element that reports when it is opened. Markup is unchanged. */
export function TrackedDetails({ event, className, children }: { event: AnalyticsEvent; className?: string; children: ReactNode }) {
  return (
    <details
      className={className}
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open) track(event);
      }}
    >
      {children}
    </details>
  );
}

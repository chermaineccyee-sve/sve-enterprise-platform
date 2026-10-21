"use client";

import { useState } from "react";

/** Share and print. Uses the native share sheet where available. */
export function ShareTools({ title, path }: { title: string; path: string }) {
  const [copied, setCopied] = useState(false);
  // Resolved on interaction only, so server and client render the same markup.
  const url = () => `${window.location.origin}${path}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const btn =
    "inline-flex h-9 items-center gap-2 border border-rule px-3 text-[12.5px] text-charcoal transition-colors hover:border-teal-800 hover:text-teal-800";
  return (
    <div className="flex flex-wrap items-center gap-2" data-print="hide">
      <span className="eyebrow mr-1 text-stone">Share</span>
      <button type="button" onClick={copy} className={btn}>
        {copied ? "Link copied" : "Copy link"}
      </button>
      <a
        className={btn}
        href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(path)}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          e.currentTarget.href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url())}`;
        }}
      >
        LinkedIn<span className="sr-only"> (opens in a new tab)</span>
      </a>
      <a
        className={btn}
        href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(path)}`}
        onClick={(e) => {
          e.currentTarget.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url())}`;
        }}
      >
        Email
      </a>
      <button type="button" onClick={() => window.print()} className={btn}>
        Print
      </button>
      <span role="status" className="sr-only">
        {copied ? "Link copied to clipboard" : ""}
      </span>
    </div>
  );
}

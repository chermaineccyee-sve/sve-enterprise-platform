import Link from "next/link";

export type Crumb = { label: string; href?: string };

export function Breadcrumb({ items, tone = "light" }: { items: Crumb[]; tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <nav aria-label="Breadcrumb" data-print="hide">
      <ol className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] ${dark ? "text-teal-200" : "text-stone"}`}>
        {items.map((c, i) => (
          <li key={`${c.label}-${i}`} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden className={dark ? "text-teal-500" : "text-mist"}>/</span>}
            {c.href && i < items.length - 1 ? (
              <Link href={c.href} className={`link-underline ${dark ? "hover:text-white" : "hover:text-teal-800"}`}>
                {c.label}
              </Link>
            ) : (
              <span aria-current={i === items.length - 1 ? "page" : undefined} className={dark ? "text-white" : "text-charcoal"}>
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

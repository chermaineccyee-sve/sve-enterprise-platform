import { PUBLICATION_LABEL, type Publication } from "@/content/model/publication";
import { formatDate } from "@/lib/market/format";

/**
 * Published · Last updated · Next review · Status — for approved, time-sensitive
 * Nusantara interpretation. Sample content keeps its management-review label
 * instead, so the prototype is unchanged.
 */
export function PublicationStamp({
  p,
  tone = "light",
  className = "",
}: {
  p: Pick<Publication, "status" | "publishedAt" | "updatedAt" | "reviewAt">;
  tone?: "light" | "dark";
  className?: string;
}) {
  const parts: [string, string][] = [];
  if (p.publishedAt) parts.push(["Published", formatDate(p.publishedAt)]);
  if (p.updatedAt && p.updatedAt !== p.publishedAt) parts.push(["Last updated", formatDate(p.updatedAt)]);
  if (p.reviewAt) parts.push(["Next review", formatDate(p.reviewAt)]);
  parts.push(["Status", PUBLICATION_LABEL[p.status]]);
  return (
    <dl className={`num flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] ${tone === "dark" ? "text-teal-200" : "text-stone"} ${className}`}>
      {parts.map(([k, v]) => (
        <div key={k} className="flex gap-1">
          <dt>{k}</dt>
          <dd className={tone === "dark" ? "text-teal-50" : "text-charcoal"}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

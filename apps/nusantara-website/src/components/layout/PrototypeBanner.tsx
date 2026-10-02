import Link from "next/link";
import { site } from "@/lib/site";

export function PrototypeBanner() {
  if (!site.isPrototype) return null;
  return (
    <div className="bg-teal-950 text-teal-100" data-print="hide">
      <div className="container-site flex min-h-8 flex-wrap items-center justify-between gap-x-6 gap-y-1 py-1.5 text-[11.5px] tracking-wide">
        <p className="flex items-center gap-2">
          <span aria-hidden className="block h-1.5 w-1.5 rotate-45 bg-gold-400" />
          <span>
            <strong className="font-semibold text-white">Management-review prototype.</strong> Market data is
            illustrative; content is pending approval.
          </span>
        </p>
        <Link href="/legal/important-information" className="hidden text-gold-300 hover:text-white sm:inline">
          Important information
        </Link>
      </div>
    </div>
  );
}

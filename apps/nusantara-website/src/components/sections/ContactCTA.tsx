import { CTA } from "@/components/ui/CTA";

export function ContactCTA({
  title = "Begin a conversation.",
  text = "For institutional, research or general enquiries, our team will direct your message to the appropriate person.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <section aria-labelledby="contact-cta" className="on-dark relative overflow-hidden bg-teal-800 text-white">
      <svg aria-hidden className="pointer-events-none absolute -left-32 -bottom-48 h-[520px] w-[520px] opacity-60" viewBox="0 0 520 520" fill="none">
        <circle cx="260" cy="260" r="250" stroke="rgba(205,174,115,0.4)" />
        <circle cx="260" cy="260" r="190" stroke="rgba(255,255,255,0.1)" />
      </svg>
      <div className="container-site relative grid gap-10 py-20 md:py-28 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-7">
          <p className="eyebrow text-gold-300">Contact</p>
          <h2 id="contact-cta" className="display-l mt-6">
            {title}
          </h2>
        </div>
        <div className="lg:col-span-5">
          <p className="lede text-teal-100">{text}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <CTA href="/contact" variant="light">
              Make an enquiry
            </CTA>
          </div>
        </div>
      </div>
    </section>
  );
}

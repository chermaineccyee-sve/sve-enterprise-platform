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
      <div className="container-site relative grid gap-10 py-20 md:py-28 lg:grid-cols-12 lg:items-end">
        <div className="lg:col-span-7">
          <p className="eyebrow text-teal-200">Contact</p>
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

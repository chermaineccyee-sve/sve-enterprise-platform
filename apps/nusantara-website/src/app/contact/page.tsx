import type { Metadata } from "next";
import { ContactForm } from "@/components/sections/ContactForm";
import { PageHero } from "@/components/ui/PageHero";
import { ReviewPlaceholder } from "@/components/ui/ReviewPlaceholder";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Nusantara Fund Management for general, institutional, research or business enquiries.",
  alternates: { canonical: "/contact" },
};

const DETAILS: { label: string; value: string | null }[] = [
  { label: "Address", value: site.contact.address },
  { label: "Telephone", value: site.contact.telephone },
  { label: "Email", value: site.contact.email },
];

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title={<>Begin a conversation.</>}
        lede="Tell us a little about your enquiry and we will direct it to the appropriate team."
        crumbs={[{ label: "Home", href: "/" }, { label: "Contact" }]}
      />
      <section className="bg-paper">
        <div className="container-site grid gap-16 py-16 md:py-24 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h2 className="sr-only">Enquiry form</h2>
            <ContactForm />
          </div>
          <aside className="lg:col-span-4 lg:col-start-9">
            <h2 className="eyebrow text-gold-700">Contact details</h2>
            <dl className="mt-6 divide-y divide-rule border-y border-rule">
              {DETAILS.map((d) => (
                <div key={d.label} className="py-4">
                  <dt className="text-[13px] text-stone">{d.label}</dt>
                  <dd className="mt-1 text-[15px] text-ink">
                    {d.value ?? <span className="text-gold-800">[To be confirmed by management]</span>}
                  </dd>
                </div>
              ))}
            </dl>
            <ReviewPlaceholder label="Contact information required" className="mt-6">
              Office address, telephone and email have not been supplied. They are shown as placeholders and will not be invented.
            </ReviewPlaceholder>
            <div className="mt-10 border-l-2 border-gold-500 pl-5">
              <p className="eyebrow text-gold-700">Please note</p>
              <p className="mt-2 text-[13.5px] leading-relaxed text-stone">
                Do not include confidential personal or financial information in this form. Submitting an enquiry does not create
                a client relationship and is not a request to invest.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  Download,
  ShieldCheck,
  RefreshCcw,
  Mail,
  Phone,
  MessageCircle,
  MapPin,
  Clock,
  HelpCircle,
} from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { Reveal } from "@/components/site/Reveal";
import { DEFAULT_SETTINGS, fetchSettings } from "@/lib/settings";

import { getFAQSchema, SITE_URL } from "@/lib/seo";

export const Route = createFileRoute("/read-more")({
  head: () => ({
    links: [{ rel: "canonical", href: `${SITE_URL}/read-more` }],
    meta: [
      { title: "Commercial Licensing, Instant Delivery & Support — Editly Store" },
      {
        name: "description",
        content:
          "Everything about Editly Store: instant download delivery, commercial licensing for client video edits, refund terms, software compatibility, and support.",
      },
      { property: "og:site_name", content: "Editly Store" },
      {
        property: "og:title",
        content: "Commercial Licensing, Instant Delivery & Support — Editly Store",
      },
      {
        property: "og:description",
        content:
          "Instant delivery, commercial license, refunds, and support for video editors and motion designers.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: `${SITE_URL}/read-more` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Licensing & Support — Editly Store" },
      {
        name: "twitter:description",
        content: "Instant delivery, commercial license, refunds, and support for video editors.",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(getFAQSchema(faqs)),
      },
    ],
  }),
  component: ReadMore,
});

const steps = [
  {
    icon: Sparkles,
    title: "Pick your pack",
    body: "Browse After Effects projects, extensions, LUTs and SFX libraries. Every product page shows previews, file details and real reviews.",
  },
  {
    icon: ShieldCheck,
    title: "Pay securely",
    body: "Checkout runs on Cashfree with UPI, cards, netbanking and wallets. Coupons apply automatically at the payment step.",
  },
  {
    icon: Download,
    title: "Download instantly",
    body: "Your link appears on screen the moment the payment clears, and a receipt with the same link lands in your inbox.",
  },
  {
    icon: RefreshCcw,
    title: "Keep every update",
    body: "When a pack gets a new version, it stays free for you — forever. No subscription, no re-purchase.",
  },
];

const faqs = [
  {
    q: "Which software versions are supported?",
    a: "After Effects packs work in CC 2020 and newer. LUTs are .cube files that load in Premiere Pro, DaVinci Resolve, Final Cut and After Effects. SFX packs are 48kHz WAV.",
  },
  {
    q: "Can I use these in client and monetised work?",
    a: "Yes. Every purchase includes a commercial licence for unlimited client projects, ads, YouTube and paid campaigns.",
  },
  {
    q: "Do I need an account to buy?",
    a: "You can check out as a guest, but signing in keeps every purchase and download link in one place and lets you claim free packs.",
  },
  {
    q: "My download link is not working — what now?",
    a: "Email support with your order ID. Links are re-issued within a few hours, and broken files are always replaced or refunded.",
  },
];

function ReadMore() {
  const { data: settings = DEFAULT_SETTINGS } = useQuery({
    queryKey: ["site-settings"],
    queryFn: fetchSettings,
    staleTime: 5 * 60 * 1000,
  });

  const contactRows = [
    {
      icon: Mail,
      label: "Email",
      value: settings.contact_email,
      href: `mailto:${settings.contact_email}`,
    },
    {
      icon: Mail,
      label: "Support",
      value: settings.support_email,
      href: `mailto:${settings.support_email}`,
    },
    settings.phone
      ? {
          icon: Phone,
          label: "Phone",
          value: settings.phone,
          href: `tel:${settings.phone.replace(/\s+/g, "")}`,
        }
      : null,
    settings.whatsapp
      ? {
          icon: MessageCircle,
          label: "WhatsApp",
          value: settings.whatsapp,
          href: `https://wa.me/${settings.whatsapp.replace(/[^\d]/g, "")}`,
        }
      : null,
    settings.support_hours
      ? { icon: Clock, label: "Hours", value: settings.support_hours, href: null }
      : null,
    settings.address
      ? { icon: MapPin, label: "Address", value: settings.address, href: null }
      : null,
  ].filter(Boolean) as { icon: typeof Mail; label: string; value: string; href: string | null }[];

  return (
    <SiteLayout dark>
      <section className="mx-auto max-w-[1100px] px-6 pb-6 pt-10 lg:px-12">
        <Reveal variant="blur">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-deep">
            Read more
          </p>
          <h1 className="mt-3 text-balance-tight font-display text-[clamp(2.4rem,5.6vw,4rem)] font-extrabold leading-[1.02] text-ink">
            Built so you can finish the edit, not fight the files.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink/80">
            Editly Store is a small studio catalogue of editing assets we actually use on client
            work — motion packs, panel extensions, film-emulation LUTs and clean sound libraries.
            Everything is delivered instantly, licensed for commercial use and updated for free.
          </p>
        </Reveal>
      </section>

      <section className="mx-auto max-w-[1100px] px-6 lg:px-12">
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {steps.map((step, i) => (
            <Reveal key={step.title} delay={i * 100} variant="scale">
              <div className="glass morph-card h-full rounded-4xl p-7">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-white/60 text-violet-deep">
                  <step.icon className="size-6" strokeWidth={1.6} />
                </span>
                <h2 className="mt-5 font-display text-xl font-extrabold text-ink">{step.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="licence" className="mx-auto mt-16 max-w-[1100px] scroll-mt-28 px-6 lg:px-12">
        <Reveal variant="blur">
          <div className="glass rounded-4xl p-9">
            <h2 className="font-display text-2xl font-extrabold text-ink">Licence</h2>
            <p className="mt-3 max-w-3xl leading-relaxed text-ink/80">{settings.licence_note}</p>
          </div>
        </Reveal>
      </section>

      <section id="refunds" className="mx-auto mt-6 max-w-[1100px] scroll-mt-28 px-6 lg:px-12">
        <Reveal variant="blur">
          <div className="glass rounded-4xl p-9">
            <h2 className="font-display text-2xl font-extrabold text-ink">Refunds</h2>
            <p className="mt-3 max-w-3xl leading-relaxed text-ink/80">{settings.refund_policy}</p>
          </div>
        </Reveal>
      </section>

      <section className="mx-auto mt-16 max-w-[1100px] px-6 lg:px-12">
        <Reveal>
          <h2 className="font-display text-3xl font-extrabold text-ink sm:text-4xl">
            Questions, answered.
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {faqs.map((faq, i) => (
            <Reveal key={faq.q} delay={i * 90} variant="scale">
              <div className="glass morph-card h-full rounded-4xl p-7">
                <h3 className="flex items-start gap-2 font-display text-lg font-extrabold text-ink">
                  <HelpCircle
                    className="mt-0.5 size-5 shrink-0 text-violet-deep"
                    strokeWidth={1.8}
                  />
                  {faq.q}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="contact" className="mx-auto mt-16 max-w-[1100px] scroll-mt-28 px-6 lg:px-12">
        <Reveal variant="blur">
          <div className="glass rounded-4xl p-9">
            <h2 className="font-display text-2xl font-extrabold text-ink">Talk to a human</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Real replies, usually the same day. Include your order ID if it is about a purchase.
            </p>
            <div className="mt-7 grid gap-4 sm:grid-cols-2">
              {contactRows.map((row) => (
                <div
                  key={row.label}
                  className="glass-soft flex items-start gap-3 rounded-3xl px-5 py-4"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white/60 text-violet-deep">
                    <row.icon className="size-4.5" strokeWidth={1.7} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-deep">
                      {row.label}
                    </p>
                    {row.href ? (
                      <a
                        href={row.href}
                        target={row.href.startsWith("http") ? "_blank" : undefined}
                        rel="noreferrer noopener"
                        className="break-words font-medium text-ink underline-offset-4 hover:underline"
                      >
                        {row.value}
                      </a>
                    ) : (
                      <p className="break-words font-medium text-ink">{row.value}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <Link
              to="/store"
              className="btn-shine mt-8 inline-flex rounded-full bg-primary px-8 py-3.5 font-display text-sm font-semibold text-primary-foreground shadow-float"
            >
              Browse the store
            </Link>
          </div>
        </Reveal>
      </section>
    </SiteLayout>
  );
}

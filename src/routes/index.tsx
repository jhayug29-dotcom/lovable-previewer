import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Zap,
  ShieldCheck,
  Download,
  Layers,
  Star,
  Users,
  Heart,
  ShoppingBag,
  X,
  ArrowUpRight,
} from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { ProductCard } from "@/components/site/ProductCard";
import { Reveal, CountUp } from "@/components/site/Reveal";
import { VideoCarousel } from "@/components/site/VideoCarousel";
import { AuroraBars } from "@/components/site/AuroraBars";
import { HeroShowcase } from "@/components/site/HeroShowcase";
import { getStoreProducts } from "@/lib/catalog.functions";
import type { DbProduct } from "@/lib/catalog-map";
import { useIndependenceMode } from "@/hooks/useIndependenceMode";

import { getOrganizationSchema, SITE_URL } from "@/lib/seo";

export const Route = createFileRoute("/")({
  loader: async () => ({ products: await getStoreProducts() }),
  head: () => ({
    meta: [
      { title: "Editly Store — After Effects Presets, Project Files & Editing Assets" },
      {
        name: "description",
        content:
          "Editly Store sells premium digital assets for video editors and motion designers: After Effects presets, project files, LUTs, Premiere extensions, and royalty-free SFX packs with instant download and lifetime updates.",
      },
      { property: "og:site_name", content: "Editly Store" },
      {
        property: "og:title",
        content: "Editly Store — After Effects Presets, Project Files & Editing Assets",
      },
      {
        property: "og:description",
        content:
          "Download After Effects packs, motion graphics templates, cinematic LUTs, and SFX libraries for editors who ship fast.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Editly Store — After Effects Presets & Editing Assets" },
      {
        name: "twitter:description",
        content:
          "Download After Effects packs, motion graphics templates, cinematic LUTs, and SFX libraries for editors who ship fast.",
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify(getOrganizationSchema()),
      },
    ],
  }),
  component: Landing,
});

const perks = [
  {
    icon: Download,
    title: "Instant delivery",
    body: "Your download link lands the second your payment clears.",
  },
  {
    icon: ShieldCheck,
    title: "Commercial licence",
    body: "Use every asset in client work, ads and monetised videos.",
  },
  {
    icon: Zap,
    title: "Built for speed",
    body: "Modular presets that drop straight onto your timeline.",
  },
  {
    icon: Layers,
    title: "Lifetime updates",
    body: "Every future version of a pack you own is free, forever.",
  },
];

const stats = [
  { icon: Users, value: 4190, label: "Active editors", sub: "creating worldwide", suffix: "+" },
  { icon: Heart, value: 12655, label: "Happy buyers", sub: "and counting every hour", suffix: "" },
  { icon: ShoppingBag, value: 318, label: "Daily sales", sub: "across every pack", suffix: "" },
];

const AURORA_COLORS = ["#ffd6eb", "#ff9acb", "#ff5aa6", "#ff2d78", "#00000000"];

function Landing() {
  const { products } = Route.useLoaderData() as { products: DbProduct[] };
  const { isIndependenceMode } = useIndependenceMode();
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  const handleStartLevelUp = (e: React.MouseEvent) => {
    if (isIndependenceMode) {
      e.preventDefault();
      setShowModal(true);
    }
  };

  return (
    <SiteLayout>
      {/* Cinematic hero — black aurora + real-product floating showcase */}
      <section className="relative -mt-[72px] min-h-[100svh] overflow-hidden bg-black text-white sm:-mt-20">
        {/* z0 — Aurora bars */}
        <AuroraBars
          className="z-[0]"
          barCount={24}
          colors={AURORA_COLORS}
          maxHeightRatio={0.92}
          minHeightRatio={0.18}
          speed={0.5}
          gap={3}
          blur={0}
          background="#000000"
        />
        {/* z1 — dark overlay */}
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{ background: "rgba(0,0,0,0.30)" }}
        />
        {/* z2 — real product imagery */}
        <HeroShowcase products={products} />
        {/* z2 — bottom fade into the next (black) section */}
        <div
          className="pointer-events-none absolute inset-0 z-[2]"
          style={{
            background: "linear-gradient(to bottom, transparent 55%, #000000 100%)",
          }}
        />

        {/* z3 — hero content */}
        <div className="relative z-[3] flex min-h-[100svh] flex-col items-center justify-center px-6 pb-32 pt-32 text-center sm:pt-40">
          <span className="animate-rise-in liquid-glass inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.28em] text-white/60">
            The Editor's Digital Store
          </span>

          <h1 className="animate-rise-in mt-6 max-w-5xl font-display text-[clamp(2.7rem,7.4vw,6rem)] font-extrabold leading-[0.98] text-white text-balance-tight [text-shadow:0_10px_40px_rgba(0,0,0,0.5)]">
            Upgrade Your Edits.
            <br />
            Create Without{" "}
            <span className="font-serif italic font-normal text-white">Limits.</span>
          </h1>

          <p
            className="animate-rise-in mt-6 max-w-2xl text-balance-tight text-base text-white/70 sm:text-lg"
            style={{ animationDelay: "120ms" }}
          >
            Premium presets, transitions, SFX and creative assets built to make your
            editing workflow faster, cleaner and more powerful.
          </p>

          <div
            className="animate-rise-in mt-10 flex flex-wrap items-center justify-center gap-4"
            style={{ animationDelay: "220ms" }}
          >
            <Link
              to="/store"
              onClick={handleStartLevelUp}
              className="btn-shine group inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 font-display text-sm font-bold uppercase tracking-wider text-black shadow-[0_20px_50px_-18px_rgba(255,255,255,0.5)]"
            >
              Explore products
              <ArrowUpRight
                className="size-4 transition-transform duration-500 ease-[var(--ease-macos)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                strokeWidth={2.2}
              />
            </Link>
            <Link
              to="/store"
              className="liquid-glass inline-flex items-center gap-2 rounded-full px-8 py-4 font-display text-sm font-bold uppercase tracking-wider text-white transition-transform duration-500 hover:scale-[1.03] active:scale-95"
            >
              View bundles
            </Link>
          </div>
        </div>

        {/* Independence Day Modal (preserved from the previous hero) */}
        {showModal && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}
            onClick={() => setShowModal(false)}
          >
            <div
              className="animate-rise-in relative w-full max-w-lg overflow-hidden rounded-4xl shadow-float"
              style={{
                background: "linear-gradient(135deg, #FF9933 0%, #FFFFFF 48%, #138808 100%)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* White content area */}
              <div className="m-1 rounded-[calc(var(--radius)+12px)] bg-white/92 px-8 py-10 text-center backdrop-blur-xl">
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setShowModal(false)}
                  className="absolute right-5 top-5 flex size-9 items-center justify-center rounded-full bg-white/70 text-ink/60 transition-colors hover:bg-white hover:text-ink"
                >
                  <X className="size-5" strokeWidth={1.8} />
                </button>
                <span className="text-6xl" role="img" aria-label="Indian flag">
                  🇮🇳
                </span>
                <h2 className="mt-4 font-display text-3xl font-extrabold text-ink">
                  Happy 80th Independence Day!
                </h2>
                <p className="mt-3 text-base text-ink/70">
                  Celebrate India's freedom with exclusive creative assets. Level up your
                  storytelling with our premium packs — now available in the store!
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      void navigate({ to: "/store" });
                    }}
                    className="btn-shine inline-flex items-center justify-center gap-2 rounded-full px-8 py-4 font-display text-base font-semibold text-white shadow-float"
                    style={{ background: "linear-gradient(135deg, #FF9933, #138808)" }}
                  >
                    🛍️ Shop Independence Day Deals
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="rounded-full border border-ink/20 px-8 py-4 font-display text-base font-semibold text-ink/70 transition-colors hover:bg-black/5"
                  >
                    Maybe later
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Stats — numbers count up when this section scrolls into view */}
      <section className="mx-auto mt-24 max-w-[1600px] px-6 lg:px-12">
        <div className="grid gap-6 sm:grid-cols-3">
          {stats.map((stat, i) => (
            <Reveal key={stat.label} delay={i * 130} variant="blur">
              <div className="glass morph-card rounded-4xl px-8 py-10">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-white/60 text-violet-deep">
                  <stat.icon className="size-5" strokeWidth={1.7} />
                </span>
                <p className="mt-6 font-display text-[clamp(2.4rem,4vw,3.4rem)] font-extrabold leading-none text-ink">
                  <CountUp value={stat.value} suffix={stat.suffix} />
                </p>
                <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-violet-deep">
                  {stat.label}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.sub}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Product preview videos — optional per product, set in the admin panel */}
      <VideoCarousel products={products} />

      {/* Perks */}
      <section id="how-it-works" className="mx-auto mt-24 max-w-[1600px] px-6 lg:px-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {perks.map((perk, i) => (
            <Reveal key={perk.title} delay={i * 100} variant="scale">
              <div className="glass morph-card h-full rounded-4xl p-7">
                <span className="flex size-12 items-center justify-center rounded-2xl bg-white/60 text-violet-deep">
                  <perk.icon className="size-6" strokeWidth={1.6} />
                </span>
                <h3 className="mt-5 font-display text-lg font-extrabold text-ink">{perk.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{perk.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section className="mx-auto mt-24 max-w-[1600px] px-6 lg:px-12">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-deep">
              Featured
            </p>
            <h2 className="mt-2 font-display text-4xl font-extrabold text-ink sm:text-5xl">
              Packs editors keep coming back for.
            </h2>
          </div>
          <Link
            to="/store"
            className="glass press-pop rounded-full px-6 py-3 font-display text-sm font-semibold text-ink"
          >
            Browse the full store
          </Link>
        </Reveal>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((product, i) => (
            <Reveal key={product.slug} delay={i * 90} variant="scale">
              <ProductCard product={product} index={i} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* Social proof */}
      <section className="mx-auto mt-24 max-w-[1600px] px-6 lg:px-12">
        <Reveal variant="blur">
          <div className="glass morph-card rounded-4xl px-8 py-12 text-center sm:px-16">
            <div className="flex items-center justify-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="size-5 fill-accent text-accent" strokeWidth={1.4} />
              ))}
            </div>
            <p className="mx-auto mt-6 max-w-3xl text-balance-tight font-display text-2xl font-extrabold leading-snug text-ink sm:text-3xl">
              “I replaced four subscriptions with Editly Store. Everything is clean, fast and it
              just works in my timeline.”
            </p>
            <p className="mt-5 text-sm font-medium text-muted-foreground">
              Ishaan Verma — Motion designer, 8.6k creators served
            </p>
          </div>
        </Reveal>
      </section>
    </SiteLayout>
  );
}

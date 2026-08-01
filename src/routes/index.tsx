import { createFileRoute, Link } from "@tanstack/react-router";
import { Zap, ShieldCheck, Download, Layers, Star, Users, Heart, ShoppingBag } from "lucide-react";
import cardFan from "@/assets/card-fan-4k.webp";
import { SiteLayout } from "@/components/site/SiteLayout";
import { ProductCard } from "@/components/site/ProductCard";
import { Reveal, CountUp } from "@/components/site/Reveal";
import { VideoCarousel } from "@/components/site/VideoCarousel";
import { getStoreProducts } from "@/lib/catalog.functions";

export const Route = createFileRoute("/")({
  loader: async () => ({ products: await getStoreProducts() }),
  head: () => ({
    links: [{ rel: "preload", as: "image", href: cardFan, fetchpriority: "high" }],
    meta: [
      { title: "Editly Store — Premium After Effects, LUT & SFX Packs" },
      {
        name: "description",
        content:
          "Editly Store sells premium digital assets for editors: After Effects project files, extensions, cinematic LUTs and SFX packs. Instant download after payment.",
      },
      { property: "og:title", content: "Editly Store — Premium Editing Assets" },
      {
        property: "og:description",
        content: "After Effects packs, extensions, LUTs and SFX packs for editors who ship fast.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});


const perks = [
  { icon: Download, title: "Instant delivery", body: "Your download link lands the second your payment clears." },
  { icon: ShieldCheck, title: "Commercial licence", body: "Use every asset in client work, ads and monetised videos." },
  { icon: Zap, title: "Built for speed", body: "Modular presets that drop straight onto your timeline." },
  { icon: Layers, title: "Lifetime updates", body: "Every future version of a pack you own is free, forever." },
];

const stats = [
  { icon: Users, value: 4190, label: "Active editors", sub: "creating worldwide", suffix: "+" },
  { icon: Heart, value: 12655, label: "Happy buyers", sub: "and counting every hour", suffix: "" },
  { icon: ShoppingBag, value: 318, label: "Daily sales", sub: "across every pack", suffix: "" },
];



function Landing() {
  const { products } = Route.useLoaderData() as { products: DbProduct[] };

  return (

    <SiteLayout>
      {/* Hero */}
      <section className="relative mx-auto max-w-[1600px] px-6 pb-10 pt-8 lg:px-12">
        <h1 className="animate-rise-in mx-auto max-w-5xl text-balance-tight text-center font-display text-[clamp(2.6rem,7.2vw,5.6rem)] font-extrabold leading-[0.98] text-ink">
          A place to level up your skills.
        </h1>

        <div className="relative mx-auto mt-6 max-w-5xl">
          <span
            className="animate-rise-in animate-float-slow absolute left-[8%] -top-8 z-20 rounded-3xl rounded-bl-md bg-[#2f7bff] px-5 py-2.5 font-display text-lg font-semibold text-white shadow-lift sm:text-xl"
            style={{ animationDelay: "300ms" }}
          >
            @accio
          </span>
          <span
            className="animate-rise-in animate-float-slow absolute right-[6%] -top-3 z-20 rounded-3xl rounded-br-md bg-[#5f9a7a] px-5 py-2.5 font-display text-lg font-semibold text-white shadow-lift sm:text-xl"
            style={{ animationDelay: "460ms", animationDuration: "8.5s" }}
          >

            @gracian
          </span>

          <img
            src={cardFan}
            alt="A fan of artwork covers from the Editly Store asset library"
            width={3840}
            height={1060}
            className="animate-rise-in animate-drift relative z-10 w-full select-none drop-shadow-[0_40px_70px_rgba(70,40,120,0.35)]"
            style={{ animationDelay: "160ms" }}
          />
        </div>

        <p
          className="animate-rise-in mt-8 text-center text-lg font-medium text-ink/80 sm:text-xl"
          style={{ animationDelay: "520ms" }}
        >
          Stop wasting time creating everything from scratch.
        </p>

        <div
          className="animate-rise-in mt-8 flex flex-wrap items-center justify-center gap-6"
          style={{ animationDelay: "620ms" }}
        >
          <Link
            to="/store"
            className="btn-shine rounded-full bg-primary px-9 py-4 font-display text-base font-semibold text-primary-foreground shadow-float"
          >
            Start Level Up.
          </Link>
          <Link
            to="/read-more"
            className="text-base font-semibold text-ink/85 underline-offset-8 transition-colors hover:text-ink hover:underline"
          >
            Read more
          </Link>
        </div>

        {/* Zero-gravity chips floating below the CTA */}
        <div className="mt-14 flex flex-wrap items-center justify-center gap-4">
          {[
            "After Effects packs",
            "Cinematic LUTs",
            "Panel extensions",
            "SFX libraries",
            "Instant download",
          ].map((chip, i) => (
            <span
              key={chip}
              className="glass animate-rise-in animate-zero-g press-pop rounded-full px-6 py-3 font-display text-sm font-semibold text-ink"
              style={{
                animationDelay: `${700 + i * 110}ms, ${i * 900}ms`,
                animationDuration: `0.8s, ${12 + i * 1.4}s`,
              }}
            >
              {chip}
            </span>
          ))}
        </div>
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
                <p className="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-violet-deep">{stat.label}</p>
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
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-deep">Featured</p>
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
              “I replaced four subscriptions with Editly Store. Everything is clean, fast and it just works in my
              timeline.”
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

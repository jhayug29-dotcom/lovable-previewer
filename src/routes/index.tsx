import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { motion } from "motion/react";
import { Film, Music, Wand2, ArrowUpRight, Star, Check } from "lucide-react";

import { getStoreProducts } from "@/lib/catalog.functions";
import { formatPrice } from "@/lib/products";
import type { DbProduct } from "@/lib/catalog-map";
import { getOrganizationSchema, SITE_URL } from "@/lib/seo";

import { MindloopNav } from "@/components/site/mindloop/MindloopNav";
import { MindloopFooter } from "@/components/site/mindloop/MindloopFooter";
import { ScrollRevealWords } from "@/components/site/mindloop/ScrollRevealWords";
import { LoopMark } from "@/components/site/mindloop/MindloopNav";
import { fadeUp, heroReveal } from "@/components/site/mindloop/anim";
import { useSmoothScroll } from "@/components/site/mindloop/useSmoothScroll";
import { OrbitalImageWheel } from "@/components/site/mindloop/OrbitalImageWheel";
import { KineticText } from "@/components/site/mindloop/KineticText";
import { AvatarCircles } from "@/components/site/mindloop/AvatarCircles";
import { CursorFollow } from "@/components/magic/CursorFollow";
import { Meteors } from "@/components/magic/Meteors";
import { SHIMMER_SURFACE, ShimmerLayers } from "@/components/magic/Shimmer";
import { SilkWave } from "@/components/magic/SilkWave";

// Decorative background clips (muted, aria-hidden). Self-hosted from `public/`
// as plain H.264 MP4 — no CDN and no adaptive-streaming manifest, so the repo
// carries every asset the page needs and any static host can serve it.
const HERO_VIDEO = "/media/hero.mp4";
const MISSION_VIDEO = "/media/mission.mp4";
const SOLUTION_VIDEO = "/media/solution.mp4";

export const Route = createFileRoute("/")({
  loader: async () => ({ products: await getStoreProducts() }),
  head: () => ({
    links: [{ rel: "canonical", href: `${SITE_URL}/` }],
    meta: [
      { title: "Editly Store — Premium Editing Assets for Creators" },
      {
        name: "description",
        content:
          "Editly Store sells premium digital assets for video editors: After Effects presets, cinematic LUTs, panel extensions and royalty-free SFX packs. Instant download, lifetime updates.",
      },
      { property: "og:site_name", content: "Editly Store" },
      { property: "og:title", content: "Editly Store — Premium Editing Assets for Creators" },
      {
        property: "og:description",
        content:
          "Download After Effects packs, cinematic LUTs, panel extensions and SFX libraries for editors who ship fast.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    scripts: [{ type: "application/ld+json", children: JSON.stringify(getOrganizationSchema()) }],
  }),
  component: Landing,
});

// Social-proof faces for the hero avatar stack (decorative). Served from the
// repo so the hero renders with no third-party image requests.
const HERO_AVATARS = [
  { imageUrl: "/media/avatars/editor-1.png" },
  { imageUrl: "/media/avatars/editor-2.jpg" },
  { imageUrl: "/media/avatars/editor-3.png" },
  { imageUrl: "/media/avatars/editor-4.jpg" },
  { imageUrl: "/media/avatars/editor-5.jpg" },
];

// "Editing has changed" — the surfaces editors work across today.
const SURFACES = [
  {
    icon: Wand2,
    name: "After Effects",
    body: "Modular presets and title systems that drop straight onto your timeline.",
  },
  {
    icon: Film,
    name: "Premiere & DaVinci",
    body: "Cinematic LUTs and panel extensions graded on real film scans.",
  },
  {
    icon: Music,
    name: "Sound Design",
    body: "Loudness-matched, royalty-free SFX libraries tagged for instant search.",
  },
];

// Solution feature grid.
const FEATURES = [
  { title: "Curated Packs", body: "Hand-picked assets, no filler. Every file earns its place." },
  { title: "Creator Tools", body: "Control rigs and panels built to shave hours off every edit." },
  { title: "Instant Delivery", body: "Your download link lands the second your payment clears." },
  { title: "Lifetime Updates", body: "Own a pack once — every future version is free, forever." },
];

function Landing() {
  const { products } = Route.useLoaderData() as { products: DbProduct[] };
  const featured = products.slice(0, 4);
  // Tile every product's cover onto the orbital wheel; repeat the set when the
  // catalog is small so the ring stays visually full (never identical neighbours).
  const wheelImages = useMemo(() => {
    const base = products.map((p) => ({ src: p.cover, alt: p.title, label: p.title }));
    if (base.length === 0) return [];
    const target = 22;
    const repeats = Math.max(1, Math.ceil(target / base.length));
    return Array.from({ length: repeats * base.length }, (_, i) => base[i % base.length]!);
  }, [products]);

  useSmoothScroll();

  return (
    <div id="top" className="mindloop min-h-screen bg-background font-inter text-foreground">
      <MindloopNav />

      {/* ============================================ 1 · HERO
          Reference framing: copy sits in the dark upper band, the cinematic
          scene fills the lower two-thirds, and a soft fade closes the seam into
          the black section below. */}
      <section className="relative flex min-h-[94vh] flex-col overflow-hidden">
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover object-[center_50%]"
        >
          <source src={HERO_VIDEO} type="video/mp4" />
        </video>
        {/* Dark behind the headline (top), clears through the middle-lower so the
            scene shows, then hands off to the closing fade below. This layer no
            longer tries to finish the job at its own last stop — it used to end at
            `background/80`, which left the video ~20% visible right at the clip
            edge and produced a hard horizontal line across the page. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-background/85 from-[8%] via-background/20 via-[52%] to-background/25 to-[100%]" />
        {/* The closing fade: a tall five-stop ramp that reaches fully opaque black
            exactly at the section's bottom edge, so the scene dissolves into the
            black section below instead of being cut off by it. Five stops rather
            than three — a linear ramp still shows a knee where it hits black,
            because perceived brightness is not linear in alpha. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-80 bg-[linear-gradient(to_top,#000_0%,rgba(0,0,0,0.94)_16%,rgba(0,0,0,0.7)_38%,rgba(0,0,0,0.34)_64%,rgba(0,0,0,0.1)_84%,transparent_100%)] md:h-[26rem]" />

        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col px-5 pt-28 text-center sm:px-8 md:pt-32">
          {/* Avatar stack */}
          <motion.div {...heroReveal(0)} className="mb-6 flex items-center justify-center gap-3">
            <AvatarCircles avatarUrls={HERO_AVATARS} />
            <span className="text-sm text-muted-foreground">500+ editors already creating</span>
          </motion.div>

          {/* Two lines, each revealed on its own beat: "Create" / "without limits". */}
          <h1 className="text-5xl font-medium leading-[1.02] tracking-[-2px] md:text-7xl lg:text-8xl">
            <motion.span {...heroReveal(0.12)} className="block">
              Create
            </motion.span>
            <motion.span {...heroReveal(0.26)} className="block">
              without <span className="font-instrument font-normal italic">limits</span>
            </motion.span>
          </h1>

          <motion.p
            {...heroReveal(0.42)}
            className="mx-auto mt-6 max-w-xl text-lg"
            style={{ color: "hsl(var(--hero-subtitle))", willChange: "transform, opacity, filter" }}
          >
            Premium assets for editors and motion designers — presets, LUTs, extensions and SFX,
            crafted to help you ship faster and finish stronger.
          </motion.p>

          {/* Explore Assets — directly beneath the heading text */}
          <motion.div {...heroReveal(0.54)} className="mt-10 flex justify-center">
            <Link
              to="/store"
              className={`${SHIMMER_SURFACE} group inline-flex items-center gap-2 rounded-full bg-foreground px-10 py-4 text-sm font-semibold tracking-wide text-background transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]`}
            >
              {/* Dark spark on a white pill: the backdrop matches `--foreground`
                  so only a hairline of the travelling highlight shows at the rim. */}
              <ShimmerLayers
                background="var(--foreground)"
                shimmerColor="rgba(0, 0, 0, 0.75)"
                shimmerSize="1.5px"
              />
              Explore Assets
              <ArrowUpRight
                className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                strokeWidth={1.8}
              />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ============================================ 2 · EDITING HAS CHANGED */}
      <section id="how-it-works" className="px-5 pb-6 pt-24 sm:px-8 md:px-16 md:pb-9 md:pt-32 lg:px-28">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="text-5xl leading-[1.02] tracking-[-1px] md:text-7xl lg:text-8xl">
            <KineticText text="Editing has changed. Have you?" highlight={["changed."]} />
          </h2>
          <motion.p {...fadeUp(0.1)} className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            The tools moved on. The assets that feed them should too — built for the way editors
            actually work in 2026.
          </motion.p>
        </div>

        {/* Orbital product wheel — auto-spins on a slow, seamless loop directly
            beneath the heading. Full-bleed: the negative margins cancel the
            section's horizontal padding so the arc runs edge to edge.
            `yaw` mounts each card tangentially on the ring so it turns away from
            the viewer toward the ends of the arc — that 3D turn is what makes it
            read as an orbit rather than a conveyor belt. Landscape tiles match the
            4:3 product covers, so nothing is cropped. Out-of-focus cards keep
            full brightness and colour; the only softening is the arc's own ends
            dissolving into the page. */}
        <OrbitalImageWheel
          images={wheelImages}
          autoplay
          turns={2}
          itemWidth={212}
          itemHeight={146}
          yaw={32}
          autoplayDuration={190}
          blur={0}
          dim={100}
          brightnessBoost={0}
          minSaturation={100}
          className="-mx-5 mb-4 bg-transparent sm:-mx-8 md:-mx-16 lg:-mx-28"
        />

        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-12 md:mt-16 md:grid-cols-3 md:gap-8">
          {SURFACES.map((s, i) => (
            <motion.div key={s.name} {...fadeUp(0.1 + i * 0.08)} className="text-center">
              <div className="liquid-glass mx-auto flex h-24 w-24 items-center justify-center rounded-3xl">
                <s.icon className="h-9 w-9 text-foreground" strokeWidth={1.4} />
              </div>
              <h3 className="mt-6 text-base font-semibold">{s.name}</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">{s.body}</p>
            </motion.div>
          ))}
        </div>

        <motion.p {...fadeUp(0.3)} className="mt-20 text-center text-sm text-muted-foreground">
          If you don't sharpen your edge, someone else will.
        </motion.p>
      </section>

      {/* ============================================ 3 · MISSION (scroll reveal) */}
      <section className="px-5 pb-32 pt-0 sm:px-8 md:px-16 md:pb-44 lg:px-28">
        <div className="mx-auto flex max-w-3xl flex-col items-center">
          {/* The floating island element. `CursorFollow` makes it drift slowly
              toward the pointer while hovered and glide back on leave — only
              transforms animate, so the copy below never reflows. */}
          <CursorFollow strength={0.16} tilt={9} className="mb-16 w-full max-w-[600px]">
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-hidden="true"
              className="w-full rounded-2xl object-cover"
            >
              <source src={MISSION_VIDEO} type="video/mp4" />
            </video>
          </CursorFollow>

          <ScrollRevealWords
            className="text-center text-2xl font-medium tracking-[-1px] md:text-4xl lg:text-5xl"
            text="We're building a place where craft meets speed — where editors find depth, creators find reach, and every project becomes work worth sharing."
            highlight={["craft", "meets", "speed"]}
          />

          <ScrollRevealWords
            className="mt-10 text-center text-xl font-medium md:text-2xl lg:text-3xl"
            text="A store where assets, tools and taste come together — with less busywork, less friction, and more room for the part you love."
          />
        </div>
      </section>

      {/* ============================================ 4 · SOLUTION */}
      <section className="border-t border-border/30 px-5 py-32 sm:px-8 md:px-16 md:py-44 lg:px-28">
        <div className="mx-auto max-w-6xl">
          <motion.p
            {...fadeUp(0)}
            className="text-xs uppercase tracking-[3px] text-muted-foreground"
          >
            Solution
          </motion.p>
          <motion.h2 {...fadeUp(0.08)} className="mt-4 max-w-3xl text-4xl tracking-tight md:text-6xl">
            The store for{" "}
            <span className="font-instrument font-normal italic">meaningful</span> assets
          </motion.h2>

          <motion.div {...fadeUp(0.16)} className="mt-14 overflow-hidden rounded-2xl">
            <video
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-hidden="true"
              className="aspect-[3/1] w-full object-cover"
            >
              <source src={SOLUTION_VIDEO} type="video/mp4" />
            </video>
          </motion.div>

          <div className="mt-16 grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-4 md:gap-8">
            {FEATURES.map((f, i) => (
              <motion.div key={f.title} {...fadeUp(0.1 + i * 0.06)}>
                <h3 className="text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================ 5 · COLLECTIONS (real products) */}
      <section id="collections" className="border-t border-border/30 px-5 py-32 sm:px-8 md:px-16 md:py-44 lg:px-28">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <motion.h2 {...fadeUp(0)} className="text-4xl tracking-tight md:text-6xl">
              Packs editors{" "}
              <span className="font-instrument font-normal italic">keep</span> reaching for
            </motion.h2>
            <motion.div {...fadeUp(0.08)}>
              <Link
                to="/store"
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
              >
                Browse the full store
                <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} />
              </Link>
            </motion.div>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((product, i) => (
              <motion.div key={product.slug} {...fadeUp(0.06 * i)}>
                <DarkProductCard product={product} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================ 6 · REVIEWS
          The one full-black band on the page, so this is where the grey meteor
          shower lives. `relative overflow-hidden` scopes the shower to this
          section — it never spills into the sections above or below. */}
      <section
        id="reviews"
        className="relative overflow-hidden border-t border-border/30 px-5 py-32 sm:px-8 md:px-16 md:py-44 lg:px-28"
      >
        <Meteors number={30} />
        <motion.div {...fadeUp(0)} className="relative z-10 mx-auto max-w-3xl text-center">
          <div className="flex items-center justify-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-4 w-4 fill-foreground text-foreground" strokeWidth={1.2} />
            ))}
          </div>
          <p className="mt-8 text-2xl font-medium leading-snug tracking-[-0.5px] md:text-3xl">
            “I replaced four subscriptions with Editly Store. Everything is clean, fast, and it just
            works in my timeline.”
          </p>
          <p className="mt-6 text-sm text-muted-foreground">
            Ishaan Verma — Motion designer, 8,600+ creators served
          </p>
        </motion.div>
      </section>

      {/* ============================================ 7 · CTA (silk wave background)
          No `border-t` here: the sections above and below are black, so a
          hairline rule would only draw attention to a seam the fade already
          dissolves. */}
      <section className="relative overflow-hidden px-5 py-32 sm:px-8 md:px-16 md:py-44 lg:px-28">
        {/* The flowing lavender ribbon, drawn live in a shader rather than shipped
            as a clip — it fills any viewport, loops seamlessly and costs no bytes.
            The vertical mask is what stops the band being guillotined by the
            section edges: it is fully transparent at the very top and bottom, so
            the ribbon dissolves into the black of the reviews section above and
            the footer below instead of ending on a line. */}
        {/* The mask is written out twice, inline, rather than hoisted to a module
            constant: TanStack Start splits this route's component into its own
            chunk, and an identifier referenced only from inside a nested object
            literal did not survive that split (`CTA_FADE is not defined`). */}
        <div
          aria-hidden="true"
          style={{
            maskImage:
              "linear-gradient(to bottom, transparent 0%, #000 22%, #000 78%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, #000 22%, #000 78%, transparent 100%)",
          }}
          className="absolute inset-0 z-0"
        >
          <SilkWave speed={1} />
        </div>
        {/* One flat scrim for legibility, as in the reference. It is pure black at
            28%, so it cannot lift the ribbon's blacks — it only pulls the lit face
            down far enough for white copy to sit on it. The dark radial halo that
            used to sit on top of this is gone: it read as a smudge over the text. */}
        <div className="absolute inset-0 z-[1] bg-background/28" />

        {/* The copy carries its own contrast rather than relying on a darker
            overlay: a soft black text-shadow travels with the glyphs, so it holds
            up wherever the ribbon's near-white crease happens to pass behind them
            and the background stays clean everywhere else. */}
        <div
          className="relative z-10 mx-auto flex max-w-2xl flex-col items-center text-center [text-shadow:0_1px_2px_rgba(0,0,0,0.55),0_2px_22px_rgba(0,0,0,0.85)]"
        >
          <LoopMark outer="w-10 h-10" inner="w-5 h-5" />
          <h2 className="mt-8 text-4xl tracking-tight md:text-6xl">
            Start your{" "}
            <span className="font-instrument font-normal italic">journey</span>
          </h2>
          <p className="mt-5 max-w-lg text-foreground/85">
            Join thousands of editors leveling up their craft with assets built to move fast and
            look expensive.
          </p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <Link
              to="/store"
              className="inline-flex items-center gap-2 rounded-lg bg-foreground px-8 py-3.5 text-sm font-semibold text-background transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]"
            >
              <Check className="h-4 w-4" strokeWidth={2} />
              Shop the store
            </Link>
            <a
              href="#collections"
              className="liquid-glass inline-flex items-center rounded-lg px-8 py-3.5 text-sm font-semibold text-foreground transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]"
            >
              See collections
            </a>
          </div>
        </div>
      </section>

      <MindloopFooter />
    </div>
  );
}

/** Monochrome product tile for the dark landing — links to the real product page. */
function DarkProductCard({ product }: { product: DbProduct }) {
  const discount =
    product.originalPrice > product.price
      ? Math.round((1 - product.price / product.originalPrice) * 100)
      : 0;

  return (
    <Link
      to="/product/$slug"
      params={{ slug: product.slug }}
      aria-label={`View ${product.title} — ${product.category}`}
      className={`${SHIMMER_SURFACE} group block rounded-2xl border border-border/60 bg-card transition-colors duration-200 hover:border-border`}
    >
      {/* Card-level shimmer, hover-only: a highlight travels the card's rim
          instead of animating permanently across four tiles at once. */}
      <ShimmerLayers background="var(--card)" shimmerDuration="2.4s" onHoverOnly />

      <div className="relative z-10 aspect-[4/3] overflow-hidden rounded-t-2xl">
        {/* Covers render in full colour — the previous grayscale filter (which
            read as a black overlay lifting on hover) is gone. */}
        <img
          src={product.cover}
          alt={`${product.title} — ${product.category}`}
          loading="lazy"
          width={1024}
          height={768}
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
        {discount > 0 && (
          <span className="absolute right-3 top-3 rounded-full bg-foreground px-2.5 py-1 text-[0.7rem] font-bold text-background">
            −{discount}%
          </span>
        )}
      </div>
      <div className="relative z-10 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{product.category}</p>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Star className="h-3 w-3 fill-foreground text-foreground" strokeWidth={1.4} />
            {product.rating}
          </span>
        </div>
        <h3 className="mt-2 text-lg font-semibold leading-tight">{product.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{product.tagline}</p>
        <div className="mt-4 flex items-end justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-semibold">
              {product.isFree ? "Free" : formatPrice(product.price)}
            </span>
            {discount > 0 && (
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(product.originalPrice)}
              </span>
            )}
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 text-foreground transition-transform duration-300 group-hover:rotate-45">
            <ArrowUpRight className="h-4 w-4" strokeWidth={1.8} />
          </span>
        </div>
      </div>
    </Link>
  );
}

import { useEffect, useMemo, useRef } from "react";
import { Link } from "@tanstack/react-router";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { ArrowUpRight } from "lucide-react";
import type { DbProduct } from "@/lib/catalog-map";
import { formatPrice } from "@/lib/products";

type Depth = "bg" | "mid" | "fg";

const DEPTH_META = {
  bg: { x: 12, y: 8, scroll: 90, blur: "blur(2px)", opacity: 0.72 },
  mid: { x: 24, y: 18, scroll: 160, blur: "blur(0px)", opacity: 0.9 },
  fg: { x: 38, y: 28, scroll: 260, blur: "blur(0px)", opacity: 1 },
} as const;

type Slot = {
  depth: Depth;
  pos: string;
  hide?: string;
  width: string;
  dur: number;
  delay: number;
  entranceDelay: number;
  main?: boolean;
};

const SLOTS: Slot[] = [
  {
    depth: "fg",
    pos: "left-1/2 top-[56%] -translate-x-1/2 -translate-y-1/2",
    width: "w-[46vw] max-w-[400px] min-w-[190px] sm:w-[30vw] lg:w-[26vw]",
    dur: 7,
    delay: 0,
    entranceDelay: 0.1,
    main: true,
  },
  {
    depth: "bg",
    pos: "left-[3%] top-[30%]",
    hide: "hidden sm:block",
    width: "w-[19vw] max-w-[250px] min-w-[130px]",
    dur: 8,
    delay: 1.6,
    entranceDelay: 0.42,
  },
  {
    depth: "mid",
    pos: "left-[8%] bottom-[12%]",
    width: "w-[30vw] max-w-[320px] min-w-[150px] sm:w-[24vw]",
    dur: 6,
    delay: 2.3,
    entranceDelay: 0.3,
  },
  {
    depth: "mid",
    pos: "right-[7%] top-[28%]",
    hide: "hidden sm:block",
    width: "w-[23vw] max-w-[320px] min-w-[150px]",
    dur: 6.6,
    delay: 0.9,
    entranceDelay: 0.5,
  },
  {
    depth: "fg",
    pos: "right-[3%] bottom-[10%]",
    width: "w-[34vw] max-w-[360px] min-w-[175px] sm:w-[27vw]",
    dur: 7.5,
    delay: 3,
    entranceDelay: 0.35,
  },
  {
    depth: "bg",
    pos: "left-[17%] top-[9%]",
    hide: "hidden lg:block",
    width: "w-[16vw] max-w-[230px] min-w-[120px]",
    dur: 8.5,
    delay: 1.1,
    entranceDelay: 0.6,
  },
  {
    depth: "bg",
    pos: "right-[19%] top-[11%]",
    hide: "hidden lg:block",
    width: "w-[17vw] max-w-[240px] min-w-[120px]",
    dur: 7.2,
    delay: 2,
    entranceDelay: 0.55,
  },
];

function badgeRank(p: DbProduct): number {
  const b = (p.badge ?? "").toLowerCase();
  if (b.includes("featured")) return 0;
  if (b.includes("best")) return 1;
  if (b.includes("new")) return 2;
  return 3;
}

/** Featured > Best Seller > New, then by sales — never invents new fields. */
export function prioritizeProducts(products: DbProduct[]): DbProduct[] {
  return [...products].sort((a, b) => badgeRank(a) - badgeRank(b) || b.sales - a.sales);
}

type FloatingProps = {
  product: DbProduct;
  slot: Slot;
  index: number;
  mx: MotionValue<number>;
  my: MotionValue<number>;
  scroll: MotionValue<number>;
  reduced: boolean | null;
};

function FloatingProduct({ product, slot, index, mx, my, scroll, reduced }: FloatingProps) {
  const meta = DEPTH_META[slot.depth];
  const px = useTransform(mx, (v) => v * meta.x * 2);
  const py = useTransform([my, scroll], (latest) => {
    const [myv, scv] = latest as [number, number];
    return myv * meta.y * 2 + scv * (reduced ? 0 : meta.scroll);
  });

  const discount =
    product.originalPrice > product.price
      ? Math.round((1 - product.price / product.originalPrice) * 100)
      : 0;

  const spring = { type: "spring", stiffness: 240, damping: 18 } as const;

  const hoverProps = reduced
    ? { whileHover: {} as Record<string, never> }
    : { whileHover: { scale: 1.04, rotate: 1, filter: "blur(0px)", opacity: 1 } };

  return (
    <div className={`absolute ${slot.pos} ${slot.hide ?? ""}`}>
      <motion.div className="will-change-transform" style={{ x: px, y: py }}>
        <motion.div
          className="will-change-transform"
          style={{ width: slot.width }}
          initial={reduced ? { opacity: 1 } : { opacity: 0, y: 40, scale: 0.75, filter: "blur(12px)" }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: slot.entranceDelay }}
        >
          <motion.div
            className="will-change-transform"
            style={{ transformOrigin: "50% 50%" }}
            animate={
              reduced ? { y: 0, rotate: 0, scale: 1 } : { y: [0, -10, 0], rotate: [-1, 1, -1], scale: [1, 1.015, 1] as const }
            }
            transition={
              reduced
                ? { duration: 0 }
                : { duration: slot.dur, repeat: Infinity, ease: "easeInOut" as const, delay: slot.delay > 0 ? -slot.delay : 0 }
            }
          >
            <motion.div
              initial={false}
              className="group relative"
              style={{ filter: meta.blur, opacity: meta.opacity }}
              transition={spring}
              {...hoverProps}
            >
              <Link
                to="/product/$slug"
                params={{ slug: product.slug }}
                aria-label={`View ${product.title} - ${product.category}`}
                className="block"
              >
                <div className="liquid-glass overflow-hidden rounded-3xl p-2 shadow-[0_30px_60px_-24px_rgba(0,0,0,0.7)]">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
                    <img
                      src={product.cover}
                      alt={`${product.title} - ${product.category} cover`}
                      loading="lazy"
                      decoding="async"
                      width={640}
                      height={480}
                      className="size-full object-cover"
                    />
                    {discount > 0 && !product.isFree ? (
                      <span className="absolute right-2 top-2 rounded-full bg-[#ff2d78] px-2.5 py-1 text-[0.65rem] font-bold text-white shadow-lg">
                        -{discount}%
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Liquid-glass hover info card with REAL product data */}
                <div className="liquid-glass pointer-events-none absolute inset-x-1.5 bottom-1.5 translate-y-2 rounded-2xl p-3.5 opacity-0 transition-all duration-300 ease-[var(--ease-macos)] group-hover:translate-y-0 group-hover:opacity-100">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-white/60">
                      {product.category}
                    </p>
                    {product.badge ? (
                      <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-wide text-white/70">
                        {product.badge}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 truncate font-display text-sm font-extrabold text-white">
                    {product.title}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="font-display text-base font-extrabold text-white">
                      {product.isFree ? "Free" : formatPrice(product.price)}
                    </span>
                    {discount > 0 ? (
                      <span className="text-xs text-white/50 line-through">
                        {formatPrice(product.originalPrice)}
                      </span>
                    ) : null}
                  </div>
                  <span className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-[0.62rem] font-bold uppercase tracking-wider text-white/90 backdrop-blur-sm">
                    View product <ArrowUpRight className="size-3" strokeWidth={2.4} />
                  </span>
                </div>
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}

/**
 * Real-product floating composition for the hero. Renders 3–7 live catalogue
 * covers (Featured > Best Seller > New priority), with depth, entrance, float,
 * mouse parallax and scroll parallax. Respects prefers-reduced-motion.
 */
export function HeroShowcase({ products }: { products: DbProduct[] }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const reduced = useReducedMotion();

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });

  useEffect(() => {
    const node = ref.current;
    if (!node || reduced) return;
    const isCoarse =
      typeof window !== "undefined" &&
      (window.matchMedia("(pointer: coarse)").matches || "ontouchstart" in window);
    if (isCoarse) return; // disable mouse parallax on touch devices
    const onMove = (e: MouseEvent) => {
      const rect = node.getBoundingClientRect();
      mx.set((e.clientX - rect.left) / rect.width - 0.5);
      my.set((e.clientY - rect.top) / rect.height - 0.5);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [mx, my, reduced]);

  const ordered = useMemo(
    () => prioritizeProducts(products).slice(0, SLOTS.length),
    [products],
  );

  return (
    <div ref={ref} className="pointer-events-none absolute inset-0 z-[2]">
      <div className="pointer-events-none absolute inset-0">
        {ordered.map((p, i) => {
          const slot = SLOTS[i];
          if (!slot) return null;
          return (
            <div key={p.slug} className="pointer-events-auto">
              <FloatingProduct
                product={p}
                slot={slot}
                index={i}
                mx={mx}
                my={my}
                scroll={scrollYProgress}
                reduced={reduced}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default HeroShowcase;

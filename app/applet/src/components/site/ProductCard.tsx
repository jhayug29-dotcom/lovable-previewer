import { Link } from "@tanstack/react-router";
import { Star, ArrowUpRight } from "lucide-react";
import { formatPrice, type Product } from "@/lib/products";
import { MagicGlow } from "@/components/magic/MagicGlow";
import { SHIMMER_SURFACE, ShimmerLayers } from "@/components/magic/Shimmer";

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const discount =
    product.originalPrice > product.price
      ? Math.round((1 - product.price / product.originalPrice) * 100)
      : 0;

  return (
    <Link
      to="/product/$slug"
      params={{ slug: product.slug }}
      aria-label={`View ${product.title} - ${product.category}`}
      className="group glass hover-pop animate-rise-in relative isolate block overflow-hidden rounded-4xl p-3"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* The hover glow. Direct child on purpose: it binds its pointer tracking
          to `parentElement`. Clipped to this card's rounded box and pinned to
          z-0, so it lights the surface behind the copy and never over it. */}
      <MagicGlow />

      <div className="relative z-10 aspect-4/3 overflow-hidden rounded-3xl">
        <img
          src={product.cover}
          alt={`${product.title} - ${product.category} preset`}
          loading="lazy"
          width={1024}
          height={768}
          className="size-full object-cover transition-transform duration-[900ms] ease-[var(--ease-macos)] group-hover:scale-[1.06]"
        />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/25 to-transparent opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
        {product.badge ? (
          <span className="glass absolute left-3 top-3 rounded-full px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-wide text-ink">
            {product.badge}
          </span>
        ) : null}
        {discount > 0 ? (
          <span className="absolute right-3 top-3 rounded-full bg-accent px-3 py-1 text-[0.7rem] font-bold text-accent-foreground shadow-lift">
            -{discount}%
          </span>
        ) : null}
      </div>

      <div className="relative z-10 px-3 pb-2 pt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {product.category}
          </p>
          <span className="flex items-center gap-1 text-xs font-semibold text-ink/80">
            <Star className="size-3.5 fill-accent text-accent" strokeWidth={1.6} />
            {product.rating}
            <span className="font-normal text-muted-foreground">({product.reviewCount})</span>
          </span>
        </div>
        <h3 className="mt-2 font-display text-xl font-extrabold text-ink">{product.title}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{product.tagline}</p>

        <div className="mt-4 flex items-end justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-extrabold text-ink">
              {product.isFree ? "Free" : formatPrice(product.price)}
            </span>
            {discount > 0 ? (
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(product.originalPrice)}
              </span>
            ) : null}
          </div>
          <span
            className={`${SHIMMER_SURFACE} flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform duration-500 ease-[var(--ease-macos)] group-hover:scale-110 group-hover:-rotate-12`}
          >
            {/* Backdrop matches the pill's own fill, so the spark only ever
                shows through as a hairline travelling around its rim. */}
            <ShimmerLayers background="var(--primary)" shimmerDuration="2.6s" />
            <ArrowUpRight className="size-5" strokeWidth={1.8} />
          </span>
        </div>
      </div>
    </Link>
  );
}

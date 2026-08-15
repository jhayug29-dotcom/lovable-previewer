import { useRef } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, PlayCircle, ArrowUpRight } from "lucide-react";
import { Reveal } from "./Reveal";
import { formatPrice, type Product } from "@/lib/products";

/**
 * Product preview videos. Only products that have a video (set per product in the
 * admin panel) show up here — the section hides itself when none do.
 */
export function VideoCarousel({ products }: { products: Product[] }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const withVideo = products.filter((p) => Boolean(p.videoUrl));

  if (withVideo.length === 0) return null;

  const scrollBy = (dir: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: dir * Math.min(track.clientWidth * 0.8, 720), behavior: "smooth" });
  };

  return (
    <section className="mx-auto mt-24 max-w-[1600px] px-6 lg:px-12">
      <Reveal className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-violet-deep">
            In motion
          </p>
          <h2 className="mt-2 font-display text-4xl font-extrabold text-ink sm:text-5xl">
            See the packs move.
          </h2>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label="Previous video"
            className="glass press-pop flex size-12 items-center justify-center rounded-full text-ink"
          >
            <ChevronLeft className="size-5" strokeWidth={1.9} />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label="Next video"
            className="glass press-pop flex size-12 items-center justify-center rounded-full text-ink"
          >
            <ChevronRight className="size-5" strokeWidth={1.9} />
          </button>
        </div>
      </Reveal>

      <div
        ref={trackRef}
        className="no-scrollbar mt-10 flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth pb-4"
      >
        {withVideo.map((product, i) => (
          <Reveal
            key={product.slug}
            delay={i * 90}
            variant="scale"
            className="min-w-[86%] snap-center sm:min-w-[62%] lg:min-w-[46%]"
          >
            <Link
              to="/product/$slug"
              params={{ slug: product.slug }}
              className="group glass morph-card block rounded-4xl p-4"
            >
              <div className="relative overflow-hidden rounded-3xl bg-black/80">
                <video
                  src={product.videoUrl ?? undefined}
                  poster={product.cover}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  className="aspect-video w-full object-cover"
                  onMouseEnter={(e) => void e.currentTarget.play().catch(() => {})}
                  onMouseLeave={(e) => {
                    e.currentTarget.pause();
                    e.currentTarget.currentTime = 0;
                  }}
                />
                <span className="glass pointer-events-none absolute bottom-4 left-4 flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold text-ink opacity-100 transition-opacity duration-500 group-hover:opacity-0">
                  <PlayCircle className="size-4" strokeWidth={1.8} />
                  Hover to play
                </span>
              </div>
              <div className="flex items-end justify-between gap-4 px-3 pb-1 pt-5">
                <div>
                  <h3 className="font-display text-xl font-extrabold text-ink">{product.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{product.tagline}</p>
                </div>
                <span className="flex shrink-0 items-center gap-1 font-display text-lg font-extrabold text-ink">
                  {product.isFree ? "Free" : formatPrice(product.price)}
                  <ArrowUpRight
                    className="size-4 transition-transform duration-500 ease-[var(--ease-macos)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    strokeWidth={2.1}
                  />
                </span>
              </div>
            </Link>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

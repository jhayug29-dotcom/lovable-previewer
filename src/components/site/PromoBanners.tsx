import { useQuery } from "@tanstack/react-query";
import { getStorePromos } from "@/lib/catalog.functions";
import type { StoreBanner, StoreSale } from "@/lib/sales";

type Promos = { sale: StoreSale | null; banners: StoreBanner[] };

/** Festive banners + live sale strip. Fails silently when nothing is scheduled. */
export function PromoBanners() {
  const { data } = useQuery<Promos>({
    queryKey: ["store-promos"],
    queryFn: () => getStorePromos(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const banners = data?.banners ?? [];
  const sale = data?.sale ?? null;
  if (banners.length === 0 && !sale) return null;

  return (
    <div className="mx-auto mt-6 max-w-[1600px] space-y-3 px-6 lg:px-12">
      {sale ? (
        <div className="animate-rise-in flex flex-wrap items-center gap-3 rounded-3xl bg-primary px-6 py-3.5 text-primary-foreground shadow-lift">
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider">
            {sale.badge_label || "Sale"}
          </span>
          <p className="font-display text-sm font-bold sm:text-base">{sale.title}</p>
          <p className="text-sm opacity-85">
            {sale.sale_type === "flat"
              ? `Everything in the offer at ₹${sale.flat_price ?? 0}`
              : `${sale.percent_off ?? 0}% off`}
            {sale.ends_at
              ? ` · ends ${new Date(sale.ends_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
              : ""}
          </p>
        </div>
      ) : null}

      {banners.map((banner, i) => {
        const content = banner.image_url ? (
          // Image banners render as a 16:9 media card (capped on wide screens).
          <div
            className="animate-rise-in relative aspect-video max-h-[440px] w-full overflow-hidden rounded-4xl shadow-lift transition-transform duration-500 hover:-translate-y-0.5"
            style={{ animationDelay: `${i * 70}ms`, color: banner.text_color || "#FFFFFF" }}
          >
            <img
              src={banner.image_url}
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              className="absolute inset-0 size-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
            <div className="relative flex h-full flex-col justify-end gap-2 p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-4">
                {banner.emoji ? <span className="text-3xl">{banner.emoji}</span> : null}
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-extrabold sm:text-2xl">{banner.title}</p>
                  {banner.subtitle ? (
                    <p className="mt-1 text-sm opacity-90">{banner.subtitle}</p>
                  ) : null}
                </div>
                {banner.cta_label ? (
                  <span className="rounded-full bg-white/25 px-5 py-2.5 font-display text-sm font-semibold backdrop-blur">
                    {banner.cta_label}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ) : (
          <div
            className="animate-rise-in relative overflow-hidden rounded-4xl px-7 py-6 shadow-lift transition-transform duration-500 hover:-translate-y-0.5"
            style={{
              animationDelay: `${i * 70}ms`,
              backgroundImage: `linear-gradient(120deg, ${banner.bg_from || "#7C3AED"}, ${banner.bg_to || "#DB2777"})`,
              color: banner.text_color || "#FFFFFF",
            }}
          >
            <div className="relative flex flex-wrap items-center gap-4">
              {banner.emoji ? <span className="text-3xl">{banner.emoji}</span> : null}
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-extrabold sm:text-2xl">{banner.title}</p>
                {banner.subtitle ? (
                  <p className="mt-1 text-sm opacity-90">{banner.subtitle}</p>
                ) : null}
              </div>
              {banner.cta_label ? (
                <span className="rounded-full bg-white/25 px-5 py-2.5 font-display text-sm font-semibold backdrop-blur">
                  {banner.cta_label}
                </span>
              ) : null}
            </div>
          </div>
        );

        return banner.link_url ? (
          <a key={banner.id} href={banner.link_url} className="block">
            {content}
          </a>
        ) : (
          <div key={banner.id}>{content}</div>
        );
      })}
    </div>
  );
}

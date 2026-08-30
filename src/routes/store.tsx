import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search, SlidersHorizontal } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { ProductCard } from "@/components/site/ProductCard";
import { PromoBanners } from "@/components/site/PromoBanners";
import { StoreGreeting } from "@/components/site/StoreGreeting";
import { SupportChat } from "@/components/site/SupportChat";
import { categories, type Category } from "@/lib/products";
import { getStoreProducts } from "@/lib/catalog.functions";
import type { DbProduct } from "@/lib/catalog-map";

import { getCollectionSchema, SITE_URL } from "@/lib/seo";

export const Route = createFileRoute("/store")({
  loader: async () => ({ products: await getStoreProducts() }),
  head: ({ loaderData }) => {
    const products = (loaderData as { products: DbProduct[] } | undefined)?.products ?? [];
    return {
      links: [{ rel: "canonical", href: `${SITE_URL}/store` }],
      meta: [
        { title: "Editly Store — Premium Video Editing Assets & After Effects Presets" },
        {
          name: "description",
          content:
            "Browse every Editly Store pack: After Effects project files, motion presets, cinematic LUTs, Premiere Pro extensions, and royalty-free SFX. Instant download and commercial license.",
        },
        { property: "og:site_name", content: "Editly Store" },
        {
          property: "og:title",
          content: "Editly Store — Premium Video Editing Assets & After Effects Presets",
        },
        {
          property: "og:description",
          content:
            "Search and filter premium editing assets: After Effects presets, LUTs, extensions and SFX packs.",
        },
        { property: "og:type", content: "website" },
        { property: "og:url", content: `${SITE_URL}/store` },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "Editly Store — Premium Video Editing Assets" },
        {
          name: "twitter:description",
          content:
            "Search and filter premium editing assets: After Effects presets, LUTs, extensions and SFX packs.",
        },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(getCollectionSchema(products)),
        },
      ],
    };
  },
  component: StorePage,
});

type SortKey = "popular" | "price-low" | "price-high" | "rating";

const sortOptions: { key: SortKey; label: string }[] = [
  { key: "popular", label: "Most popular" },
  { key: "price-low", label: "Price: low to high" },
  { key: "price-high", label: "Price: high to low" },
  { key: "rating", label: "Top rated" },
];

function StorePage() {
  const { products } = Route.useLoaderData() as { products: DbProduct[] };
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | "All">("All");
  const [sort, setSort] = useState<SortKey>("popular");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = products.filter((p) => {
      const matchesQuery =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);
      const matchesCategory = category === "All" || p.category === category;
      return matchesQuery && matchesCategory;
    });

    return [...filtered].sort((a, b) => {
      if (sort === "price-low") return a.price - b.price;
      if (sort === "price-high") return b.price - a.price;
      if (sort === "rating") return b.rating - a.rating;
      return b.sales - a.sales;
    });
  }, [products, query, category, sort]);

  return (
    <SiteLayout dark>
      <PromoBanners />
      <StoreGreeting />
      <section className="mx-auto max-w-[1600px] px-6 pt-6 lg:px-12">
        <h1 className="animate-rise-in max-w-3xl font-display text-[clamp(2.2rem,5vw,4rem)] font-extrabold leading-[1.02] text-ink">
          The store.
        </h1>
        <p
          className="animate-rise-in mt-3 max-w-xl text-lg text-ink/75"
          style={{ animationDelay: "80ms" }}
        >
          Every pack is a one-time purchase with lifetime updates and instant delivery.
        </p>

        {/* Search + filters */}
        <div
          className="glass animate-rise-in mt-10 rounded-4xl p-4"
          style={{ animationDelay: "140ms" }}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.7}
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                type="search"
                placeholder="Search packs, LUTs, extensions…"
                aria-label="Search products"
                className="h-14 w-full rounded-3xl border border-white/60 bg-white/55 pl-14 pr-5 text-base text-ink outline-none transition-all duration-500 placeholder:text-muted-foreground focus:border-accent/60 focus:bg-white/75 focus:ring-4 focus:ring-accent/15"
              />
            </div>

            <div className="relative">
              <SlidersHorizontal
                className="pointer-events-none absolute left-5 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground"
                strokeWidth={1.7}
              />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label="Sort products"
                className="h-14 appearance-none rounded-3xl border border-white/60 bg-white/55 pl-13 pr-8 text-base font-medium text-ink outline-none transition-colors focus:border-accent/60 focus:bg-white/75"
              >
                {sortOptions.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(["All", ...categories] as const).map((item) => {
              const active = category === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-500 ease-[var(--ease-macos)] ${
                    active
                      ? "bg-primary text-primary-foreground shadow-lift"
                      : "bg-white/45 text-ink/75 hover:bg-white/70 hover:text-ink"
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </div>

        <p className="mt-6 text-sm font-medium text-muted-foreground">
          {results.length} {results.length === 1 ? "pack" : "packs"}
          {query ? ` matching “${query}”` : ""}
        </p>

        {results.length > 0 ? (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.map((product, i) => (
              <ProductCard key={product.slug} product={product} index={i} />
            ))}
          </div>
        ) : (
          <div className="glass mt-6 rounded-4xl px-8 py-20 text-center">
            <h2 className="font-display text-2xl font-extrabold text-ink">Nothing here yet</h2>
            <p className="mt-2 text-muted-foreground">
              Try a different search term or clear the filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCategory("All");
              }}
              className="mt-6 rounded-full bg-primary px-7 py-3 font-display text-sm font-semibold text-primary-foreground transition-transform duration-500 hover:scale-105"
            >
              Reset filters
            </button>
          </div>
        )}
      </section>
      <SupportChat />
    </SiteLayout>
  );
}

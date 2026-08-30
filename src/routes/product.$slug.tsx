import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Star, Check, ShieldCheck, ArrowLeft, Share2, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/site/SiteLayout";
import { ProductCard } from "@/components/site/ProductCard";
import { BuyButton } from "@/components/site/BuyButton";
import { formatPrice } from "@/lib/products";
import { getStoreProduct } from "@/lib/catalog.functions";
import type { DbProduct } from "@/lib/catalog-map";

import { getBreadcrumbsSchema, getProductSchema, SITE_URL } from "@/lib/seo";

export const Route = createFileRoute("/product/$slug")({
  loader: async ({ params }) => {
    const { product, related } = await getStoreProduct({ data: { slug: params.slug } });
    if (!product) throw notFound();
    return { product, related };
  },
  head: ({ loaderData }) => {
    const product = loaderData?.product;
    const categorySuffix =
      product?.category === "After Effects"
        ? "After Effects Presets & Assets"
        : `${product?.category ?? "Digital Assets"}`;
    const title = product
      ? `${product.title} — ${categorySuffix} | Editly Store`
      : "Product — Editly Store";
    const description = product
      ? `${product.tagline}. ${product.description.slice(0, 140)}... ${formatPrice(product.price)} one-time purchase with instant download and lifetime updates.`
      : "Premium editing assets from Editly Store.";
    const imageUrl = product?.cover?.startsWith("http")
      ? product.cover
      : product?.cover
        ? `${SITE_URL}${product.cover}`
        : `${SITE_URL}/favicon.png`;
    const canonicalUrl = product ? `${SITE_URL}/product/${product.slug}` : `${SITE_URL}/store`;

    const breadcrumbs = product
      ? [
          { name: "Home", url: `${SITE_URL}/` },
          { name: "Store", url: `${SITE_URL}/store` },
          { name: product.title, url: canonicalUrl },
        ]
      : [];

    return {
      links: [{ rel: "canonical", href: canonicalUrl }],
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:site_name", content: "Editly Store" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { property: "og:url", content: canonicalUrl },
        { property: "og:image", content: imageUrl },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: imageUrl },
      ],
      scripts: product
        ? [
            {
              type: "application/ld+json",
              children: JSON.stringify(getProductSchema(product)),
            },
            {
              type: "application/ld+json",
              children: JSON.stringify(getBreadcrumbsSchema(breadcrumbs)),
            },
          ]
        : [],
    };
  },
  component: ProductPage,
});

function ProductPage() {
  const { product, related } = Route.useLoaderData() as {
    product: DbProduct;
    related: DbProduct[];
  };
  const discount =
    product.originalPrice > 0 ? Math.round((1 - product.price / product.originalPrice) * 100) : 0;

  return (
    <SiteLayout dark>
      <section className="mx-auto max-w-[1600px] px-6 lg:px-12">
        <nav
          aria-label="Breadcrumbs"
          className="mb-4 flex flex-wrap items-center gap-2 text-xs font-medium text-ink/70"
        >
          <Link to="/" className="transition-colors hover:text-ink">
            Home
          </Link>
          <span className="text-ink/40">/</span>
          <Link to="/store" className="transition-colors hover:text-ink">
            Store
          </Link>
          <span className="text-ink/40">/</span>
          <span className="text-ink/60">{product.category}</span>
          <span className="text-ink/40">/</span>
          <span
            className="font-semibold text-ink truncate max-w-[220px] sm:max-w-none"
            aria-current="page"
          >
            {product.title}
          </span>
        </nav>

        <div className="mt-4 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          {/* Banner */}
          <div className="glass animate-rise-in overflow-hidden rounded-4xl p-3">
            <div className="relative aspect-16/10 overflow-hidden rounded-3xl">
              <img
                src={product.cover}
                alt={`${product.title} - ${product.category} pack preview cover for video editors`}
                width={1024}
                height={768}
                className="size-full object-cover"
              />
              <span className="glass absolute left-4 top-4 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink">
                {product.category}
              </span>
              {product.videoUrl ? (
                <a
                  href="#preview-video"
                  className="glass absolute bottom-4 left-4 flex items-center gap-2 rounded-full px-5 py-3 font-display text-sm font-semibold text-ink transition-transform duration-500 hover:scale-105"
                >
                  <PlayCircle className="size-5" strokeWidth={1.7} />
                  Watch preview
                </a>
              ) : null}
            </div>
          </div>

          {/* Buy box */}
          <div
            className="glass animate-rise-in rounded-4xl p-8"
            style={{ animationDelay: "100ms" }}
          >
            <h1 className="font-display text-[clamp(1.9rem,3.4vw,2.9rem)] font-extrabold leading-[1.05] text-ink">
              {product.title}
            </h1>
            <p className="mt-3 text-base text-ink/75">{product.tagline}</p>

            <div className="mt-5 flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1 font-semibold text-ink">
                <Star className="size-4 fill-accent text-accent" strokeWidth={1.5} />
                {product.rating}
              </span>
              <span className="text-muted-foreground">{product.reviewCount} reviews</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">
                {product.sales.toLocaleString("en-IN")} sales
              </span>
            </div>

            <div className="mt-7 flex items-end gap-3">
              <span className="font-display text-4xl font-extrabold text-ink">
                {product.isFree ? "Free" : formatPrice(product.price)}
              </span>
              {discount > 0 ? (
                <>
                  <span className="text-lg text-muted-foreground line-through">
                    {formatPrice(product.originalPrice)}
                  </span>
                  <span className="mb-1 rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">
                    Save {discount}%
                  </span>
                </>
              ) : null}
            </div>

            <BuyButton slug={product.slug} price={product.price} isFree={product.isFree} />
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(window.location.href);
                toast.success("Product link copied");
              }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-white/55 px-8 py-4 font-display text-sm font-semibold text-ink transition-colors duration-500 hover:bg-white/80"
            >
              <Share2 className="size-4" strokeWidth={1.8} />
              Share this product
            </button>

            <p className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="size-4" strokeWidth={1.7} />
              Commercial licence included · Secure Cashfree checkout
            </p>

            <dl className="mt-7 grid grid-cols-2 gap-3">
              {product.fileInfo.map((info) => (
                <div
                  key={info}
                  className="rounded-2xl bg-white/45 px-4 py-3 text-sm font-medium text-ink/80"
                >
                  {info}
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Details */}
        <div className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="glass rounded-4xl p-8">
            <h2 className="font-display text-2xl font-extrabold text-ink">What's inside</h2>
            <p className="mt-4 leading-relaxed text-ink/75">{product.description}</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {product.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2.5 text-sm font-medium text-ink/85"
                >
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                    <Check className="size-3.5" strokeWidth={2.4} />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* How to use */}
          <div className="glass rounded-4xl p-8">
            <h2 className="font-display text-2xl font-extrabold text-ink">How to use</h2>
            <ol className="mt-6 space-y-5">
              {product.howToUse.map((item, i) => (
                <li key={item.step} className="group flex gap-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/70 font-display text-sm font-extrabold text-violet-deep transition-transform duration-500 group-hover:scale-110">
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-display text-base font-bold text-ink">{item.step}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {item.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Preview video — only rendered when this product has one */}
        {product.videoUrl ? (
          <div id="preview-video" className="glass animate-rise-in mt-8 rounded-4xl p-4">
            <h2 className="px-4 pb-4 pt-2 font-display text-2xl font-extrabold text-ink">
              Preview video
            </h2>
            <div className="overflow-hidden rounded-3xl bg-black/80">
              <video
                src={product.videoUrl}
                poster={product.cover}
                controls
                playsInline
                preload="metadata"
                className="aspect-video w-full"
              />
            </div>
          </div>
        ) : null}

        {/* Reviews */}
        <div className="mt-8">
          <h2 className="font-display text-3xl font-extrabold text-ink">Reviews</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {product.reviews.map((review, i) => (
              <div
                key={review.handle}
                className="glass hover-pop animate-rise-in rounded-4xl p-7"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star
                      key={s}
                      className={`size-4 ${s < review.rating ? "fill-accent text-accent" : "text-muted-foreground/40"}`}
                      strokeWidth={1.5}
                    />
                  ))}
                </div>
                <p className="mt-4 leading-relaxed text-ink/85">“{review.body}”</p>
                <div className="mt-5 flex items-center justify-between text-sm">
                  <span className="font-semibold text-ink">
                    {review.name}{" "}
                    <span className="font-normal text-muted-foreground">{review.handle}</span>
                  </span>
                  <span className="text-muted-foreground">{review.date}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Related */}
        <div className="mt-16">
          <h2 className="font-display text-3xl font-extrabold text-ink">You might also like</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item, i) => (
              <ProductCard key={item.slug} product={item} index={i} />
            ))}
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

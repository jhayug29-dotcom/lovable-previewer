import type { DbProduct } from "@/lib/catalog-map";
import type { Product } from "@/lib/products";

export const SITE_URL = "https://editly-store.vercel.app";
export const SITE_NAME = "Editly Store";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/favicon.png`;

export interface MetaTag {
  charSet?: string;
  name?: string;
  property?: string;
  content: string;
}

export interface LinkTag {
  rel: string;
  href: string;
  as?: string;
  type?: string;
  crossOrigin?: "" | "anonymous" | "use-credentials";
}

export interface ScriptTag {
  type: string;
  children: string;
}

/**
 * Builds standard SEO meta tags for a page.
 */
export function createPageMeta({
  title,
  description,
  canonicalUrl,
  ogType = "website",
  ogImage = DEFAULT_OG_IMAGE,
  noIndex = false,
}: {
  title: string;
  description: string;
  canonicalUrl: string;
  ogType?: "website" | "article" | "product";
  ogImage?: string;
  noIndex?: boolean;
}): { meta: MetaTag[]; links: LinkTag[] } {
  const meta: MetaTag[] = [
    { title },
    { name: "description", content: description },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:type", content: ogType },
    { property: "og:url", content: canonicalUrl },
    { property: "og:image", content: ogImage },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: ogImage },
  ];

  if (noIndex) {
    meta.push({ name: "robots", content: "noindex, nofollow" });
  } else {
    meta.push({
      name: "robots",
      content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1",
    });
  }

  const links: LinkTag[] = [{ rel: "canonical", href: canonicalUrl }];

  return { meta, links };
}

/**
 * Schema.org Organization + WebSite JSON-LD for Homepage.
 */
export function getOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/favicon.png`,
        description:
          "Editly Store provides premium digital assets for video editors and motion designers: After Effects presets, project files, cinematic LUTs, Premiere extensions, and royalty-free SFX.",
        sameAs: [],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: "Premium Video Editing Assets & After Effects Presets",
        publisher: {
          "@id": `${SITE_URL}/#organization`,
        },
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_URL}/store?search={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

/**
 * Schema.org Product JSON-LD with authentic reviews and offers.
 */
export function getProductSchema(product: DbProduct | Product) {
  const productUrl = `${SITE_URL}/product/${product.slug}`;
  const imageUrl = product.cover?.startsWith("http")
    ? product.cover
    : product.cover
      ? `${SITE_URL}${product.cover}`
      : DEFAULT_OG_IMAGE;

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${productUrl}#product`,
    name: product.title,
    description: product.description || product.tagline,
    image: [imageUrl],
    category: product.category,
    url: productUrl,
    brand: {
      "@type": "Brand",
      name: SITE_NAME,
    },
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "INR",
      price: product.price,
      priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      itemCondition: "https://schema.org/NewCondition",
      availability: "https://schema.org/InStock",
      seller: {
        "@type": "Organization",
        name: SITE_NAME,
        url: SITE_URL,
      },
    },
  };

  // Only attach genuine reviews that exist in the product data
  if (product.reviews && product.reviews.length > 0) {
    schema["review"] = product.reviews.map((r) => ({
      "@type": "Review",
      author: {
        "@type": "Person",
        name: r.name,
      },
      reviewRating: {
        "@type": "Rating",
        ratingValue: r.rating,
        bestRating: 5,
        worstRating: 1,
      },
      reviewBody: r.body,
    }));
  }

  if (product.rating && product.reviewCount > 0) {
    schema["aggregateRating"] = {
      "@type": "AggregateRating",
      ratingValue: product.rating,
      reviewCount: product.reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return schema;
}

/**
 * Breadcrumbs JSON-LD.
 */
export function getBreadcrumbsSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * CollectionPage / ItemList JSON-LD for Store.
 */
export function getCollectionSchema(products: (DbProduct | Product)[]) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Editly Store — Video Editing Assets Catalog",
    url: `${SITE_URL}/store`,
    description:
      "Browse our full collection of After Effects presets, project files, LUTs, Premiere extensions, and royalty-free SFX packs.",
    mainEntity: {
      "@type": "ItemList",
      itemListElement: products.map((p, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${SITE_URL}/product/${p.slug}`,
        name: p.title,
      })),
    },
  };
}

/**
 * FAQPage JSON-LD.
 */
export function getFAQSchema(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };
}

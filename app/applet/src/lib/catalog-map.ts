import type { Category, Product, Review } from "@/lib/products";

export type DbProduct = Product & { id?: string; banner?: string; downloadLink?: string };

export type Coupon = {
  id: string;
  code: string;
  percent_off: number;
  active: boolean;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
};

export type Banner = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  link_url: string | null;
  active: boolean;
  sort_order: number;
};

export type Sale = {
  id: string;
  title: string;
  description: string | null;
  percent_off: number | null;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

export type Row = Record<string, unknown>;

function mapReview(row: Row): Review {
  return {
    name: String(row["name"] ?? "Anonymous"),
    handle: String(row["handle"] ?? ""),
    rating: Number(row["rating"] ?? 5),
    body: String(row["body"] ?? ""),
    date: new Date(String(row["created_at"] ?? Date.now())).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  };
}

/** Pure row -> product mapper. Safe to import from server and browser code. */
export function mapProduct(row: Row): DbProduct {
  const reviews = Array.isArray(row["reviews"]) ? (row["reviews"] as Row[]).map(mapReview) : [];
  return {
    id: String(row["id"] ?? ""),
    slug: String(row["slug"] ?? ""),
    title: String(row["title"] ?? ""),
    tagline: String(row["tagline"] ?? ""),
    category: String(row["category"] ?? "After Effects") as Category,
    cover: String(row["cover_url"] ?? ""),
    ...(row["banner_url"] ? { banner: String(row["banner_url"]) } : {}),
    ...(row["video_url"] ? { videoUrl: String(row["video_url"]) } : {}),
    ...(row["download_link"] ? { downloadLink: String(row["download_link"]) } : {}),
    isFree: Boolean(row["is_free"]),
    price: Number(row["price"] ?? 0),
    originalPrice: Number(row["original_price"] ?? 0),
    rating: Number(row["rating"] ?? 5),
    reviewCount: reviews.length,
    sales: Number(row["sales"] ?? 0),
    ...(row["badge"] ? { badge: String(row["badge"]) } : {}),
    fileInfo: (row["file_info"] as string[] | null) ?? [],
    description: String(row["description"] ?? ""),
    features: (row["features"] as string[] | null) ?? [],
    howToUse: (row["how_to_use"] as { step: string; detail: string }[] | null) ?? [],
    reviews,
  };
}

export const PRODUCT_SELECT = "*, reviews(*)";

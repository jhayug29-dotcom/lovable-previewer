import { useEffect, useMemo, useState } from "react";
import { createFileRoute, notFound } from "@tanstack/react-router";


import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Package,
  Ticket,
  Image as ImageIcon,
  Megaphone,
  Shield,
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  Save,
  Lock,
  LifeBuoy,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/site/SiteLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { generateAiReviews } from "@/lib/store.functions";
import {
  checkAdminAccess,
  grantAdminAccess,
  listAdminUsers,
  revokeAdminAccess,
} from "@/lib/admin.functions";

import { categories } from "@/lib/products";
import { DEFAULT_SETTINGS, fetchSettings, saveSettings, type SiteSettings } from "@/lib/settings";

export const Route = createFileRoute("/admin")({
  ssr: false,
  // Server-verified gate: anyone who isn't an admin gets the standard 404 page,
  // so the panel's existence is never revealed.
  beforeLoad: async () => {
    if (!isSupabaseConfigured || !supabase) return;
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    const { admin } = await checkAdminAccess({ data: { accessToken } });
    if (!admin) throw notFound();
  },
  head: () => ({
    meta: [
      { title: "Admin — Editly Store" },
      { name: "description", content: "Manage Editly Store products, coupons, banners, sales and admins." },
      { property: "og:title", content: "Admin — Editly Store" },
      { property: "og:description", content: "Editly Store control panel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminPage,
});

const TABS = [
  { id: "products", label: "Products", icon: Package },
  { id: "reviews", label: "AI reviews", icon: Sparkles },
  { id: "coupons", label: "Coupons", icon: Ticket },
  { id: "banners", label: "Banners", icon: ImageIcon },
  { id: "sales", label: "Sales", icon: Megaphone },
  { id: "support", label: "Support inbox", icon: MessageCircle },
  { id: "settings", label: "Contact", icon: LifeBuoy },
  { id: "admins", label: "Admins", icon: Shield },
] as const;

type TabId = (typeof TABS)[number]["id"];

function AdminPage() {
  const { loading } = useAuth();
  const [tab, setTab] = useState<TabId>("products");

  if (loading) {
    return (
      <SiteLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-ink/60" />
        </div>
      </SiteLayout>
    );
  }


  return (
    <SiteLayout>
      <section className="mx-auto max-w-[1600px] px-6 pb-24 lg:px-12">
        <h1 className="font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold text-ink">Control panel</h1>
        <p className="mt-2 text-sm text-muted-foreground">Everything on the storefront, managed from here.</p>

        <div className="glass mt-7 flex flex-wrap gap-1 rounded-full p-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-500 ease-[var(--ease-macos)] ${
                tab === t.id ? "bg-primary text-primary-foreground shadow-lift" : "text-ink/75 hover:bg-white/50"
              }`}
            >
              <t.icon className="size-4" strokeWidth={1.8} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-7">
          {tab === "products" ? <ProductsTab /> : null}
          {tab === "reviews" ? <ReviewsTab /> : null}
          {tab === "coupons" ? <CouponsTab /> : null}
          {tab === "banners" ? <BannersTab /> : null}
          {tab === "sales" ? <SalesTab /> : null}
          {tab === "support" ? <SupportTab /> : null}
          {tab === "settings" ? <SettingsTab /> : null}
          {tab === "admins" ? <AdminsTab /> : null}
        </div>
      </section>
    </SiteLayout>
  );
}

/* ---------------------------------------------------------------- helpers */

function Card({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="glass animate-rise-in rounded-4xl p-7">
      <h2 className="font-display text-xl font-extrabold text-ink">{title}</h2>
      <div className="mt-5 space-y-3">{children}</div>
    </div>
  );
}

const inputCls =
  "w-full rounded-2xl bg-white/65 px-4 py-3 text-sm font-medium text-ink outline-none transition-colors focus:bg-white/90 placeholder:text-muted-foreground";

function Text({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls}
      />
    </label>
  );
}

function Area({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <textarea value={value} rows={3} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    </label>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between rounded-2xl bg-white/55 px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-white/75"
    >
      {label}
      <span
        className={`relative h-6 w-11 rounded-full transition-colors duration-500 ${value ? "bg-primary" : "bg-ink/20"}`}
      >
        <span
          className={`absolute top-0.5 size-5 rounded-full bg-white transition-all duration-500 ease-[var(--ease-macos)] ${
            value ? "left-5.5" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function PrimaryButton({
  children,
  onClick,
  busy,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="btn-shine flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 font-display text-sm font-semibold text-primary-foreground shadow-float transition-all duration-500 hover:-translate-y-0.5 disabled:opacity-60"
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

function useTable<T>(table: string, order = "created_at") {
  return useQuery<T[]>({
    queryKey: [table],
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase.from(table).select("*").order(order, { ascending: false });
      if (error) throw error;
      return (data ?? []) as T[];
    },
  });
}


function useSave(table: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Record<string, unknown>) => {
      if (!supabase) throw new Error("Backend not connected");
      const { error } = row['id']
        ? await supabase.from(table).update(row).eq("id", row['id'] as string)
        : await supabase.from(table).insert(row);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      void qc.invalidateQueries({ queryKey: [table] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });
}

function useRemove(table: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!supabase) throw new Error("Backend not connected");
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      void qc.invalidateQueries({ queryKey: [table] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });
}

function RowList<T extends { id: string }>({
  rows,
  render,
  onDelete,
}: {
  rows: T[];
  render: (row: T) => React.ReactNode;
  onDelete: (id: string) => void;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">Nothing here yet.</p>;
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li
          key={row.id}
          className="flex items-center justify-between gap-3 rounded-2xl bg-white/55 px-4 py-3 text-sm text-ink transition-colors hover:bg-white/75"
        >
          <span className="min-w-0 flex-1 truncate">{render(row)}</span>
          <button
            type="button"
            onClick={() => onDelete(row.id)}
            aria-label="Delete"
            className="text-muted-foreground transition-colors hover:text-destructive"
          >
            <Trash2 className="size-4" strokeWidth={1.8} />
          </button>
        </li>
      ))}
    </ul>
  );
}

/* --------------------------------------------------------------- products */

type ProductRow = {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  description: string;
  category: string;
  cover_url: string | null;
  banner_url: string | null;
  video_url: string | null;
  download_link: string | null;
  price: number;
  original_price: number;
  is_free: boolean;
  badge: string | null;
  features: string[];
  file_info: string[];
  how_to_use: { step: string; detail: string }[];
  active: boolean;
  sales: number;
};

const emptyProduct = {
  slug: "",
  title: "",
  tagline: "",
  description: "",
  category: "After Effects",
  cover_url: "",
  banner_url: "",
  video_url: "",
  download_link: "",
  price: "0",
  original_price: "0",
  badge: "",
  features: "",
  file_info: "",
  how_to_use: "",
  is_free: false,
  active: true,
};

function ProductsTab() {
  const { data: rows = [] } = useTable<ProductRow>("products");
  const save = useSave("products");
  const remove = useRemove("products");
  const [form, setForm] = useState({ ...emptyProduct, id: "" });

  const set = (key: keyof typeof form) => (v: string | boolean) => setForm((f) => ({ ...f, [key]: v }));

  const load = (row: ProductRow) =>
    setForm({
      id: row.id,
      slug: row.slug,
      title: row.title,
      tagline: row.tagline ?? "",
      description: row.description ?? "",
      category: row.category,
      cover_url: row.cover_url ?? "",
      banner_url: row.banner_url ?? "",
      video_url: row.video_url ?? "",
      download_link: row.download_link ?? "",
      price: String(row.price),
      original_price: String(row.original_price),
      badge: row.badge ?? "",
      features: (row.features ?? []).join("\n"),
      file_info: (row.file_info ?? []).join("\n"),
      how_to_use: (row.how_to_use ?? []).map((s) => `${s.step} | ${s.detail}`).join("\n"),
      is_free: row.is_free,
      active: row.active,
    });

  const submit = () => {
    if (!form.slug || !form.title) {
      toast.error("Slug and title are required");
      return;
    }
    const lines = (v: string) => v.split("\n").map((s) => s.trim()).filter(Boolean);
    save.mutate({
      ...(form.id ? { id: form.id } : {}),
      slug: form.slug.trim(),
      title: form.title.trim(),
      tagline: form.tagline,
      description: form.description,
      category: form.category,
      cover_url: form.cover_url || null,
      banner_url: form.banner_url || null,
      video_url: form.video_url || null,
      download_link: form.download_link || null,
      price: form.is_free ? 0 : Number(form.price || 0),
      original_price: Number(form.original_price || 0),
      is_free: form.is_free,
      badge: form.badge || null,
      features: lines(form.features),
      file_info: lines(form.file_info),
      how_to_use: lines(form.how_to_use).map((l) => {
        const [step, detail = ""] = l.split("|");
        return { step: (step ?? "").trim(), detail: detail.trim() };
      }),
      active: form.active,
    });
    setForm({ ...emptyProduct, id: "" });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card title={form.id ? "Edit product" : "Add a product"}>
        <Text label="Title" value={form.title} onChange={set("title") as (v: string) => void} />
        <Text label="Slug (URL)" value={form.slug} onChange={set("slug") as (v: string) => void} placeholder="aurora-motion-pack" />
        <Text label="Tagline" value={form.tagline} onChange={set("tagline") as (v: string) => void} />
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Category
          </span>
          <select
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            className={inputCls}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <Area label="Description" value={form.description} onChange={set("description") as (v: string) => void} />
        <div className="grid grid-cols-2 gap-3">
          <Text label="Selling price (₹)" type="number" value={form.price} onChange={set("price") as (v: string) => void} />
          <Text
            label="Original price (₹)"
            type="number"
            value={form.original_price}
            onChange={set("original_price") as (v: string) => void}
          />
        </div>
        <Toggle label="Free product (no payment)" value={form.is_free} onChange={set("is_free") as (v: boolean) => void} />
        <Text label="Badge" value={form.badge} onChange={set("badge") as (v: string) => void} placeholder="Bestseller" />
        <Text label="Cover image URL" value={form.cover_url} onChange={set("cover_url") as (v: string) => void} />
        <Text label="Banner image URL" value={form.banner_url} onChange={set("banner_url") as (v: string) => void} />
        <Text label="Preview video URL" value={form.video_url} onChange={set("video_url") as (v: string) => void} />
        <Text label="Download link (sent after payment)" value={form.download_link} onChange={set("download_link") as (v: string) => void} />
        <Area label="Features (one per line)" value={form.features} onChange={set("features") as (v: string) => void} />
        <Area label="File info (one per line)" value={form.file_info} onChange={set("file_info") as (v: string) => void} />
        <Area
          label="How to use (one per line: Step | Detail)"
          value={form.how_to_use}
          onChange={set("how_to_use") as (v: string) => void}
        />
        <Toggle label="Visible on the storefront" value={form.active} onChange={set("active") as (v: boolean) => void} />
        <PrimaryButton onClick={submit} busy={save.isPending}>
          {form.id ? <Save className="size-4" strokeWidth={1.9} /> : <Plus className="size-4" strokeWidth={1.9} />}
          {form.id ? "Save changes" : "Add product"}
        </PrimaryButton>
        {form.id ? (
          <button
            type="button"
            onClick={() => setForm({ ...emptyProduct, id: "" })}
            className="w-full text-center text-xs text-muted-foreground hover:text-ink"
          >
            Cancel editing
          </button>
        ) : null}
      </Card>

      <Card title={`Catalog (${rows.length})`}>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No products in the database yet.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white/55 px-4 py-3 transition-colors hover:bg-white/75"
              >
                <button type="button" onClick={() => load(row)} className="min-w-0 flex-1 text-left">
                  <p className="truncate font-display text-sm font-bold text-ink">{row.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.category} · {row.is_free ? "Free" : `₹${row.price}`} · {row.active ? "live" : "hidden"}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => remove.mutate(row.id)}
                  aria-label="Delete product"
                  className="text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="size-4" strokeWidth={1.8} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------ AI reviews */

function ReviewsTab() {
  const { session } = useAuth();
  const { data: rows = [] } = useTable<ProductRow>("products");
  const generate = useServerFn(generateAiReviews);
  const qc = useQueryClient();
  const [productId, setProductId] = useState("");
  const [description, setDescription] = useState("");
  const [count, setCount] = useState("5");
  const [busy, setBusy] = useState(false);

  const product = useMemo(() => rows.find((r) => r.id === productId), [rows, productId]);

  const run = async () => {
    if (!product) {
      toast.error("Pick a product first");
      return;
    }
    setBusy(true);
    try {
      const reviews = await generate({
        data: {
          ...(session?.access_token ? { accessToken: session.access_token } : {}),
          productId: product.id,
          productTitle: product.title,
          description: description || product.description || product.tagline,
          count: Number(count),
          save: true,
        },
      });
      toast.success(`${reviews.length} reviews added`);
      void qc.invalidateQueries({ queryKey: ["reviews"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card title="Generate reviews with AI">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Product
          </span>
          <select value={productId} onChange={(e) => setProductId(e.target.value)} className={inputCls}>
            <option value="">Select a product…</option>
            {rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>
        <Area label="What should the reviews talk about?" value={description} onChange={setDescription} />
        <Text label="How many reviews (1–12)" type="number" value={count} onChange={setCount} />
        <PrimaryButton onClick={() => void run()} busy={busy}>
          <Sparkles className="size-4" strokeWidth={1.9} />
          Generate & publish
        </PrimaryButton>
      </Card>
      <Card title="Existing reviews">
        <ReviewList />
      </Card>
    </div>
  );
}

type ReviewRow = { id: string; name: string; handle: string; rating: number; body: string };

function ReviewList() {
  const { data: rows = [] } = useTable<ReviewRow>("reviews");
  const remove = useRemove("reviews");
  return (
    <RowList
      rows={rows}
      onDelete={(id) => remove.mutate(id)}
      render={(r) => (
        <>
          <span className="font-semibold">{r.name}</span>{" "}
          <span className="text-muted-foreground">
            {r.handle} · {r.rating}★ — {r.body}
          </span>
        </>
      )}
    />
  );
}

/* ---------------------------------------------------------------- coupons */

type CouponRow = { id: string; code: string; percent_off: number; active: boolean; max_uses: number | null };

function CouponsTab() {
  const { data: rows = [] } = useTable<CouponRow>("coupons");
  const save = useSave("coupons");
  const remove = useRemove("coupons");
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("10");
  const [maxUses, setMaxUses] = useState("");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card title="Create a coupon">
        <Text label="Code" value={code} onChange={(v) => setCode(v.toUpperCase())} placeholder="EDITLY20" />
        <Text label="Discount %" type="number" value={percent} onChange={setPercent} />
        <Text label="Max uses (blank = unlimited)" type="number" value={maxUses} onChange={setMaxUses} />
        <PrimaryButton
          busy={save.isPending}
          onClick={() => {
            if (!code) {
              toast.error("Enter a code");
              return;
            }
            save.mutate({
              code: code.trim(),
              percent_off: Number(percent),
              max_uses: maxUses ? Number(maxUses) : null,
              active: true,
            });
            setCode("");
          }}
        >
          <Plus className="size-4" strokeWidth={1.9} />
          Create coupon
        </PrimaryButton>
      </Card>
      <Card title={`Coupons (${rows.length})`}>
        <RowList
          rows={rows}
          onDelete={(id) => remove.mutate(id)}
          render={(c) => (
            <>
              <span className="font-display font-bold">{c.code}</span>{" "}
              <span className="text-muted-foreground">
                {c.percent_off}% off · {c.active ? "active" : "off"}
              </span>
            </>
          )}
        />
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------- banners */

type BannerRow = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  link_url: string | null;
  emoji: string | null;
  cta_label: string | null;
  bg_from: string | null;
  bg_to: string | null;
  text_color: string | null;
  active: boolean;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
};

const FESTIVE_PRESETS: { name: string; emoji: string; from: string; to: string; text: string }[] = [
  { name: "Diwali", emoji: "\u{1FA94}", from: "#F59E0B", to: "#DC2626", text: "#FFFFFF" },
  { name: "Holi", emoji: "\u{1F3A8}", from: "#EC4899", to: "#22C55E", text: "#FFFFFF" },
  { name: "New Year", emoji: "\u{1F386}", from: "#0F172A", to: "#6366F1", text: "#FFFFFF" },
  { name: "Christmas", emoji: "\u{1F384}", from: "#166534", to: "#B91C1C", text: "#FFFFFF" },
  { name: "Independence Day", emoji: "\u{1F1EE}\u{1F1F3}", from: "#F97316", to: "#16A34A", text: "#FFFFFF" },
  { name: "Mega sale", emoji: "\u{1F525}", from: "#7C3AED", to: "#DB2777", text: "#FFFFFF" },
];

const emptyBanner = {
  id: "",
  title: "",
  subtitle: "",
  image_url: "",
  link_url: "",
  emoji: "",
  cta_label: "",
  bg_from: "#7C3AED",
  bg_to: "#DB2777",
  text_color: "#FFFFFF",
  sort_order: "0",
  starts_at: "",
  ends_at: "",
  active: true,
};

function toLocalInput(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function BannersTab() {
  const { data: rows = [] } = useTable<BannerRow>("banners");
  const save = useSave("banners");
  const remove = useRemove("banners");
  const [form, setForm] = useState({ ...emptyBanner });

  const set = (key: keyof typeof form) => (v: string | boolean) => setForm((f) => ({ ...f, [key]: v }));

  const load = (row: BannerRow) =>
    setForm({
      id: row.id,
      title: row.title,
      subtitle: row.subtitle ?? "",
      image_url: row.image_url ?? "",
      link_url: row.link_url ?? "",
      emoji: row.emoji ?? "",
      cta_label: row.cta_label ?? "",
      bg_from: row.bg_from ?? "#7C3AED",
      bg_to: row.bg_to ?? "#DB2777",
      text_color: row.text_color ?? "#FFFFFF",
      sort_order: String(row.sort_order ?? 0),
      starts_at: toLocalInput(row.starts_at),
      ends_at: toLocalInput(row.ends_at),
      active: row.active,
    });

  const submit = () => {
    if (!form.title) {
      toast.error("Enter a title");
      return;
    }
    save.mutate({
      ...(form.id ? { id: form.id } : {}),
      title: form.title,
      subtitle: form.subtitle,
      image_url: form.image_url || null,
      link_url: form.link_url || null,
      emoji: form.emoji,
      cta_label: form.cta_label,
      bg_from: form.bg_from,
      bg_to: form.bg_to,
      text_color: form.text_color,
      sort_order: Number(form.sort_order || 0),
      starts_at: toIso(form.starts_at),
      ends_at: toIso(form.ends_at),
      active: form.active,
    });
    setForm({ ...emptyBanner });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card title={form.id ? "Edit festive banner" : "Create a festive banner"}>
        <div className="flex flex-wrap gap-2">
          {FESTIVE_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() =>
                setForm((f) => ({ ...f, emoji: p.emoji, bg_from: p.from, bg_to: p.to, text_color: p.text }))
              }
              className="rounded-full px-4 py-2 text-xs font-bold text-white shadow-lift transition-transform hover:scale-105"
              style={{ backgroundImage: `linear-gradient(120deg, ${p.from}, ${p.to})` }}
            >
              {p.emoji} {p.name}
            </button>
          ))}
        </div>

        <Text label="Headline" value={form.title} onChange={set("title") as (v: string) => void} placeholder="Diwali sale is live" />
        <Text label="Subtitle" value={form.subtitle} onChange={set("subtitle") as (v: string) => void} />
        <div className="grid grid-cols-2 gap-3">
          <Text label="Emoji" value={form.emoji} onChange={set("emoji") as (v: string) => void} />
          <Text label="Button text" value={form.cta_label} onChange={set("cta_label") as (v: string) => void} placeholder="Shop the sale" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Text label="Colour from" type="color" value={form.bg_from} onChange={set("bg_from") as (v: string) => void} />
          <Text label="Colour to" type="color" value={form.bg_to} onChange={set("bg_to") as (v: string) => void} />
          <Text label="Text colour" type="color" value={form.text_color} onChange={set("text_color") as (v: string) => void} />
        </div>
        <Text label="Background image URL (optional)" value={form.image_url} onChange={set("image_url") as (v: string) => void} />
        <Text label="Link URL (optional)" value={form.link_url} onChange={set("link_url") as (v: string) => void} />
        <div className="grid grid-cols-2 gap-3">
          <Text label="Starts" type="datetime-local" value={form.starts_at} onChange={set("starts_at") as (v: string) => void} />
          <Text label="Ends" type="datetime-local" value={form.ends_at} onChange={set("ends_at") as (v: string) => void} />
        </div>
        <Text label="Sort order" type="number" value={form.sort_order} onChange={set("sort_order") as (v: string) => void} />
        <Toggle label="Show on the storefront" value={form.active} onChange={set("active") as (v: boolean) => void} />

        <div
          className="rounded-3xl px-6 py-5"
          style={{
            backgroundImage: `linear-gradient(120deg, ${form.bg_from}, ${form.bg_to})`,
            color: form.text_color,
          }}
        >
          <p className="font-display text-lg font-extrabold">
            {form.emoji} {form.title || "Live preview"}
          </p>
          {form.subtitle ? <p className="mt-1 text-sm opacity-90">{form.subtitle}</p> : null}
        </div>

        <PrimaryButton onClick={submit} busy={save.isPending}>
          {form.id ? <Save className="size-4" strokeWidth={1.9} /> : <Plus className="size-4" strokeWidth={1.9} />}
          {form.id ? "Save banner" : "Add banner"}
        </PrimaryButton>
        {form.id ? (
          <button
            type="button"
            onClick={() => setForm({ ...emptyBanner })}
            className="w-full text-center text-xs text-muted-foreground hover:text-ink"
          >
            Cancel editing
          </button>
        ) : null}
      </Card>

      <Card title={`Banners (${rows.length})`}>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No banners yet.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white/55 px-4 py-3 transition-colors hover:bg-white/75"
              >
                <button type="button" onClick={() => load(row)} className="min-w-0 flex-1 text-left">
                  <p className="truncate font-display text-sm font-bold text-ink">
                    {row.emoji} {row.title}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.active ? "live" : "hidden"}
                    {row.ends_at ? ` · until ${new Date(row.ends_at).toLocaleDateString("en-IN")}` : ""}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => remove.mutate(row.id)}
                  aria-label="Delete banner"
                  className="text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="size-4" strokeWidth={1.8} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ sales */

type SaleRow = {
  id: string;
  title: string;
  description: string | null;
  sale_type: "percent" | "flat";
  percent_off: number | null;
  flat_price: number | null;
  product_ids: string[] | null;
  badge_label: string | null;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

const emptySale = {
  id: "",
  title: "",
  description: "",
  sale_type: "percent" as "percent" | "flat",
  percent_off: "20",
  flat_price: "99",
  badge_label: "SALE",
  starts_at: "",
  ends_at: "",
  active: true,
};

function SalesTab() {
  const { data: rows = [] } = useTable<SaleRow>("sales");
  const { data: products = [] } = useTable<ProductRow>("products");
  const save = useSave("sales");
  const remove = useRemove("sales");
  const [form, setForm] = useState({ ...emptySale });
  const [picked, setPicked] = useState<string[]>([]);

  const set = (key: keyof typeof form) => (v: string | boolean) => setForm((f) => ({ ...f, [key]: v }));

  const load = (row: SaleRow) => {
    setForm({
      id: row.id,
      title: row.title,
      description: row.description ?? "",
      sale_type: row.sale_type === "flat" ? "flat" : "percent",
      percent_off: String(row.percent_off ?? 20),
      flat_price: String(row.flat_price ?? 99),
      badge_label: row.badge_label ?? "SALE",
      starts_at: toLocalInput(row.starts_at),
      ends_at: toLocalInput(row.ends_at),
      active: row.active,
    });
    setPicked(row.product_ids ?? []);
  };

  const toggleProduct = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const submit = () => {
    if (!form.title) {
      toast.error("Enter a headline");
      return;
    }
    save.mutate({
      ...(form.id ? { id: form.id } : {}),
      title: form.title,
      description: form.description,
      sale_type: form.sale_type,
      percent_off: form.sale_type === "percent" ? Number(form.percent_off || 0) : null,
      flat_price: form.sale_type === "flat" ? Number(form.flat_price || 0) : null,
      product_ids: picked,
      badge_label: form.badge_label || null,
      starts_at: toIso(form.starts_at),
      ends_at: toIso(form.ends_at),
      active: form.active,
    });
    setForm({ ...emptySale });
    setPicked([]);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card title={form.id ? "Edit sale" : "Run a sale"}>
        <Text label="Headline" value={form.title} onChange={set("title") as (v: string) => void} placeholder="Diwali sale — everything at ₹99" />
        <Area label="Description" value={form.description} onChange={set("description") as (v: string) => void} />

        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { id: "percent", label: "Percent off" },
              { id: "flat", label: "Flat price" },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setForm((f) => ({ ...f, sale_type: option.id }))}
              className={`rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
                form.sale_type === option.id ? "bg-primary text-primary-foreground" : "bg-white/60 text-ink/75 hover:bg-white/85"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {form.sale_type === "percent" ? (
          <Text label="Discount %" type="number" value={form.percent_off} onChange={set("percent_off") as (v: string) => void} />
        ) : (
          <Text label="Flat price for every product in the sale (₹)" type="number" value={form.flat_price} onChange={set("flat_price") as (v: string) => void} />
        )}

        <Text label="Badge shown on cards" value={form.badge_label} onChange={set("badge_label") as (v: string) => void} />

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Products ({picked.length === 0 ? "all products" : `${picked.length} selected`})
          </p>
          <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-2xl bg-white/45 p-2">
            {products.length === 0 ? (
              <p className="px-2 py-1 text-sm text-muted-foreground">No products yet.</p>
            ) : (
              products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleProduct(p.id)}
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                    picked.includes(p.id) ? "bg-primary text-primary-foreground" : "text-ink hover:bg-white/70"
                  }`}
                >
                  <span className="truncate">{p.title}</span>
                  <span className="text-xs opacity-80">₹{p.price}</span>
                </button>
              ))
            )}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">Leave everything unselected to apply the sale to the whole store.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Text label="Starts" type="datetime-local" value={form.starts_at} onChange={set("starts_at") as (v: string) => void} />
          <Text label="Ends" type="datetime-local" value={form.ends_at} onChange={set("ends_at") as (v: string) => void} />
        </div>
        <Toggle label="Sale is live" value={form.active} onChange={set("active") as (v: boolean) => void} />

        <PrimaryButton onClick={submit} busy={save.isPending}>
          <Megaphone className="size-4" strokeWidth={1.9} />
          {form.id ? "Save sale" : "Publish sale"}
        </PrimaryButton>
        {form.id ? (
          <button
            type="button"
            onClick={() => {
              setForm({ ...emptySale });
              setPicked([]);
            }}
            className="w-full text-center text-xs text-muted-foreground hover:text-ink"
          >
            Cancel editing
          </button>
        ) : null}
      </Card>

      <Card title={`Sales (${rows.length})`}>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sales yet.</p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white/55 px-4 py-3 transition-colors hover:bg-white/75"
              >
                <button type="button" onClick={() => load(row)} className="min-w-0 flex-1 text-left">
                  <p className="truncate font-display text-sm font-bold text-ink">{row.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.sale_type === "flat" ? `Flat ₹${row.flat_price ?? 0}` : `${row.percent_off ?? 0}% off`} ·{" "}
                    {(row.product_ids ?? []).length === 0 ? "all products" : `${(row.product_ids ?? []).length} products`} ·{" "}
                    {row.active ? "live" : "off"}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => remove.mutate(row.id)}
                  aria-label="Delete sale"
                  className="text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="size-4" strokeWidth={1.8} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* --------------------------------------------------------- support inbox */

type SupportRow = {
  id: string;
  name: string | null;
  email: string | null;
  topic: string;
  message: string;
  reply: string | null;
  handled: boolean;
  created_at: string;
};

function SupportTab() {
  const { data: rows = [] } = useTable<SupportRow>("support_messages");
  const save = useSave("support_messages");
  const remove = useRemove("support_messages");
  const [filter, setFilter] = useState<"all" | "question" | "payment" | "complaint">("all");

  const visible = rows.filter((r) => filter === "all" || r.topic === filter);

  return (
    <Card title={`Support inbox (${visible.length})`}>
      <div className="flex flex-wrap gap-2">
        {(["all", "question", "payment", "complaint"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-2 text-xs font-semibold capitalize transition-colors ${
              filter === f ? "bg-primary text-primary-foreground" : "bg-white/60 text-ink/75 hover:bg-white/85"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing here yet.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((row) => (
            <li key={row.id} className="rounded-2xl bg-white/55 px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-violet-deep">
                    {row.topic} · {new Date(row.created_at).toLocaleString("en-IN")}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ink">{row.email || row.name || "Anonymous"}</p>
                  <p className="mt-1 text-sm text-ink/85">{row.message}</p>
                  {row.reply ? <p className="mt-1 text-xs text-muted-foreground">Bot replied: {row.reply}</p> : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => save.mutate({ id: row.id, handled: !row.handled })}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                      row.handled ? "bg-accent text-accent-foreground" : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {row.handled ? "Handled" : "Mark done"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove.mutate(row.id)}
                    aria-label="Delete message"
                    className="text-muted-foreground transition-colors hover:text-destructive"
                  >
                    <Trash2 className="size-4" strokeWidth={1.8} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ----------------------------------------------------------------- admins */

type ProfileRow = { id: string; email: string | null; full_name: string | null };

function AdminsTab() {
  const qc = useQueryClient();
  const { data: profiles = [] } = useQuery<ProfileRow[]>({
    queryKey: ["profiles"],
    queryFn: async () => {
      if (!supabase) return [];
      const { data, error } = await supabase.from("profiles").select("id, email, full_name");
      if (error) throw error;
      return (data ?? []) as ProfileRow[];
    },
  });
  const { data: roles = [] } = useTable<{ id: string; user_id: string; role: string }>("user_roles");

  const grant = useMutation({
    mutationFn: async (userId: string) => {
      if (!supabase) throw new Error("Backend not connected");
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Admin access granted");
      void qc.invalidateQueries({ queryKey: ["user_roles"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not grant access"),
  });

  const revoke = useMutation({
    mutationFn: async (rowId: string) => {
      if (!supabase) throw new Error("Backend not connected");
      const { error } = await supabase.from("user_roles").delete().eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Admin access removed");
      void qc.invalidateQueries({ queryKey: ["user_roles"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not remove access"),
  });

  const adminRows = roles.filter((r) => r.role === "admin");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card title={`Users (${profiles.length})`}>
        {profiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">No signed-up users yet.</p>
        ) : (
          <ul className="space-y-2">
            {profiles.map((p) => {
              const isAdminUser = adminRows.some((r) => r.user_id === p.id);
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-white/55 px-4 py-3 text-sm transition-colors hover:bg-white/75"
                >
                  <span className="min-w-0 flex-1 truncate text-ink">{p.email ?? p.id}</span>
                  {isAdminUser ? (
                    <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">
                      Admin
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => grant.mutate(p.id)}
                      className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground"
                    >
                      Make admin
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Card title={`Admins (${adminRows.length})`}>
        <RowList
          rows={adminRows}
          onDelete={(id) => revoke.mutate(id)}
          render={(r) => profiles.find((p) => p.id === r.user_id)?.email ?? r.user_id}
        />
      </Card>
    </div>
  );
}

/* ------------------------------------------------- contact & support details */

const SETTINGS_FIELDS: { key: keyof SiteSettings; label: string; long?: boolean; placeholder?: string }[] = [
  { key: "contact_email", label: "Contact email", placeholder: "hello@yourstore.com" },
  { key: "support_email", label: "Support email", placeholder: "support@yourstore.com" },
  { key: "phone", label: "Phone", placeholder: "+91 90000 00000" },
  { key: "whatsapp", label: "WhatsApp number", placeholder: "+91 90000 00000" },
  { key: "support_hours", label: "Support hours", placeholder: "Mon–Sat, 10:00–19:00 IST" },
  { key: "address", label: "Address", placeholder: "City, Country" },
  { key: "instagram", label: "Instagram URL", placeholder: "https://instagram.com/..." },
  { key: "youtube", label: "YouTube URL", placeholder: "https://youtube.com/@..." },
  { key: "twitter", label: "X / Twitter URL", placeholder: "https://x.com/..." },
  { key: "licence_note", label: "Licence text", long: true },
  { key: "refund_policy", label: "Refund policy text", long: true },
];

function SettingsTab() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["site-settings"], queryFn: fetchSettings });
  const [form, setForm] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (data && !loaded) {
      setForm(data);
      setLoaded(true);
    }
  }, [data, loaded]);

  const save = useMutation({
    mutationFn: () => saveSettings(form),
    onSuccess: () => {
      toast.success("Contact details updated");
      void queryClient.invalidateQueries({ queryKey: ["site-settings"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const set = (key: keyof SiteSettings, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Contact & support">
        {SETTINGS_FIELDS.filter((field) => !field.long).map((field) => (
          <Text
            key={field.key}
            label={field.label}
            value={form[field.key]}
            onChange={(value) => set(field.key, value)}
            placeholder={field.placeholder ?? ""}
          />
        ))}
      </Card>

      <Card title="Policies shown on the Read more page">
        {SETTINGS_FIELDS.filter((field) => field.long).map((field) => (
          <label key={field.key} className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-[0.14em] text-violet-deep">
              {field.label}
            </span>
            <textarea
              value={form[field.key]}
              onChange={(event) => set(field.key, event.target.value)}
              rows={6}
              className={inputCls}
            />
          </label>
        ))}
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="btn-shine mt-2 inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 font-display text-sm font-semibold text-primary-foreground shadow-float disabled:opacity-60"
        >
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save details
        </button>
      </Card>
    </div>
  );
}

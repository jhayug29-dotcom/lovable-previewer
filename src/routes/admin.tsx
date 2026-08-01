import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
} from "lucide-react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/site/SiteLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { generateAiReviews } from "@/lib/store.functions";
import { categories } from "@/lib/products";
import { DEFAULT_SETTINGS, fetchSettings, saveSettings, type SiteSettings } from "@/lib/settings";

export const Route = createFileRoute("/admin")({
  ssr: false,
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
  { id: "settings", label: "Contact", icon: LifeBuoy },
  { id: "admins", label: "Admins", icon: Shield },
] as const;

type TabId = (typeof TABS)[number]["id"];

function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>("products");

  useEffect(() => {
    if (!loading && !user && isSupabaseConfigured) void navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <SiteLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-ink/60" />
        </div>
      </SiteLayout>
    );
  }

  if (!isAdmin) {
    return (
      <SiteLayout>
        <section className="mx-auto max-w-[520px] px-6 pb-24">
          <div className="glass animate-rise-in rounded-4xl p-10 text-center">
            <Lock className="mx-auto size-10 text-ink/60" strokeWidth={1.6} />
            <h1 className="mt-5 font-display text-2xl font-extrabold text-ink">Admins only</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This area is restricted. Sign in with the owner account to continue.
            </p>
            <Link
              to="/auth"
              className="mt-6 inline-flex rounded-full bg-primary px-6 py-3 font-display text-sm font-semibold text-primary-foreground"
            >
              Sign in
            </Link>
          </div>
        </section>
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

type BannerRow = { id: string; title: string; subtitle: string | null; image_url: string | null; active: boolean };

function BannersTab() {
  const { data: rows = [] } = useTable<BannerRow>("banners");
  const save = useSave("banners");
  const remove = useRemove("banners");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [image, setImage] = useState("");
  const [link, setLink] = useState("");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card title="Add a banner">
        <Text label="Title" value={title} onChange={setTitle} />
        <Text label="Subtitle" value={subtitle} onChange={setSubtitle} />
        <Text label="Image URL" value={image} onChange={setImage} />
        <Text label="Link URL" value={link} onChange={setLink} />
        <PrimaryButton
          busy={save.isPending}
          onClick={() => {
            if (!title) {
              toast.error("Enter a title");
              return;
            }
            save.mutate({ title, subtitle, image_url: image || null, link_url: link || null, active: true });
            setTitle("");
            setSubtitle("");
            setImage("");
            setLink("");
          }}
        >
          <Plus className="size-4" strokeWidth={1.9} />
          Add banner
        </PrimaryButton>
      </Card>
      <Card title={`Banners (${rows.length})`}>
        <RowList rows={rows} onDelete={(id) => remove.mutate(id)} render={(b) => b.title} />
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ sales */

type SaleRow = { id: string; title: string; percent_off: number | null; active: boolean };

function SalesTab() {
  const { data: rows = [] } = useTable<SaleRow>("sales");
  const save = useSave("sales");
  const remove = useRemove("sales");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [percent, setPercent] = useState("20");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card title="Run a sale advertisement">
        <Text label="Headline" value={title} onChange={setTitle} placeholder="Monsoon sale — 40% off" />
        <Area label="Description" value={description} onChange={setDescription} />
        <Text label="Discount %" type="number" value={percent} onChange={setPercent} />
        <PrimaryButton
          busy={save.isPending}
          onClick={() => {
            if (!title) {
              toast.error("Enter a headline");
              return;
            }
            save.mutate({ title, description, percent_off: Number(percent), active: true });
            setTitle("");
            setDescription("");
          }}
        >
          <Megaphone className="size-4" strokeWidth={1.9} />
          Publish sale
        </PrimaryButton>
      </Card>
      <Card title={`Sales (${rows.length})`}>
        <RowList
          rows={rows}
          onDelete={(id) => remove.mutate(id)}
          render={(s) => (
            <>
              <span className="font-semibold">{s.title}</span>{" "}
              <span className="text-muted-foreground">{s.percent_off ?? 0}% off</span>
            </>
          )}
        />
      </Card>
    </div>
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

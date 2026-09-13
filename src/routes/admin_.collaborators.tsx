import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, notFound, redirect, isRedirect } from "@tanstack/react-router";
import {
  BarChart3,
  Check,
  Copy,
  ExternalLink,
  Link as LinkIcon,
  Loader2,
  Package,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/site/SiteLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { checkPanelAccess, fetchCollaboratorDashboard } from "@/lib/analytics.functions";

export const Route = createFileRoute("/admin_/collaborators")({
  ssr: false,
  beforeLoad: async () => {
    if (!isSupabaseConfigured || !supabase) throw notFound();
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      throw redirect({ to: "/auth", search: { redirect: "/admin/collaborators" } });
    }

    try {
      const access = await checkPanelAccess({ data: { accessToken } });
      if (!access) throw notFound();
      if (access.admin) {
        throw redirect({ to: "/admin", search: { tab: "collaborators" } });
      }
      if (!access.collaborator) {
        throw notFound();
      }
    } catch (e) {
      if (isRedirect(e)) throw e;
      throw notFound();
    }
  },
  head: () => ({
    meta: [
      { title: "Collaborator Dashboard — Editly Store" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CollaboratorDashboard,
});

type DashboardData = {
  email: string | null;
  productIds: string[];
  products: { id: string; title: string; category: string; price: number }[];
  totals: {
    visitors: number;
    page_views: number;
    signups: number;
    sales: number;
    revenue: number;
  };
  links: {
    id: string;
    name: string;
    code: string;
    url: string;
    active: boolean;
    visitors: number;
    page_views: number;
    signups: number;
    sales: number;
    revenue: number;
  }[];
};

const inr = (n: number) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

const getFullUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (typeof window !== "undefined") {
    return `${window.location.origin}${url.startsWith("/") ? url : `/${url}`}`;
  }
  return url;
};

function CollaboratorDashboard() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["collaborator-dashboard", session?.access_token ?? ""],
    queryFn: () => fetchCollaboratorDashboard({ data: { accessToken: session?.access_token } }),
    enabled: Boolean(session?.access_token),
    staleTime: 0,
    refetchInterval: 5_000,
    refetchOnWindowFocus: true,
  });

  // Ultra-intelligent Realtime synchronization for Collaborator Portal
  useEffect(() => {
    if (!supabase || !session?.access_token) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const triggerRefresh = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        void qc.invalidateQueries({ queryKey: ["collaborator-dashboard"] });
      }, 150);
    };

    const channel = supabase
      .channel("collaborator-portal-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, triggerRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "page_views" }, triggerRefresh)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collaborator_links" },
        triggerRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "collaborator_partner_products" },
        triggerRefresh,
      )
      .on("broadcast", { event: "collaborator_update" }, triggerRefresh)
      .subscribe();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      void supabase?.removeChannel(channel);
    };
  }, [session?.access_token, qc]);

  const handleCopy = (id: string, text: string) => {
    if (!navigator.clipboard) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      toast.success("Referral link copied to clipboard!");
      setTimeout(() => setCopiedId(null), 2500);
    });
  };

  const primaryLink = data?.links[0];
  const primaryFullUrl = primaryLink ? getFullUrl(primaryLink.url) : null;

  return (
    <SiteLayout dark>
      <section className="mx-auto max-w-[1400px] px-6 pb-24 lg:px-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Collaborator Partner Portal
            </p>
            <h1 className="mt-2 font-display text-[clamp(2rem,4vw,3.4rem)] font-extrabold text-ink">
              Your Partner Analytics
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Share your permanent referral link below. Every visitor, sign-up, and sale generated
              is tracked live here.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="size-6 animate-spin" />
          </div>
        ) : null}

        {error ? (
          <div className="glass mt-8 rounded-4xl p-8 text-center text-sm text-muted-foreground">
            <ShieldCheck className="mx-auto size-6" />
            <p className="mt-3">
              {error instanceof Error
                ? error.message
                : "Collaborator access is not active. Please contact the store owner."}
            </p>
          </div>
        ) : null}

        {data ? (
          <>
            {/* FEATURED PERMANENT REFERRAL LINK HERO CARD */}
            {primaryLink && primaryFullUrl ? (
              <div className="glass mt-8 relative overflow-hidden rounded-4xl p-6 sm:p-8 ring-2 ring-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent shadow-md">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-white">
                        <LinkIcon className="size-4" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-wider text-primary">
                        Your Permanent Referral Link
                      </span>
                      <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600">
                        Live & Tracking
                      </span>
                    </div>

                    <h2 className="mt-2 font-display text-xl font-extrabold text-ink">
                      {primaryLink.name}
                    </h2>

                    <div className="mt-3 flex max-w-2xl items-center gap-2">
                      <input
                        readOnly
                        value={primaryFullUrl}
                        className="w-full rounded-2xl border border-ink/10 bg-white/90 px-4 py-3 font-mono text-xs sm:text-sm text-ink outline-none select-all shadow-xs"
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Referral Code:{" "}
                      <span className="font-mono font-semibold text-ink">{primaryLink.code}</span> ·
                      Visitors clicking this link are tracked automatically for 30 days.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2.5 lg:flex-col lg:items-end">
                    <button
                      type="button"
                      onClick={() => handleCopy("primary", primaryFullUrl)}
                      className="flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                    >
                      {copiedId === "primary" ? (
                        <Check className="size-4 text-white" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                      {copiedId === "primary" ? "Copied to Clipboard!" : "Copy Referral Link"}
                    </button>
                    <a
                      href={primaryFullUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-center gap-2 rounded-2xl border border-ink/10 bg-white px-5 py-3.5 text-sm font-semibold text-ink shadow-xs transition hover:bg-white/80"
                    >
                      <ExternalLink className="size-4" /> Test Link in Store
                    </a>
                  </div>
                </div>
              </div>
            ) : null}

            {/* OVERALL METRICS */}
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Metric
                icon={Users}
                label="Visitors"
                value={String(data.totals.visitors)}
                hint={`${data.totals.page_views} product views`}
              />
              <Metric
                icon={UserPlus}
                label="Sign-ups"
                value={String(data.totals.signups || 0)}
                hint="Registered accounts referred"
                highlight
              />
              <Metric
                icon={BarChart3}
                label="Sales"
                value={String(data.totals.sales)}
                hint="Authorized products"
              />
              <Metric
                icon={BarChart3}
                label="Revenue"
                value={inr(data.totals.revenue)}
                hint="Earned via your links"
              />
              <Metric
                icon={Package}
                label="Authorized Products"
                value={String(data.products.length)}
                hint="Eligible for commission"
              />
            </div>

            {/* ALL ASSIGNED LINKS LIST */}
            <div className="mt-10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-xl font-extrabold text-ink">
                    All Referral Links ({data.links.length})
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Individual tracking breakdown for each link code assigned to you.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {data.links.map((link) => {
                  const fullUrl = getFullUrl(link.url);
                  const isCopied = copiedId === link.id;

                  return (
                    <article key={link.id} className="glass rounded-4xl p-6 shadow-xs">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="font-display text-lg font-extrabold text-ink">
                            {link.name}
                          </h3>
                          <span className="rounded bg-ink/5 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                            Code: {link.code}
                          </span>
                        </div>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            link.active
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-ink/10 text-ink/60"
                          }`}
                        >
                          {link.active ? "Active" : "Paused"}
                        </span>
                      </div>

                      {/* Permanent URL row */}
                      <div className="mt-3 flex items-center gap-2">
                        <input
                          readOnly
                          value={fullUrl}
                          className="w-full rounded-xl border border-ink/10 bg-white/70 px-3 py-2 font-mono text-xs text-ink outline-none select-all"
                        />
                        <button
                          type="button"
                          onClick={() => handleCopy(link.id, fullUrl)}
                          className={`flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold shadow-xs transition ${
                            isCopied
                              ? "bg-emerald-600 text-white"
                              : "bg-primary text-primary-foreground hover:bg-primary/90"
                          }`}
                        >
                          {isCopied ? <Check className="size-3" /> : <Copy className="size-3" />}
                          {isCopied ? "Copied" : "Copy"}
                        </button>
                        <a
                          href={fullUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex shrink-0 items-center gap-1 rounded-xl border border-ink/10 bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-white/80"
                        >
                          <ExternalLink className="size-3" />
                        </a>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5 pt-3 border-t border-ink/5">
                        <div className="rounded-2xl bg-white/60 p-3">
                          <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Visitors
                          </span>
                          <span className="mt-1 block font-display text-lg font-extrabold text-ink">
                            {link.visitors}
                          </span>
                        </div>
                        <div className="rounded-2xl bg-white/60 p-3">
                          <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Views
                          </span>
                          <span className="mt-1 block font-display text-lg font-extrabold text-ink">
                            {link.page_views}
                          </span>
                        </div>
                        <div className="rounded-2xl bg-primary/10 p-3">
                          <span className="block text-[10px] font-semibold uppercase tracking-wider text-primary">
                            Sign-ups
                          </span>
                          <span className="mt-1 block font-display text-lg font-extrabold text-primary">
                            {link.signups || 0}
                          </span>
                        </div>
                        <div className="rounded-2xl bg-white/60 p-3">
                          <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Sales
                          </span>
                          <span className="mt-1 block font-display text-lg font-extrabold text-ink">
                            {link.sales}
                          </span>
                        </div>
                        <div className="rounded-2xl bg-white/60 p-3">
                          <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Revenue
                          </span>
                          <span className="mt-1 block font-display text-lg font-extrabold text-ink">
                            {inr(link.revenue)}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </>
        ) : null}
      </section>
    </SiteLayout>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  highlight,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl p-5 shadow-xs ${highlight ? "bg-primary/10 border border-primary/20" : "glass"}`}
    >
      <div
        className={`flex items-center gap-2 ${highlight ? "text-primary" : "text-muted-foreground"}`}
      >
        <Icon className="size-4" />
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p
        className={`mt-2 font-display text-2xl font-extrabold ${highlight ? "text-primary" : "text-ink"}`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

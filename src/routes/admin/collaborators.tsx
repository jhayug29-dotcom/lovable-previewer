import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { BarChart3, Loader2, ShieldCheck, Users } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { checkPanelAccess, fetchCollaboratorDashboard } from "@/lib/analytics.functions";

export const Route = createFileRoute("/admin/collaborators")({
  ssr: false,
  beforeLoad: async () => {
    if (!isSupabaseConfigured || !supabase) throw notFound();
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) throw redirect({ to: "/auth", search: { redirect: "/admin/collaborators" } });

    const access = await checkPanelAccess({ data: { accessToken } }).catch(() => null);
    if (!access) throw notFound();
    if (access.admin) throw redirect({ to: "/admin" });
    if (!access.collaborator) throw notFound();
  },
  head: () => ({ meta: [{ title: "Collaborator Dashboard — Editly Store" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: CollaboratorDashboard,
});

type DashboardData = {
  email: string | null;
  productIds: string[];
  products: { id: string; title: string; category: string; price: number }[];
  totals: { visitors: number; page_views: number; sales: number; revenue: number };
  links: { id: string; name: string; active: boolean; visitors: number; page_views: number; sales: number; revenue: number }[];
};

function CollaboratorDashboard() {
  const { session } = useAuth();
  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ["collaborator-dashboard", session?.access_token ?? ""],
    queryFn: () => fetchCollaboratorDashboard({ data: { accessToken: session?.access_token } }),
    enabled: Boolean(session?.access_token),
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  return (
    <SiteLayout dark>
      <section className="mx-auto max-w-[1400px] px-6 pb-24 lg:px-12">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Collaborator Partner</p>
        <h1 className="mt-2 font-display text-[clamp(2rem,4vw,3.4rem)] font-extrabold text-ink">Your partner analytics</h1>
        <p className="mt-2 text-sm text-muted-foreground">Only products authorized by the store owner are included in this dashboard.</p>

        {isLoading ? <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="size-6 animate-spin" /></div> : null}
        {error ? <div className="glass mt-8 rounded-4xl p-8 text-center text-sm text-muted-foreground"><ShieldCheck className="mx-auto size-6" /><p className="mt-3">Collaborator access is not active. Please contact the store owner.</p></div> : null}
        {data ? <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={Users} label="Visitors" value={String(data.totals.visitors)} hint={`${data.totals.page_views} product views`} />
            <Metric icon={BarChart3} label="Sales" value={String(data.totals.sales)} hint="Authorized products" />
            <Metric icon={BarChart3} label="Revenue" value={`₹${Math.round(data.totals.revenue).toLocaleString("en-IN")}`} hint="Authorized products" />
            <Metric icon={ShieldCheck} label="Products" value={String(data.products.length)} hint="Authorized by owner" />
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {data.links.map((link) => <article key={link.id} className="glass rounded-4xl p-6"><div className="flex items-center justify-between gap-3"><h2 className="font-display text-lg font-extrabold text-ink">{link.name}</h2><span className={`rounded-full px-3 py-1 text-xs font-bold ${link.active ? "bg-accent text-accent-foreground" : "bg-ink/10 text-ink/60"}`}>{link.active ? "Active" : "Paused"}</span></div><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4"><Metric icon={Users} label="Visitors" value={String(link.visitors)} hint="" /><Metric icon={BarChart3} label="Views" value={String(link.page_views)} hint="" /><Metric icon={BarChart3} label="Sales" value={String(link.sales)} hint="" /><Metric icon={BarChart3} label="Revenue" value={`₹${Math.round(link.revenue).toLocaleString("en-IN")}`} hint="" /></div></article>)}
          </div>
        </> : null}
      </section>
    </SiteLayout>
  );
}

function Metric({ icon: Icon, label, value, hint }: { icon: typeof Users; label: string; value: string; hint: string }) {
  return <div className="rounded-3xl bg-white/55 p-4"><div className="flex items-center gap-2 text-muted-foreground"><Icon className="size-4" /><span className="text-xs font-semibold uppercase tracking-wider">{label}</span></div><p className="mt-2 font-display text-2xl font-extrabold text-ink">{value}</p><p className="text-xs text-muted-foreground">{hint}</p></div>;
}

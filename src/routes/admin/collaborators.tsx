import { useState } from "react";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Copy, ExternalLink, Link2, Loader2, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/site/SiteLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import {
  checkPanelAccess,
  createCollaboratorLink,
  fetchCollaboratorDashboard,
  fetchCollaboratorLinkStats,
  listCollaboratorLinks,
  toggleCollaboratorLink,
} from "@/lib/analytics.functions";

export const Route = createFileRoute("/admin/collaborators")({
  ssr: false,
  beforeLoad: async () => {
    if (!isSupabaseConfigured || !supabase) throw notFound();
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) throw redirect({ to: "/auth", search: { redirect: "/admin/collaborators" } });
    try {
      const access = await checkPanelAccess({ data: { accessToken } });
      if (!access.admin && !access.collaborator) throw notFound();
    } catch {
      throw notFound();
    }
  },
  head: () => ({ meta: [{ title: "Collaborators — Editly Store" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: CollaboratorsPage,
});

const inr = (value: number) => `₹${Math.round(value).toLocaleString("en-IN")}`;

type LinkRow = {
  id: string; code: string; name: string; user_id: string; email: string; active: boolean;
  created_at: string; url: string; visitors: number; page_views: number; sales: number; revenue: number;
};

function Metric({ icon: Icon, label, value, hint }: { icon: typeof Users; label: string; value: string; hint: string }) {
  return <div className="glass rounded-3xl p-5"><div className="flex items-center gap-2 text-muted-foreground"><Icon className="size-4" strokeWidth={1.8} /><span className="text-xs font-semibold uppercase tracking-wider">{label}</span></div><p className="mt-3 font-display text-3xl font-extrabold text-ink">{value}</p><p className="mt-1 text-xs text-muted-foreground">{hint}</p></div>;
}

function CollaboratorsPage() {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const { data: access } = useQuery({ queryKey: ["panel-access", accessToken ?? ""], queryFn: () => checkPanelAccess({ data: { accessToken } }), staleTime: 30_000 });
  if (!access) return <SiteLayout dark><div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="size-6 animate-spin" /></div></SiteLayout>;
  return access.admin ? <AdminCollaborators accessToken={accessToken} /> : <CollaboratorDashboard accessToken={accessToken} />;
}

function AdminCollaborators({ accessToken }: { accessToken?: string }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const { data: links = [], isLoading } = useQuery<LinkRow[]>({ queryKey: ["collaborator-links", accessToken ?? ""], queryFn: () => listCollaboratorLinks({ data: { accessToken } }), staleTime: 10_000, refetchInterval: 30_000 });
  const create = useMutation({
    mutationFn: () => createCollaboratorLink({ data: { accessToken, name, email } }),
    onSuccess: (link) => { toast.success("Collaborator link created and copied"); setName(""); setEmail(""); void qc.invalidateQueries({ queryKey: ["collaborator-links"] }); void navigator.clipboard?.writeText(`${window.location.origin}${link.url}`); },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not create collaborator link"),
  });
  const toggle = useMutation({ mutationFn: (input: { id: string; active: boolean }) => toggleCollaboratorLink({ data: { accessToken, ...input } }), onSuccess: () => { void qc.invalidateQueries({ queryKey: ["collaborator-links"] }); }, onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not update link") });
  const totals = links.reduce((sum, link) => ({ visitors: sum.visitors + link.visitors, sales: sum.sales + link.sales, revenue: sum.revenue + link.revenue }), { visitors: 0, sales: 0, revenue: 0 });

  return <SiteLayout dark><section className="mx-auto max-w-[1500px] px-6 pb-24 lg:px-12">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Seller access / collaborators</p><h1 className="mt-2 font-display text-[clamp(2rem,4vw,3.4rem)] font-extrabold text-ink">Collaborator links</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Create a unique referral link for a registered user. Visitors and completed sales are attributed automatically.</p></div><div className="rounded-full bg-white/55 px-4 py-2 text-xs font-semibold text-ink">Live analytics · 30s refresh</div></div>
    <div className="mt-8 grid gap-4 sm:grid-cols-3"><Metric icon={Link2} label="Links" value={String(links.length)} hint={`${links.filter((l) => l.active).length} active`} /><Metric icon={Users} label="Visitors" value={totals.visitors.toLocaleString("en-IN")} hint="Unique referral sessions" /><Metric icon={BarChart3} label="Sales" value={String(totals.sales)} hint={inr(totals.revenue)} /></div>
    <div className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="glass rounded-4xl p-7"><h2 className="font-display text-xl font-extrabold text-ink">Create collaborator link</h2><p className="mt-1 text-xs text-muted-foreground">The email must belong to an existing Editly Store account.</p><div className="mt-5 space-y-3"><label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Link name</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alex — Instagram" className="w-full rounded-2xl bg-white/65 px-4 py-3 text-sm text-ink outline-none focus:bg-white" /></label><label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">User email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alex@example.com" className="w-full rounded-2xl bg-white/65 px-4 py-3 text-sm text-ink outline-none focus:bg-white" /></label><button type="button" disabled={create.isPending} onClick={() => { if (!name.trim() || !email.trim()) { toast.error("Enter a link name and user email"); return; } create.mutate(); }} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">{create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Create link</button><p className="text-xs leading-relaxed text-muted-foreground">The assigned user can immediately open <code>/admin/collaborators</code> and see only their own link performance.</p></div></div>
      <div className="glass rounded-4xl p-7"><div className="flex items-center justify-between"><h2 className="font-display text-xl font-extrabold text-ink">Your links</h2><span className="text-xs text-muted-foreground">Click a row for traffic + sales</span></div><div className="mt-5 space-y-2">{isLoading ? <Loader2 className="size-5 animate-spin" /> : links.length === 0 ? <p className="text-sm text-muted-foreground">No collaborator links yet.</p> : links.map((link) => <AdminLinkRow key={link.id} link={link} onToggle={(active) => toggle.mutate({ id: link.id, active })} />)}</div></div>
    </div>
  </section></SiteLayout>;
}

function AdminLinkRow({ link, onToggle }: { link: LinkRow; onToggle: (active: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const { data: liveStats, isFetching } = useQuery({ queryKey: ["collaborator-link-stats", link.id], queryFn: () => fetchCollaboratorLinkStats({ data: { id: link.id } }), enabled: open, staleTime: 10_000 });
  const stats = liveStats ?? link;
  return <div className="rounded-2xl bg-white/55 px-4 py-3"><button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 text-left"><span className="min-w-0 flex-1"><span className="block truncate font-display font-bold text-ink">{link.name}</span><span className="block truncate text-xs text-muted-foreground">{link.email}</span></span><span className="hidden text-right sm:block"><span className="block text-xs text-muted-foreground">Visitors</span><span className="font-bold text-ink">{stats.visitors}</span></span><span className="hidden text-right sm:block"><span className="block text-xs text-muted-foreground">Sales</span><span className="font-bold text-ink">{stats.sales}</span></span><span className="text-xs font-bold text-muted-foreground">{open ? "Hide" : "View"}</span></button>{open ? <div className="mt-4 border-t border-ink/10 pt-4"><div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><div><p className="text-xs text-muted-foreground">Visitors</p><p className="font-display text-xl font-bold">{stats.visitors}</p></div><div><p className="text-xs text-muted-foreground">Page views</p><p className="font-display text-xl font-bold">{stats.page_views}</p></div><div><p className="text-xs text-muted-foreground">Sales</p><p className="font-display text-xl font-bold">{stats.sales}</p></div><div><p className="text-xs text-muted-foreground">Revenue</p><p className="font-display text-xl font-bold">{inr(stats.revenue)}</p></div></div><div className="mt-4 flex flex-wrap items-center gap-2"><button type="button" onClick={() => void navigator.clipboard?.writeText(`${window.location.origin}${link.url}`).then(() => toast.success("Link copied"))} className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-xs font-semibold"><Copy className="size-3.5" /> Copy link</button><a href={link.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-xs font-semibold"><ExternalLink className="size-3.5" /> Open link</a><button type="button" onClick={() => onToggle(!link.active)} className="rounded-full bg-white/80 px-4 py-2 text-xs font-semibold">{link.active ? "Pause link" : "Activate link"}</button>{isFetching ? <Loader2 className="size-4 animate-spin" /> : null}</div></div> : null}</div>;
}

function CollaboratorDashboard({ accessToken }: { accessToken?: string }) {
  const { data, isLoading, error } = useQuery({ queryKey: ["collaborator-dashboard", accessToken ?? ""], queryFn: () => fetchCollaboratorDashboard({ data: { accessToken } }), staleTime: 15_000, refetchInterval: 30_000, refetchOnWindowFocus: true });
  return <SiteLayout dark><section className="mx-auto max-w-[1400px] px-6 pb-24 lg:px-12"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Partner analytics</p><h1 className="mt-2 font-display text-[clamp(2rem,4vw,3.4rem)] font-extrabold text-ink">Your collaborator dashboard</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Track visitors and completed sales generated by every collaborator link assigned to your account.</p></div><div className="rounded-full bg-white/55 px-4 py-2 text-xs font-semibold text-ink">Auto-updates every 30 seconds</div></div>{isLoading ? <div className="flex min-h-[40vh] items-center justify-center"><Loader2 className="size-6 animate-spin text-ink/60" /></div> : error || !data ? <div className="glass mt-8 rounded-4xl p-8 text-sm text-muted-foreground">Your collaborator access is not active yet.</div> : <><div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Users} label="Visitors" value={data.totals.visitors.toLocaleString("en-IN")} hint={`${data.totals.page_views.toLocaleString("en-IN")} page views`} /><Metric icon={BarChart3} label="Sales" value={data.totals.sales.toLocaleString("en-IN")} hint="Completed orders" /><Metric icon={BarChart3} label="Revenue" value={inr(data.totals.revenue)} hint="Attributed revenue" /><Metric icon={Link2} label="Active links" value={String(data.links.filter((link) => link.active).length)} hint={`${data.links.length} total links`} /></div><div className="mt-8 grid gap-6 lg:grid-cols-2">{data.links.map((link) => <article key={link.id} className="glass rounded-4xl p-7"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><h2 className="truncate font-display text-xl font-extrabold text-ink">{link.name}</h2><p className="mt-1 truncate text-xs text-muted-foreground">{link.email}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${link.active ? "bg-accent text-accent-foreground" : "bg-ink/10 text-ink/60"}`}>{link.active ? "Active" : "Paused"}</span></div><div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4"><div className="rounded-2xl bg-white/55 p-4"><p className="text-xs text-muted-foreground">Visitors</p><p className="mt-1 font-display text-xl font-bold text-ink">{link.visitors}</p></div><div className="rounded-2xl bg-white/55 p-4"><p className="text-xs text-muted-foreground">Views</p><p className="mt-1 font-display text-xl font-bold text-ink">{link.page_views}</p></div><div className="rounded-2xl bg-white/55 p-4"><p className="text-xs text-muted-foreground">Sales</p><p className="mt-1 font-display text-xl font-bold text-ink">{link.sales}</p></div><div className="rounded-2xl bg-white/55 p-4"><p className="text-xs text-muted-foreground">Revenue</p><p className="mt-1 font-display text-xl font-bold text-ink">{inr(link.revenue)}</p></div></div><a href={link.url} target="_blank" rel="noreferrer" className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-white/55 px-4 py-3 text-xs font-semibold text-ink"><span className="truncate">{typeof window !== "undefined" ? window.location.origin : ""}{link.url}</span><ExternalLink className="size-4 shrink-0" /></a></article>)}</div></>}</section></SiteLayout>;
}

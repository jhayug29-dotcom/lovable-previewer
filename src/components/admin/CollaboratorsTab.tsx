import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Loader2, Plus, Search, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { listAdminUsers } from "@/lib/admin.functions";
import { listCollaboratorPartners, revokeCollaboratorPartner, saveCollaboratorProductAccess, toggleCollaboratorLink } from "@/lib/analytics.functions";

const inr = (n: number) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
type Product = { id: string; title: string; category: string; price: number; active: boolean };
type UserRow = { id: string; email: string; fullName: string | null; isAdmin: boolean; roleRowId: string | null };
type Partner = { user_id: string; email: string; full_name: string | null; active: boolean; product_ids: string[]; totals: { visitors: number; page_views: number; sales: number; revenue: number }; links: Array<{ id: string; name: string; active: boolean; url: string; visitors: number; page_views: number; sales: number; revenue: number }> };
type Mode = "select" | "email";
type CreatedLink = { id: string; name: string; code: string; url: string };

function makeCode() {
  return `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
}

async function createLinkInCurrentSession(input: { name: string; email?: string; userId?: string; productIds: string[] }) {
  if (!supabase) throw new Error("Supabase is not configured");
  let userId = input.userId?.trim() || "";
  let email = input.email?.trim().toLowerCase() || "";

  if (userId) {
    const { data, error } = await supabase.from("profiles").select("id,email").eq("id", userId).maybeSingle();
    if (error) throw new Error(`Could not read selected user: ${error.message}`);
    if (!data) throw new Error("The selected account is no longer available");
    userId = String(data.id);
    email = String(data.email ?? email).trim().toLowerCase();
  } else {
    const { data, error } = await supabase.from("profiles").select("id,email").ilike("email", email).maybeSingle();
    if (error) throw new Error(`Could not find that account: ${error.message}`);
    if (!data) throw new Error("No registered account was found for that email");
    userId = String(data.id);
    email = String(data.email ?? email).trim().toLowerCase();
  }

  if (!userId || !email) throw new Error("The selected account has no valid email address");
  const productIds = [...new Set(input.productIds)];
  const { data: validProducts, error: productError } = await supabase.from("products").select("id").in("id", productIds);
  if (productError) throw new Error(`Could not validate products: ${productError.message}`);
  const valid = new Set((validProducts ?? []).map((p) => String(p.id)));
  const invalid = productIds.filter((id) => !valid.has(id));
  if (invalid.length) throw new Error("One or more selected products no longer exist");

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data, error } = await supabase
      .from("collaborator_links")
      .insert({ name: input.name.trim(), email, user_id: userId, code: makeCode(), active: true })
      .select("id,code,name,user_id,email,active,created_at")
      .single();

    if (!error && data) {
      const { error: accessError } = await supabase
        .from("collaborator_partner_products")
        .insert(productIds.map((product_id) => ({ user_id: userId, product_id })));
      if (accessError) {
        await supabase.from("collaborator_links").delete().eq("id", data.id);
        throw new Error(`Could not save product access: ${accessError.message}`);
      }
      return { ...data, url: `/?ref=${data.code}` };
    }
    if (error?.code === "23505" && error.message.toLowerCase().includes("code")) continue;
    if (error?.code === "23505") throw new Error("A collaborator with this name is already assigned to this user. Use a different link name.");
    if (error) throw new Error(`Could not create collaborator: ${error.message}`);
  }
  throw new Error("Could not generate a unique referral code. Please try again.");
}

export function CollaboratorsTab() {
  const { session } = useAuth();
  const token = session?.access_token;
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<Mode>("select");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [search, setSearch] = useState("");
  const [productIds, setProductIds] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<CreatedLink | null>(null);

  const partners = useQuery<Partner[]>({
    queryKey: ["collaborator-partners", token ?? ""],
    queryFn: () => listCollaboratorPartners({ data: { accessToken: token } }),
    enabled: Boolean(token),
    staleTime: 0,
    refetchInterval: 30_000,
  });

  const products = useQuery<Product[]>({
    queryKey: ["collaborator-products-client", session?.user?.id ?? ""],
    enabled: Boolean(supabase && token),
    staleTime: 60_000,
    retry: 1,
    queryFn: async () => {
      if (!supabase) throw new Error("Supabase is not configured");
      const { data, error } = await supabase.from("products").select("id,title,category,price,active").order("sort_order", { ascending: true }).order("created_at", { ascending: false });
      if (error) throw new Error(`Could not load products: ${error.message}`);
      return (data ?? []) as Product[];
    },
  });

  const users = useQuery<UserRow[]>({ queryKey: ["admin-users-for-collaborators", token ?? ""], queryFn: () => listAdminUsers({ data: { accessToken: token } }), enabled: Boolean(token), staleTime: 60_000 });
  const filteredUsers = useMemo(() => { const q = search.trim().toLowerCase(); return (users.data ?? []).filter((u) => !q || [u.fullName, u.email].some((v) => String(v ?? "").toLowerCase().includes(q))); }, [users.data, search]);
  const selectedUser = useMemo(() => (users.data ?? []).find((u) => u.id === selectedUserId) ?? null, [users.data, selectedUserId]);

  const create = useMutation({
    mutationFn: () => createLinkInCurrentSession({ name, email: mode === "email" ? email : undefined, userId: mode === "select" ? selectedUserId : undefined, productIds }),
    onSuccess: async (link) => {
      const fullUrl = `${window.location.origin}${link.url}`;
      setCreatedLink({ id: link.id, name: link.name, code: link.code, url: fullUrl });
      setName("");
      setEmail("");
      setSelectedUserId("");
      setSearch("");
      setProductIds([]);
      setMode("select");
      try { await navigator.clipboard?.writeText(fullUrl); } catch {}
      toast.success("Collaborator created. Referral link copied.");
      await qc.invalidateQueries({ queryKey: ["collaborator-partners"] });
      await partners.refetch();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create collaborator"),
  });

  const saveAccess = useMutation({ mutationFn: (v: { userId: string; productIds: string[] }) => saveCollaboratorProductAccess({ data: { accessToken: token, ...v } }), onSuccess: () => { toast.success("Product access saved"); void qc.invalidateQueries({ queryKey: ["collaborator-partners"] }); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save access") });
  const revoke = useMutation({ mutationFn: (userId: string) => revokeCollaboratorPartner({ data: { accessToken: token, userId } }), onSuccess: () => { toast.success("Collaborator access revoked"); void qc.invalidateQueries({ queryKey: ["collaborator-partners"] }); }, onError: (e) => toast.error(e instanceof Error ? e.message : "Could not revoke access") });
  const toggle = useMutation({ mutationFn: (v: { id: string; active: boolean }) => toggleCollaboratorLink({ data: { accessToken: token, ...v } }), onSuccess: () => void qc.invalidateQueries({ queryKey: ["collaborator-partners"] }), onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update link") });

  const rows = partners.data ?? [];
  const submit = () => { if (!name.trim()) return toast.error("Enter a partner / link name"); if (mode === "select" && !selectedUserId) return toast.error("Select a registered user"); if (mode === "email" && !email.trim()) return toast.error("Enter an email address"); if (!productIds.length) return toast.error("Select at least one product"); create.mutate(); };

  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-3"><Stat label="Partners" value={String(rows.length)} /><Stat label="Visitors" value={String(rows.reduce((n,p) => n + p.totals.visitors, 0))} /><Stat label="Sales / revenue" value={`${rows.reduce((n,p) => n + p.totals.sales, 0)} · ${inr(rows.reduce((n,p) => n + p.totals.revenue, 0))}`} /></div>

    {createdLink ? <div className="glass rounded-3xl p-5 ring-1 ring-primary/20"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Referral link generated</p><p className="mt-1 font-display font-extrabold text-ink">{createdLink.name}</p><p className="mt-1 truncate text-xs text-muted-foreground">{createdLink.url}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void navigator.clipboard?.writeText(createdLink.url).then(() => toast.success("Link copied"))} className="rounded-full bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground"><Copy className="mr-1 inline size-3.5" /> Copy link</button><a href={createdLink.url} target="_blank" rel="noreferrer" className="rounded-full bg-white px-4 py-2.5 text-xs font-semibold text-ink"><ExternalLink className="mr-1 inline size-3.5" /> Open</a><button type="button" onClick={() => setCreatedLink(null)} className="rounded-full bg-white px-4 py-2.5 text-xs font-semibold text-muted-foreground">Dismiss</button></div></div></div> : null}

    <div className="grid gap-6 lg:grid-cols-[0.65fr_1.35fr]">
      <div className="glass h-fit rounded-4xl p-7"><h2 className="font-display text-xl font-extrabold text-ink">Add collaborator</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Assign the referral link to an existing signed-in account, enter its email manually, and choose the products they can access.</p>
        <div className="mt-5 space-y-4"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Partner / link name" className="w-full rounded-2xl bg-white/65 px-4 py-3 text-sm outline-none" />
          <div className="rounded-2xl bg-white/45 p-1.5"><div className="grid grid-cols-2 gap-1"><button type="button" onClick={() => { setMode("select"); setEmail(""); }} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ${mode === "select" ? "bg-white shadow-sm text-ink" : "text-muted-foreground"}`}><UserCheck className="size-4" /> Select user</button><button type="button" onClick={() => { setMode("email"); setSelectedUserId(""); setSearch(""); }} className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${mode === "email" ? "bg-white shadow-sm text-ink" : "text-muted-foreground"}`}>Enter email</button></div></div>
          {mode === "select" ? <div className="rounded-2xl bg-white/55 p-3"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search registered users by name or email" className="w-full rounded-xl bg-white/75 py-2.5 pl-9 pr-3 text-sm outline-none" /></div>{selectedUser ? <div className="mt-3 flex items-center gap-3 rounded-xl bg-primary/10 px-3 py-2.5"><span className="flex size-9 items-center justify-center rounded-full bg-white text-xs font-bold text-ink">{(selectedUser.fullName || selectedUser.email).slice(0,1).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{selectedUser.fullName || selectedUser.email}</span><span className="block truncate text-xs text-muted-foreground">{selectedUser.email}</span></span><button type="button" onClick={() => setSelectedUserId("")} className="text-xs font-semibold">Change</button></div> : <div className="mt-3 max-h-60 space-y-1 overflow-y-auto">{users.isLoading ? <div className="px-2 py-3 text-xs text-muted-foreground">Loading registered users…</div> : filteredUsers.length ? filteredUsers.map((u) => <button key={u.id} type="button" onClick={() => { setSelectedUserId(u.id); setEmail(u.email); setSearch(""); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/80"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-ink">{(u.fullName || u.email).slice(0,1).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{u.fullName || "Unnamed user"}</span><span className="block truncate text-xs text-muted-foreground">{u.email}</span></span>{u.isAdmin ? <span className="rounded-full bg-ink/10 px-2 py-1 text-[10px] font-semibold">Admin</span> : null}</button>) : <p className="px-2 py-3 text-xs text-muted-foreground">No registered users match your search.</p>}</div>}</div> : <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="partner@example.com" className="w-full rounded-2xl bg-white/65 px-4 py-3 text-sm outline-none" />}
          <div className="rounded-2xl bg-white/55 p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-ink">Product access</p><p className="text-xs text-muted-foreground">Choose which products this collaborator can analyze.</p></div><span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{productIds.length} selected</span></div><div className="mt-3 max-h-52 space-y-1.5 overflow-y-auto">{products.isLoading ? <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading products…</div> : products.isError ? <div className="rounded-xl bg-destructive/10 px-3 py-3 text-xs text-destructive"><p>{products.error instanceof Error ? products.error.message : "Could not load products"}</p><button type="button" onClick={() => void products.refetch()} className="mt-2 font-semibold underline">Retry</button></div> : products.data?.length ? products.data.map((p) => { const checked = productIds.includes(p.id); return <button key={p.id} type="button" onClick={() => setProductIds((s) => checked ? s.filter((id) => id !== p.id) : [...s, p.id])} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${checked ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-white/80"}`}><span className={`flex size-5 items-center justify-center rounded-md border text-xs ${checked ? "border-primary bg-primary text-primary-foreground" : "border-ink/20 bg-white/60"}`}>{checked ? "✓" : ""}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{p.title}</span><span className="text-xs text-muted-foreground">{p.category} · {inr(p.price)}</span></span></button>; }) : <p className="px-2 py-3 text-xs text-muted-foreground">No products available.</p>}</div></div>
          <button type="button" disabled={create.isPending || products.isLoading || products.isError} onClick={submit} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">{create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Create referral link</button>
        </div><div className="mt-5 rounded-2xl bg-white/45 p-4 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mb-2 size-4" /> Product permissions are applied when the referral link is created. You can change them later from the collaborator card.</div>
      </div>
      <div className="glass rounded-4xl p-7"><div className="flex items-center justify-between"><div><h2 className="font-display text-xl font-extrabold text-ink">Collaborator Partners</h2><p className="text-xs text-muted-foreground">Click a partner to manage products and referral links.</p></div>{partners.isLoading ? <Loader2 className="size-5 animate-spin" /> : null}{partners.isError ? <button type="button" onClick={() => void partners.refetch()} className="text-xs font-semibold text-destructive underline">Retry</button> : null}</div><div className="mt-5 space-y-3">{partners.isError ? <p className="rounded-3xl bg-destructive/10 p-4 text-xs text-destructive">{partners.error instanceof Error ? partners.error.message : "Could not load collaborators"}</p> : null}{!partners.isLoading && !partners.isError && rows.length === 0 ? <p className="rounded-3xl bg-white/45 p-8 text-center text-sm text-muted-foreground">No collaborators yet.</p> : null}{rows.map((p) => <PartnerCard key={p.user_id} partner={p} products={products.data ?? []} open={expanded === p.user_id} onOpen={() => setExpanded(expanded === p.user_id ? null : p.user_id)} onSave={(ids) => saveAccess.mutate({ userId: p.user_id, productIds: ids })} saving={saveAccess.isPending} onRevoke={() => { if (window.confirm(`Revoke access for ${p.email}?`)) revoke.mutate(p.user_id); }} revoking={revoke.isPending} onToggle={(id, active) => toggle.mutate({ id, active })} />)}</div></div>
    </div>
  </div>;
}
function Stat({ label, value }: { label: string; value: string }) { return <div className="glass rounded-3xl p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 font-display text-2xl font-extrabold text-ink">{value}</p></div>; }
function PartnerCard({ partner, products, open, onOpen, onSave, saving, onRevoke, revoking, onToggle }: { partner: Partner; products: Product[]; open: boolean; onOpen: () => void; onSave: (ids: string[]) => void; saving: boolean; onRevoke: () => void; revoking: boolean; onToggle: (id: string, active: boolean) => void }) { const [selected, setSelected] = useState(partner.product_ids); return <article className="rounded-3xl bg-white/55 p-5"><button type="button" onClick={onOpen} className="flex w-full items-center gap-4 text-left"><span className="min-w-0 flex-1"><span className="block truncate font-display font-extrabold text-ink">{partner.full_name || partner.email}</span><span className="block truncate text-xs text-muted-foreground">{partner.email}</span></span><span className="hidden text-xs text-muted-foreground sm:block">{partner.product_ids.length} products · {partner.totals.visitors} visitors · {partner.totals.sales} sales</span><span className={`rounded-full px-3 py-1 text-xs font-bold ${partner.active ? "bg-accent text-accent-foreground" : "bg-ink/10 text-ink/60"}`}>{partner.active ? "Active" : "Revoked"}</span></button>{open ? <div className="mt-5 border-t border-ink/10 pt-5"><div className="grid gap-2 sm:grid-cols-2">{products.map((p) => { const checked = selected.includes(p.id); return <button key={p.id} type="button" disabled={!partner.active} onClick={() => setSelected((s) => checked ? s.filter((id) => id !== p.id) : [...s, p.id])} className={`rounded-2xl p-3 text-left ${checked ? "bg-primary/10 ring-1 ring-primary/20" : "bg-white/60"}`}><span className="block text-sm font-semibold text-ink">{checked ? "✓ " : "○ "}{p.title}</span><span className="text-xs text-muted-foreground">{p.category} · {inr(p.price)}</span></button>; })}</div><div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={!partner.active || saving} onClick={() => onSave(selected)} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">{saving ? <Loader2 className="size-3.5 animate-spin" /> : null} Save product access</button>{partner.active ? <button type="button" disabled={revoking} onClick={onRevoke} className="inline-flex items-center gap-2 rounded-full bg-destructive/10 px-5 py-2.5 text-xs font-semibold text-destructive disabled:opacity-50"><UserX className="size-3.5" /> {revoking ? "Revoking…" : "Revoke access"}</button> : null}</div><h3 className="mt-6 font-display font-extrabold text-ink">Referral links</h3><div className="mt-3 space-y-2">{partner.links.map((link) => <div key={link.id} className="rounded-2xl bg-white/60 p-4"><div className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1 font-semibold">{link.name}</span><span className="text-xs text-muted-foreground">{link.active ? "Active" : "Paused"} · {link.visitors} visitors · {link.sales} sales · {inr(link.revenue)}</span><button type="button" onClick={() => void navigator.clipboard?.writeText(`${window.location.origin}${link.url}`).then(() => toast.success("Link copied"))} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold"><Copy className="mr-1 inline size-3" />Copy</button><a href={link.url} target="_blank" rel="noreferrer" className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold"><ExternalLink className="mr-1 inline size-3" />Open</a><button type="button" onClick={() => onToggle(link.id, !link.active)} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold">{link.active ? "Pause" : "Reactivate"}</button></div></div>)}</div></div> : null}</article>; }

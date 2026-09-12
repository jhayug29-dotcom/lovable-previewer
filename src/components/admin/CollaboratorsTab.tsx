import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, ExternalLink, Loader2, Plus, Search, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { listAdminUsers } from "@/lib/admin.functions";
import {
  createCollaboratorLink,
  listCollaboratorPartners,
  listCollaboratorProducts,
  revokeCollaboratorPartner,
  saveCollaboratorProductAccess,
  toggleCollaboratorLink,
} from "@/lib/analytics.functions";

const inr = (n: number) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;

type Product = { id: string; title: string; category: string; price: number; active: boolean };
type UserRow = { id: string; email: string; fullName: string | null; isAdmin: boolean; roleRowId: string | null };
type LinkRow = { id: string; name: string; active: boolean; url: string; visitors: number; page_views: number; sales: number; revenue: number };
type Partner = { user_id: string; email: string; full_name: string | null; active: boolean; product_ids: string[]; products: Product[]; totals: { visitors: number; page_views: number; sales: number; revenue: number }; links: LinkRow[] };
type RecipientMode = "select" | "email";
type CreatedLink = { name: string; url: string; code: string };

export function CollaboratorsTab() {
  const { session } = useAuth();
  const token = session?.access_token;
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [recipientMode, setRecipientMode] = useState<RecipientMode>("select");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [createProductIds, setCreateProductIds] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<CreatedLink | null>(null);

  const partners = useQuery<Partner[]>({ queryKey: ["collaborator-partners", token ?? ""], queryFn: () => listCollaboratorPartners({ data: { accessToken: token } }), enabled: Boolean(token), staleTime: 0, refetchInterval: 30_000 });
  const products = useQuery<Product[]>({
    queryKey: ["collaborator-products", token ?? ""],
    queryFn: async () => {
      try {
        const res = await listCollaboratorProducts({ data: { accessToken: token } });
        if (res && res.length > 0) return res;
      } catch (e) {
        console.warn("Server listCollaboratorProducts error, checking client fallback:", e);
      }
      if (supabase) {
        const { data, error } = await supabase
          .from("products")
          .select("id,title,category,price,active")
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: false });
        if (!error && data) return data as Product[];
      }
      return [];
    },
    enabled: Boolean(token),
    staleTime: 60_000,
    retry: 1,
  });
  const users = useQuery<UserRow[]>({ queryKey: ["admin-users-for-collaborators", token ?? ""], queryFn: () => listAdminUsers({ data: { accessToken: token } }), enabled: Boolean(token), staleTime: 60_000 });

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    const rows = users.data ?? [];
    if (!q) return rows;
    return rows.filter((user) => [user.fullName, user.email].some((value) => String(value ?? "").toLowerCase().includes(q)));
  }, [userSearch, users.data]);
  const selectedUser = useMemo(() => (users.data ?? []).find((user) => user.id === selectedUserId) ?? null, [selectedUserId, users.data]);

  const create = useMutation({
    mutationFn: () =>
      createCollaboratorLink({
        data: {
          accessToken: token,
          name: name.trim(),
          email: (recipientMode === "select" ? selectedUser?.email || email : email)?.trim() || undefined,
          userId: recipientMode === "select" ? selectedUserId : undefined,
          productIds: createProductIds,
        },
      }),
    onSuccess: async (link) => {
      const fullUrl = `${window.location.origin}${link.url}`;
      setCreatedLink({ name: link.name, code: link.code, url: fullUrl });
      setName(""); setEmail(""); setRecipientMode("select"); setSelectedUserId(""); setUserSearch(""); setCreateProductIds([]);
      try { await navigator.clipboard?.writeText(fullUrl); } catch {}
      toast.success("Collaborator created. Referral link copied.");
      await qc.invalidateQueries({ queryKey: ["collaborator-partners"] });
      await partners.refetch();
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not create collaborator"),
  });

  const saveAccess = useMutation({
    mutationFn: (value: { userId: string; productIds: string[] }) => saveCollaboratorProductAccess({ data: { accessToken: token, ...value } }),
    onSuccess: async () => { toast.success("Product access saved"); await qc.invalidateQueries({ queryKey: ["collaborator-partners"] }); await partners.refetch(); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save product access"),
  });

  const revoke = useMutation({
    mutationFn: (userId: string) => revokeCollaboratorPartner({ data: { accessToken: token, userId } }),
    onSuccess: async () => { toast.success("Collaborator access revoked"); await qc.invalidateQueries({ queryKey: ["collaborator-partners"] }); await partners.refetch(); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not revoke access"),
  });

  const toggle = useMutation({
    mutationFn: (value: { id: string; active: boolean }) => toggleCollaboratorLink({ data: { accessToken: token, ...value } }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["collaborator-partners"] }); await partners.refetch(); },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update referral link"),
  });

  const rows = partners.data ?? [];
  const visitorTotal = rows.reduce((sum, partner) => sum + partner.totals.visitors, 0);
  const salesTotal = rows.reduce((sum, partner) => sum + partner.totals.sales, 0);
  const revenueTotal = rows.reduce((sum, partner) => sum + partner.totals.revenue, 0);

  const switchMode = (mode: RecipientMode) => { setRecipientMode(mode); setSelectedUserId(""); setEmail(""); setUserSearch(""); };
  const submit = () => {
    if (!name.trim()) {
      toast.error("Enter a partner / link name");
      return;
    }
    if (recipientMode === "select" && !selectedUserId) {
      toast.error("Select a registered user");
      return;
    }
    if (recipientMode === "email" && !email.trim()) {
      toast.error("Enter an email address");
      return;
    }
    if (!createProductIds.length) {
      toast.error("Select at least one product");
      return;
    }
    if (!token) {
      toast.error("Admin session expired. Refresh the page and sign in again.");
      return;
    }
    create.mutate();
  };

  return <div className="space-y-6">
    <div className="grid gap-4 sm:grid-cols-3"><Stat label="Partners" value={String(rows.length)} /><Stat label="Visitors" value={String(visitorTotal)} /><Stat label="Sales / revenue" value={`${salesTotal} · ${inr(revenueTotal)}`} /></div>
    {createdLink ? <div className="glass rounded-3xl p-5 ring-1 ring-primary/20"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Referral link generated</p><p className="mt-1 font-display font-extrabold text-ink">{createdLink.name}</p><p className="mt-1 break-all text-xs text-muted-foreground">{createdLink.url}</p><p className="mt-1 text-[11px] text-muted-foreground">Code: {createdLink.code}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void navigator.clipboard?.writeText(createdLink.url).then(() => toast.success("Link copied"))} className="rounded-full bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground"><Copy className="mr-1 inline size-3.5" /> Copy link</button><a href={createdLink.url} target="_blank" rel="noreferrer" className="rounded-full bg-white px-4 py-2.5 text-xs font-semibold text-ink"><ExternalLink className="mr-1 inline size-3.5" /> Open</a><button type="button" onClick={() => setCreatedLink(null)} className="rounded-full bg-white px-4 py-2.5 text-xs font-semibold text-muted-foreground">Dismiss</button></div></div></div> : null}

    <div className="grid gap-6 lg:grid-cols-[0.65fr_1.35fr]">
      <div className="glass h-fit rounded-4xl p-7"><h2 className="font-display text-xl font-extrabold text-ink">Add collaborator</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Assign a unique referral link to an existing signed-in account, or enter a registered email manually.</p>
        <div className="mt-5 space-y-4"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Partner / link name" className="w-full rounded-2xl bg-white/65 px-4 py-3 text-sm outline-none" />
          <div className="rounded-2xl bg-white/45 p-1.5"><div className="grid grid-cols-2 gap-1"><button type="button" onClick={() => switchMode("select")} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ${recipientMode === "select" ? "bg-white shadow-sm text-ink" : "text-muted-foreground"}`}><UserCheck className="size-4" /> Select user</button><button type="button" onClick={() => switchMode("email")} className={`rounded-xl px-3 py-2.5 text-sm font-semibold ${recipientMode === "email" ? "bg-white shadow-sm text-ink" : "text-muted-foreground"}`}>Enter email</button></div></div>
          {recipientMode === "select" ? <div className="rounded-2xl bg-white/55 p-3"><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search registered users by name or email" className="w-full rounded-xl bg-white/75 py-2.5 pl-9 pr-3 text-sm outline-none" /></div>{selectedUser ? <div className="mt-3 flex items-center gap-3 rounded-xl bg-primary/10 px-3 py-2.5"><span className="flex size-9 items-center justify-center rounded-full bg-white text-xs font-bold text-ink">{(selectedUser.fullName || selectedUser.email).slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{selectedUser.fullName || selectedUser.email}</span><span className="block truncate text-xs text-muted-foreground">{selectedUser.email}</span></span>{selectedUser.isAdmin ? <span className="rounded-full bg-ink/10 px-2 py-1 text-[10px] font-semibold text-muted-foreground">Admin</span> : null}<button type="button" onClick={() => setSelectedUserId("")} className="text-xs font-semibold text-muted-foreground hover:text-ink">Change</button></div> : <div className="mt-3 max-h-60 space-y-1 overflow-y-auto">{users.isLoading ? <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading registered users…</div> : null}{users.isError ? <div className="rounded-xl bg-destructive/10 px-3 py-3 text-xs text-destructive">{users.error instanceof Error ? users.error.message : "Could not load registered users"}</div> : null}{!users.isLoading && !users.isError && filteredUsers.length === 0 ? <p className="px-2 py-3 text-xs text-muted-foreground">No registered users match your search.</p> : null}{!users.isLoading && !users.isError ? filteredUsers.map((user) => <button key={user.id} type="button" onClick={() => { setSelectedUserId(user.id); setEmail(user.email); setUserSearch(""); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/80"><span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-ink">{(user.fullName || user.email).slice(0, 1).toUpperCase()}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{user.fullName || "Unnamed user"}</span><span className="block truncate text-xs text-muted-foreground">{user.email}</span></span>{user.isAdmin ? <span className="rounded-full bg-ink/10 px-2 py-1 text-[10px] font-semibold text-muted-foreground">Admin</span> : null}</button>) : null}</div>}</div> : <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="partner@example.com" className="w-full rounded-2xl bg-white/65 px-4 py-3 text-sm outline-none" />}
          <div className="rounded-2xl bg-white/55 p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold text-ink">Product access</p><p className="text-xs text-muted-foreground">Choose exactly which products this collaborator can analyze.</p></div><span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{createProductIds.length} selected</span></div><div className="mt-3 max-h-56 space-y-1.5 overflow-y-auto">{products.isLoading ? <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading products…</div> : null}{products.isError ? <div className="rounded-xl bg-destructive/10 px-3 py-3 text-xs text-destructive"><p>{products.error instanceof Error ? products.error.message : "Could not load products"}</p><button type="button" onClick={() => void products.refetch()} className="mt-2 font-semibold underline">Retry</button></div> : null}{!products.isLoading && !products.isError && (products.data ?? []).length === 0 ? <p className="px-2 py-3 text-xs text-muted-foreground">No products available.</p> : null}{!products.isLoading && !products.isError ? (products.data ?? []).map((product) => { const checked = createProductIds.includes(product.id); return <button key={product.id} type="button" onClick={() => setCreateProductIds((current) => checked ? current.filter((id) => id !== product.id) : [...current, product.id])} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${checked ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-white/80"}`}><span className={`flex size-5 shrink-0 items-center justify-center rounded-md border text-xs ${checked ? "border-primary bg-primary text-primary-foreground" : "border-ink/20 bg-white/60"}`}>{checked ? "✓" : ""}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{product.title}</span><span className="text-xs text-muted-foreground">{product.category} · {inr(product.price)}</span></span></button>; }) : null}</div></div>
          <button type="button" disabled={create.isPending || !token} onClick={submit} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">{create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Create referral link</button>
        </div><div className="mt-5 rounded-2xl bg-white/45 p-4 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mb-2 size-4" /> All collaborator creation and permission writes go through the authenticated server admin path.</div>
      </div>

      <div className="glass rounded-4xl p-7"><div className="flex items-center justify-between"><div><h2 className="font-display text-xl font-extrabold text-ink">Collaborator Partners</h2><p className="text-xs text-muted-foreground">Open a partner to manage products and referral links.</p></div>{partners.isLoading ? <Loader2 className="size-5 animate-spin" /> : null}{partners.isError ? <button type="button" onClick={() => void partners.refetch()} className="text-xs font-semibold text-destructive underline">Retry</button> : null}</div><div className="mt-5 space-y-3">{partners.isError ? <p className="rounded-3xl bg-destructive/10 p-4 text-xs text-destructive">{partners.error instanceof Error ? partners.error.message : "Could not load collaborators"}</p> : null}{!partners.isLoading && !partners.isError && rows.length === 0 ? <p className="rounded-3xl bg-white/45 p-8 text-center text-sm text-muted-foreground">No collaborators yet.</p> : null}{rows.map((partner) => <PartnerCard key={partner.user_id} partner={partner} products={products.data ?? []} open={expanded === partner.user_id} onOpen={() => setExpanded(expanded === partner.user_id ? null : partner.user_id)} onSave={(productIds) => saveAccess.mutate({ userId: partner.user_id, productIds })} saving={saveAccess.isPending} onRevoke={() => { if (window.confirm(`Revoke access for ${partner.email}?`)) revoke.mutate(partner.user_id); }} revoking={revoke.isPending} onToggle={(id, active) => toggle.mutate({ id, active })} toggling={toggle.isPending} />)}</div></div>
    </div>
  </div>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="glass rounded-3xl p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 font-display text-2xl font-extrabold text-ink">{value}</p></div>; }

function PartnerCard({ partner, products, open, onOpen, onSave, saving, onRevoke, revoking, onToggle, toggling }: { partner: Partner; products: Product[]; open: boolean; onOpen: () => void; onSave: (ids: string[]) => void; saving: boolean; onRevoke: () => void; revoking: boolean; onToggle: (id: string, active: boolean) => void; toggling: boolean }) {
  const [selected, setSelected] = useState<string[]>(partner.product_ids);
  useEffect(() => setSelected(partner.product_ids), [partner.product_ids]);
  const toggleProduct = (productId: string) => setSelected((current) => current.includes(productId) ? current.filter((id) => id !== productId) : [...current, productId]);

  return <article className="rounded-3xl bg-white/55 p-5"><button type="button" onClick={onOpen} className="flex w-full items-center gap-4 text-left"><span className="min-w-0 flex-1"><span className="block truncate font-display font-extrabold text-ink">{partner.full_name || partner.email}</span><span className="block truncate text-xs text-muted-foreground">{partner.email}</span></span><span className="hidden text-xs text-muted-foreground sm:block">{partner.product_ids.length} products · {partner.totals.visitors} visitors · {partner.totals.sales} sales</span><span className={`rounded-full px-3 py-1 text-xs font-bold ${partner.active ? "bg-accent text-accent-foreground" : "bg-ink/10 text-ink/60"}`}>{partner.active ? "Active" : "Revoked"}</span></button>{open ? <div className="mt-5 border-t border-ink/10 pt-5"><div className="grid gap-2 sm:grid-cols-2">{(products.length ? products : partner.products).map((product) => { const checked = selected.includes(product.id); return <button key={product.id} type="button" disabled={!partner.active} onClick={() => toggleProduct(product.id)} className={`rounded-2xl p-3 text-left disabled:opacity-50 ${checked ? "bg-primary/10 ring-1 ring-primary/20" : "bg-white/60"}`}><span className="block text-sm font-semibold text-ink">{checked ? "✓ " : "○ "}{product.title}</span><span className="text-xs text-muted-foreground">{product.category} · {inr(product.price)}</span></button>; })}</div>{!products.length && !partner.products.length ? <p className="mt-3 text-xs text-muted-foreground">No products are currently available.</p> : null}<div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={!partner.active || saving} onClick={() => onSave([...new Set(selected)])} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">{saving ? <Loader2 className="size-3.5 animate-spin" /> : null} Save product access</button>{partner.active ? <button type="button" disabled={revoking} onClick={onRevoke} className="inline-flex items-center gap-2 rounded-full bg-destructive/10 px-5 py-2.5 text-xs font-semibold text-destructive disabled:opacity-50"><UserX className="size-3.5" /> {revoking ? "Revoking…" : "Revoke access"}</button> : null}</div><h3 className="mt-6 font-display font-extrabold text-ink">Referral links</h3><div className="mt-3 space-y-2">{partner.links.map((link) => <div key={link.id} className="rounded-2xl bg-white/60 p-4"><div className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1 font-semibold">{link.name}</span><span className="text-xs text-muted-foreground">{link.active ? "Active" : "Paused"} · {link.visitors} visitors · {link.sales} sales · {inr(link.revenue)}</span><button type="button" onClick={() => void navigator.clipboard?.writeText(`${window.location.origin}${link.url}`).then(() => toast.success("Link copied"))} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold"><Copy className="mr-1 inline size-3" />Copy</button><a href={link.url} target="_blank" rel="noreferrer" className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold"><ExternalLink className="mr-1 inline size-3" />Open</a><button type="button" disabled={toggling} onClick={() => onToggle(link.id, !link.active)} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-50">{toggling ? "Updating…" : link.active ? "Pause" : "Reactivate"}</button></div></div>)}{partner.links.length === 0 ? <p className="rounded-2xl bg-white/45 p-4 text-xs text-muted-foreground">No referral links found for this partner.</p> : null}</div></div> : null}</article>;
}

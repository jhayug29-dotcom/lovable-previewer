import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Copy, ExternalLink, Loader2, Plus, Search, ShieldCheck, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
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
type RegisteredUser = { id: string; email: string; fullName: string | null; isAdmin: boolean; roleRowId: string | null };
type Partner = {
  user_id: string;
  email: string;
  full_name: string | null;
  active: boolean;
  product_ids: string[];
  products: Product[];
  totals: { visitors: number; page_views: number; sales: number; revenue: number };
  links: Array<{
    id: string;
    name: string;
    active: boolean;
    url: string;
    visitors: number;
    page_views: number;
    sales: number;
    revenue: number;
  }>;
};

type RecipientMode = "select" | "email";

export function CollaboratorsTab() {
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [recipientMode, setRecipientMode] = useState<RecipientMode>("select");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const partners = useQuery<Partner[]>({
    queryKey: ["collaborator-partners", accessToken ?? ""],
    queryFn: () => listCollaboratorPartners({ data: { accessToken } }),
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
  const products = useQuery<Product[]>({
    queryKey: ["collaborator-products", accessToken ?? ""],
    queryFn: () => listCollaboratorProducts({ data: { accessToken } }),
    staleTime: 60_000,
  });
  const users = useQuery<RegisteredUser[]>({
    queryKey: ["admin-users-for-collaborators", accessToken ?? ""],
    queryFn: () => listAdminUsers({ data: { accessToken } }),
    staleTime: 60_000,
    enabled: Boolean(accessToken),
  });

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    const list = users.data ?? [];
    if (!q) return list;
    return list.filter((user) =>
      [user.fullName, user.email].filter(Boolean).some((value) => String(value).toLowerCase().includes(q)),
    );
  }, [users.data, userSearch]);

  const selectedUser = useMemo(
    () => (users.data ?? []).find((user) => user.id === selectedUserId) ?? null,
    [users.data, selectedUserId],
  );

  const create = useMutation({
    mutationFn: () => createCollaboratorLink({ data: { accessToken, name, email } }),
    onSuccess: (link) => {
      setName("");
      setEmail("");
      setSelectedUserId("");
      setUserSearch("");
      setRecipientMode("select");
      void navigator.clipboard?.writeText(`${window.location.origin}${link.url}`);
      toast.success("Collaborator created. Unique link copied.");
      void qc.invalidateQueries({ queryKey: ["collaborator-partners"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not create collaborator"),
  });
  const saveAccess = useMutation({
    mutationFn: (v: { userId: string; productIds: string[] }) => saveCollaboratorProductAccess({ data: { accessToken, ...v } }),
    onSuccess: () => { toast.success("Product access saved"); void qc.invalidateQueries({ queryKey: ["collaborator-partners"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save access"),
  });
  const revoke = useMutation({
    mutationFn: (userId: string) => revokeCollaboratorPartner({ data: { accessToken, userId } }),
    onSuccess: () => { toast.success("Collaborator access revoked"); void qc.invalidateQueries({ queryKey: ["collaborator-partners"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not revoke access"),
  });
  const toggle = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => toggleCollaboratorLink({ data: { accessToken, ...v } }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["collaborator-partners"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update link"),
  });

  const rows = partners.data ?? [];
  const visitorTotal = rows.reduce((n, p) => n + p.totals.visitors, 0);
  const salesTotal = rows.reduce((n, p) => n + p.totals.sales, 0);
  const revenueTotal = rows.reduce((n, p) => n + p.totals.revenue, 0);

  const selectUser = (user: RegisteredUser) => {
    setSelectedUserId(user.id);
    setEmail(user.email);
    setUserSearch("");
  };

  const switchRecipientMode = (mode: RecipientMode) => {
    setRecipientMode(mode);
    setSelectedUserId("");
    setEmail("");
    setUserSearch("");
  };

  const submitCreate = () => {
    if (!name.trim()) return toast.error("Enter a partner / link name");
    if (!email.trim()) return toast.error(recipientMode === "select" ? "Select a registered user" : "Enter an email address");
    create.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Partners" value={String(rows.length)} />
        <Stat label="Visitors" value={String(visitorTotal)} />
        <Stat label="Sales / revenue" value={`${salesTotal} · ${inr(revenueTotal)}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.65fr_1.35fr]">
        <div className="glass h-fit rounded-4xl p-7">
          <h2 className="font-display text-xl font-extrabold text-ink">Add collaborator</h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Assign the referral link to an existing signed-in account, or enter its email manually.</p>

          <div className="mt-5 space-y-4">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Partner / link name" className="w-full rounded-2xl bg-white/65 px-4 py-3 text-sm outline-none" />

            <div className="rounded-2xl bg-white/45 p-1.5">
              <div className="grid grid-cols-2 gap-1">
                <button type="button" onClick={() => switchRecipientMode("select")} className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${recipientMode === "select" ? "bg-white shadow-sm text-ink" : "text-muted-foreground"}`}>
                  <UserCheck className="size-4" /> Select user
                </button>
                <button type="button" onClick={() => switchRecipientMode("email")} className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${recipientMode === "email" ? "bg-white shadow-sm text-ink" : "text-muted-foreground"}`}>
                  Enter email
                </button>
              </div>
            </div>

            {recipientMode === "select" ? (
              <div className="rounded-2xl bg-white/55 p-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search registered users by name or email" className="w-full rounded-xl bg-white/75 py-2.5 pl-9 pr-3 text-sm outline-none" />
                </div>

                {selectedUser ? (
                  <div className="mt-3 flex items-center gap-3 rounded-xl bg-primary/10 px-3 py-2.5 ring-1 ring-primary/20">
                    <span className="flex size-9 items-center justify-center rounded-full bg-white text-xs font-bold text-ink">{(selectedUser.fullName || selectedUser.email).slice(0, 1).toUpperCase()}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{selectedUser.fullName || selectedUser.email}</span>
                      <span className="block truncate text-xs text-muted-foreground">{selectedUser.email}</span>
                    </span>
                    <button type="button" onClick={() => { setSelectedUserId(""); setEmail(""); }} className="text-xs font-semibold text-muted-foreground hover:text-ink">Change</button>
                  </div>
                ) : (
                  <div className="mt-3 max-h-60 space-y-1 overflow-y-auto">
                    {users.isLoading ? <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading registered users…</div> : filteredUsers.length === 0 ? <p className="px-2 py-3 text-xs text-muted-foreground">No registered users match your search.</p> : filteredUsers.map((user) => (
                      <button key={user.id} type="button" onClick={() => selectUser(user)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/80">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-ink">{(user.fullName || user.email).slice(0, 1).toUpperCase()}</span>
                        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{user.fullName || "Unnamed user"}</span><span className="block truncate text-xs text-muted-foreground">{user.email}</span></span>
                        {user.isAdmin ? <span className="rounded-full bg-ink/10 px-2 py-1 text-[10px] font-semibold text-muted-foreground">Admin</span> : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="partner@example.com" className="w-full rounded-2xl bg-white/65 px-4 py-3 text-sm outline-none" />
            )}

            <button type="button" disabled={create.isPending} onClick={submitCreate} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Create referral link
            </button>
          </div>

          <div className="mt-5 rounded-2xl bg-white/45 p-4 text-xs leading-5 text-muted-foreground">
            <ShieldCheck className="mb-2 size-4" /> Assign specific products to each collaborator. Their dashboard and attributed sales are scoped to those products.
          </div>
        </div>

        <div className="glass rounded-4xl p-7">
          <div className="flex items-center justify-between"><div><h2 className="font-display text-xl font-extrabold text-ink">Collaborator Partners</h2><p className="text-xs text-muted-foreground">Click a partner to manage products and referral links.</p></div>{partners.isLoading ? <Loader2 className="size-5 animate-spin" /> : null}</div>
          <div className="mt-5 space-y-3">
            {!partners.isLoading && rows.length === 0 ? <p className="rounded-3xl bg-white/45 p-8 text-center text-sm text-muted-foreground">No collaborators yet.</p> : null}
            {rows.map((partner) => <PartnerCard key={partner.user_id} partner={partner} products={products.data ?? []} open={expanded === partner.user_id} onOpen={() => setExpanded(expanded === partner.user_id ? null : partner.user_id)} onSave={(ids) => saveAccess.mutate({ userId: partner.user_id, productIds: ids })} onRevoke={() => { if (window.confirm(`Revoke access for ${partner.email}?`)) revoke.mutate(partner.user_id); }} onToggle={(id, active) => toggle.mutate({ id, active })} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="glass rounded-3xl p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-2 font-display text-2xl font-extrabold text-ink">{value}</p></div>;
}

function PartnerCard({ partner, products, open, onOpen, onSave, onRevoke, onToggle }: { partner: Partner; products: Product[]; open: boolean; onOpen: () => void; onSave: (ids: string[]) => void; onRevoke: () => void; onToggle: (id: string, active: boolean) => void }) {
  const [selected, setSelected] = useState(partner.product_ids);
  return <article className="rounded-3xl bg-white/55 p-5">
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-4 text-left">
      <span className="min-w-0 flex-1"><span className="block truncate font-display font-extrabold text-ink">{partner.full_name || partner.email}</span><span className="block truncate text-xs text-muted-foreground">{partner.email}</span></span>
      <span className="hidden text-xs text-muted-foreground sm:block">{partner.product_ids.length} products · {partner.totals.visitors} visitors · {partner.totals.sales} sales</span>
      <span className={`rounded-full px-3 py-1 text-xs font-bold ${partner.active ? "bg-accent text-accent-foreground" : "bg-ink/10 text-ink/60"}`}>{partner.active ? "Active" : "Revoked"}</span>
    </button>
    {open ? <div className="mt-5 border-t border-ink/10 pt-5">
      <div className="grid gap-2 sm:grid-cols-2">
        {products.map((p) => { const checked = selected.includes(p.id); return <button key={p.id} type="button" disabled={!partner.active} onClick={() => setSelected((s) => checked ? s.filter((id) => id !== p.id) : [...s, p.id])} className={`rounded-2xl p-3 text-left ${checked ? "bg-primary/10 ring-1 ring-primary/20" : "bg-white/60"}`}><span className="block text-sm font-semibold text-ink">{checked ? "✓ " : "○ "}{p.title}</span><span className="text-xs text-muted-foreground">{p.category} · {inr(p.price)}</span></button>; })}
      </div>
      <div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={!partner.active || saveBusy()} onClick={() => onSave(selected)} className="rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground">Save product access</button>{partner.active ? <button type="button" onClick={onRevoke} className="inline-flex items-center gap-2 rounded-full bg-destructive/10 px-5 py-2.5 text-xs font-semibold text-destructive"><UserX className="size-3.5" /> Revoke access</button> : null}</div>
      <h3 className="mt-6 font-display font-extrabold text-ink">Referral links</h3>
      <div className="mt-3 space-y-2">{partner.links.map((link) => <div key={link.id} className="rounded-2xl bg-white/60 p-4"><div className="flex flex-wrap items-center gap-2"><span className="min-w-0 flex-1 font-semibold">{link.name}</span><span className="text-xs text-muted-foreground">{link.active ? "Active" : "Paused"} · {link.visitors} visitors · {link.sales} sales · {inr(link.revenue)}</span><button type="button" onClick={() => void navigator.clipboard?.writeText(`${window.location.origin}${link.url}`).then(() => toast.success("Link copied"))} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold"><Copy className="mr-1 inline size-3" />Copy</button><a href={link.url} target="_blank" rel="noreferrer" className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold"><ExternalLink className="mr-1 inline size-3" />Open</a><button type="button" onClick={() => onToggle(link.id, !link.active)} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold">{link.active ? "Pause" : "Reactivate"}</button></div></div>)}</div>
    </div> : null}
  </article>;
}

function saveBusy() { return false; }

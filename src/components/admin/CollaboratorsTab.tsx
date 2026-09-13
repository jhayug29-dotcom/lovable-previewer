import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  ExternalLink,
  Filter,
  Link as LinkIcon,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  Users,
  UserX,
} from "lucide-react";
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

const getFullUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (typeof window !== "undefined") {
    return `${window.location.origin}${url.startsWith("/") ? url : `/${url}`}`;
  }
  return url;
};

type Product = { id: string; title: string; category: string; price: number; active: boolean };
type UserRow = {
  id: string;
  email: string;
  fullName: string | null;
  isAdmin: boolean;
  roleRowId: string | null;
};
type LinkRow = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  url: string;
  visitors: number;
  page_views: number;
  signups: number;
  sales: number;
  revenue: number;
};
type Partner = {
  user_id: string;
  email: string;
  full_name: string | null;
  active: boolean;
  product_ids: string[];
  products: Product[];
  totals: {
    visitors: number;
    page_views: number;
    signups: number;
    sales: number;
    revenue: number;
  };
  links: LinkRow[];
};
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
  const [linkFilter, setLinkFilter] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const partners = useQuery<Partner[]>({
    queryKey: ["collaborator-partners", token ?? ""],
    queryFn: () => listCollaboratorPartners({ data: { accessToken: token } }),
    enabled: Boolean(token),
    staleTime: 0,
    refetchInterval: 5_000,
  });

  // Ultra-intelligent Realtime synchronization for Admin Collaborators Tab
  useEffect(() => {
    if (!supabase || !token) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const triggerRefresh = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        void qc.invalidateQueries({ queryKey: ["collaborator-partners"] });
      }, 150);
    };

    const channel = supabase
      .channel("admin-collaborators-realtime")
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
  }, [token, qc]);

  const products = useQuery<Product[]>({
    queryKey: ["collaborator-products", token ?? ""],
    queryFn: async () => {
      try {
        const res = await listCollaboratorProducts({ data: { accessToken: token } });
        if (res && res.length > 0) return res;
      } catch (e) {
        console.warn("Server listCollaboratorProducts error, checking fallback:", e);
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

  const users = useQuery<UserRow[]>({
    queryKey: ["admin-users-for-collaborators", token ?? ""],
    queryFn: () => listAdminUsers({ data: { accessToken: token } }),
    enabled: Boolean(token),
    staleTime: 60_000,
  });

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    const rows = users.data ?? [];
    if (!q) return rows;
    return rows.filter((user) =>
      [user.fullName, user.email].some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(q),
      ),
    );
  }, [userSearch, users.data]);

  const toggleCreateProduct = (id: string) =>
    setCreateProductIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  const selectAllProducts = () => {
    const all = (products.data ?? []).map((p) => p.id);
    setCreateProductIds(all);
  };

  const deselectAllProducts = () => {
    setCreateProductIds([]);
  };

  const create = useMutation({
    mutationFn: () =>
      createCollaboratorLink({
        data: {
          accessToken: token,
          name: name.trim(),
          userId: recipientMode === "select" ? selectedUserId : undefined,
          email: recipientMode === "email" ? email.trim() : undefined,
          productIds: createProductIds,
        },
      }),
    onSuccess: (data) => {
      const fullUrl = getFullUrl(data.url);
      setCreatedLink({
        name: data.name,
        url: fullUrl,
        code: data.code,
      });
      setName("");
      setSelectedUserId("");
      setEmail("");
      setUserSearch("");
      toast.success("Collaborator referral link created successfully!");
      void qc.invalidateQueries({ queryKey: ["collaborator-partners"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not create collaborator link");
    },
  });

  const toggle = useMutation({
    mutationFn: (args: { id: string; active: boolean }) =>
      toggleCollaboratorLink({
        data: { accessToken: token, linkId: args.id, active: args.active },
      }),
    onSuccess: (_, args) => {
      toast.success(args.active ? "Referral link reactivated" : "Referral link paused");
      void qc.invalidateQueries({ queryKey: ["collaborator-partners"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not update link status");
    },
  });

  const saveAccess = useMutation({
    mutationFn: (args: { userId: string; productIds: string[] }) =>
      saveCollaboratorProductAccess({
        data: { accessToken: token, userId: args.userId, productIds: args.productIds },
      }),
    onSuccess: () => {
      toast.success("Product access saved");
      void qc.invalidateQueries({ queryKey: ["collaborator-partners"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not save access");
    },
  });

  const revoke = useMutation({
    mutationFn: (userId: string) =>
      revokeCollaboratorPartner({
        data: { accessToken: token, userId },
      }),
    onSuccess: () => {
      toast.success("Partner access revoked");
      void qc.invalidateQueries({ queryKey: ["collaborator-partners"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Could not revoke partner");
    },
  });

  const rows = useMemo(() => partners.data ?? [], [partners.data]);
  const visitorTotal = rows.reduce((sum, partner) => sum + partner.totals.visitors, 0);
  const viewsTotal = rows.reduce((sum, partner) => sum + partner.totals.page_views, 0);
  const signupTotal = rows.reduce((sum, partner) => sum + (partner.totals.signups || 0), 0);
  const salesTotal = rows.reduce((sum, partner) => sum + partner.totals.sales, 0);
  const revenueTotal = rows.reduce((sum, partner) => sum + partner.totals.revenue, 0);

  // Flatten all permanent links across all partners
  const allPermanentLinks = useMemo(() => {
    const list: Array<
      LinkRow & {
        partnerEmail: string;
        partnerName: string | null;
        partnerUserId: string;
        partnerActive: boolean;
      }
    > = [];
    for (const partner of rows) {
      for (const link of partner.links) {
        list.push({
          ...link,
          partnerEmail: partner.email,
          partnerName: partner.full_name,
          partnerUserId: partner.user_id,
          partnerActive: partner.active,
        });
      }
    }
    return list;
  }, [rows]);

  const filteredPermanentLinks = useMemo(() => {
    const q = linkFilter.trim().toLowerCase();
    if (!q) return allPermanentLinks;
    return allPermanentLinks.filter((l) =>
      [l.name, l.code, l.partnerEmail, l.partnerName ?? ""].some((v) =>
        v.toLowerCase().includes(q),
      ),
    );
  }, [allPermanentLinks, linkFilter]);

  const handleCopy = (id: string, text: string) => {
    if (!navigator.clipboard) return;
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      toast.success("Permanent referral link copied!");
      setTimeout(() => setCopiedId(null), 2500);
    });
  };

  const switchMode = (mode: RecipientMode) => {
    setRecipientMode(mode);
    setSelectedUserId("");
    setEmail("");
    setUserSearch("");
  };

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
      toast.error("Select at least one product for collaborator attribution");
      return;
    }
    if (!token) {
      toast.error("Admin session expired. Refresh the page and sign in again.");
      return;
    }
    create.mutate();
  };

  return (
    <div className="space-y-8">
      {/* Overview Analytics Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Collaborators" value={String(rows.length)} hint="Active partners" />
        <Stat
          label="Total Visitors"
          value={String(visitorTotal)}
          hint={`${viewsTotal} total views`}
        />
        <Stat label="Sign-ups" value={String(signupTotal)} hint="Referred registered accounts" />
        <Stat label="Total Sales" value={String(salesTotal)} hint="Attributed paid orders" />
        <Stat label="Gross Revenue" value={inr(revenueTotal)} hint="From referral traffic" />
      </div>

      {/* Newly Created Link Announcement Banner */}
      {createdLink ? (
        <div className="glass relative overflow-hidden rounded-3xl p-6 ring-2 ring-primary/40 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary text-white">
                  <Check className="size-3.5" />
                </span>
                <p className="text-xs font-bold uppercase tracking-wider text-primary">
                  New Referral Link Created & Permanently Saved
                </p>
              </div>
              <p className="mt-2 font-display text-lg font-extrabold text-ink">
                {createdLink.name}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  readOnly
                  value={createdLink.url}
                  className="w-full max-w-xl rounded-xl border border-ink/10 bg-white/80 px-3 py-2 font-mono text-xs text-ink outline-none select-all"
                />
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Referral Code:{" "}
                <span className="font-mono font-semibold text-ink">{createdLink.code}</span> · Saved
                permanently in the list below.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:self-center">
              <button
                type="button"
                onClick={() => handleCopy("banner", createdLink.url)}
                className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
              >
                {copiedId === "banner" ? (
                  <Check className="size-3.5 text-white" />
                ) : (
                  <Copy className="size-3.5" />
                )}
                {copiedId === "banner" ? "Copied!" : "Copy Link"}
              </button>
              <a
                href={createdLink.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-full border border-ink/10 bg-white px-4 py-2.5 text-xs font-semibold text-ink shadow-sm transition hover:bg-white/80"
              >
                <ExternalLink className="size-3.5" /> Test Link
              </a>
              <button
                type="button"
                onClick={() => setCreatedLink(null)}
                className="rounded-full bg-white/60 px-4 py-2.5 text-xs font-semibold text-muted-foreground transition hover:bg-white"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* PERMANENT REFERRAL LINKS DIRECTORY */}
      <section className="glass rounded-4xl p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <LinkIcon className="size-4" />
              </div>
              <h2 className="font-display text-xl font-extrabold text-ink">
                Permanent Referral Links
              </h2>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                {allPermanentLinks.length} Active Links
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Every collaborator referral link is permanently visible here with real-time tracking
              for visitors, sign-ups, sales, and revenue.
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={linkFilter}
              onChange={(e) => setLinkFilter(e.target.value)}
              placeholder="Search by code, name, or partner..."
              className="w-full rounded-full border border-ink/10 bg-white/80 py-2.5 pl-10 pr-4 text-xs text-ink outline-none transition focus:border-primary focus:bg-white"
            />
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {filteredPermanentLinks.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-ink/15 bg-white/30 p-8 text-center">
              <LinkIcon className="mx-auto size-8 text-muted-foreground/50" />
              <p className="mt-2 text-sm font-semibold text-ink">
                {linkFilter
                  ? "No referral links match your search."
                  : "No collaborator links generated yet."}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create a collaborator below to generate their permanent referral tracking link.
              </p>
            </div>
          ) : (
            filteredPermanentLinks.map((link) => {
              const fullUrl = getFullUrl(link.url);
              const conversionRate =
                link.visitors > 0 ? ((link.sales / link.visitors) * 100).toFixed(1) : "0.0";
              const isCopied = copiedId === link.id;

              return (
                <article
                  key={link.id}
                  className="rounded-3xl border border-ink/5 bg-white/70 p-5 shadow-sm transition hover:bg-white/90"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-base font-extrabold text-ink">
                          {link.name}
                        </span>
                        <span className="rounded-md bg-ink/5 px-2 py-0.5 font-mono text-[11px] font-semibold text-ink/70">
                          Code: {link.code}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Partner:{" "}
                          <span className="font-medium text-ink">
                            {link.partnerName || link.partnerEmail}
                          </span>
                        </span>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                            link.active
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-ink/10 text-ink/60"
                          }`}
                        >
                          {link.active ? "Active" : "Paused"}
                        </span>
                      </div>

                      {/* Permanent URL input with 1-click actions */}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <input
                          readOnly
                          value={fullUrl}
                          className="min-w-[280px] flex-1 rounded-xl border border-ink/10 bg-white/90 px-3.5 py-2 font-mono text-xs text-ink outline-none select-all"
                        />
                        <button
                          type="button"
                          onClick={() => handleCopy(link.id, fullUrl)}
                          className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold shadow-xs transition ${
                            isCopied
                              ? "bg-emerald-600 text-white"
                              : "bg-primary text-primary-foreground hover:bg-primary/90"
                          }`}
                        >
                          {isCopied ? (
                            <Check className="size-3.5" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                          {isCopied ? "Copied" : "Copy Link"}
                        </button>
                        <a
                          href={fullUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1.5 rounded-xl border border-ink/10 bg-white px-3.5 py-2 text-xs font-semibold text-ink shadow-xs transition hover:bg-white/80"
                        >
                          <ExternalLink className="size-3.5" /> Test Link
                        </a>
                        <button
                          type="button"
                          disabled={toggle.isPending}
                          onClick={() => toggle.mutate({ id: link.id, active: !link.active })}
                          className="rounded-xl border border-ink/10 bg-white px-3.5 py-2 text-xs font-semibold text-muted-foreground transition hover:text-ink disabled:opacity-50"
                        >
                          {toggle.isPending ? "..." : link.active ? "Pause" : "Activate"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Real-time stats grid */}
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-6 pt-3 border-t border-ink/5">
                    <MiniMetric label="Visitors" value={String(link.visitors)} />
                    <MiniMetric label="Page Views" value={String(link.page_views)} />
                    <MiniMetric label="Sign-ups" value={String(link.signups || 0)} highlight />
                    <MiniMetric label="Sales" value={String(link.sales)} />
                    <MiniMetric label="Revenue" value={inr(link.revenue)} />
                    <MiniMetric label="Conv. Rate" value={`${conversionRate}%`} />
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      {/* MANAGEMENT GRID: CREATE COLLABORATOR & PARTNER DIRECTORY */}
      <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
        {/* CREATE COLLABORATOR FORM */}
        <div className="glass h-fit rounded-4xl p-7">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Plus className="size-4" />
            </div>
            <h2 className="font-display text-xl font-extrabold text-ink">Generate New Link</h2>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Create a unique permanent tracking link for any partner or registered user.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-ink">Link / Campaign Name</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. YouTube Promo, Summer Launch, John Referral"
                className="mt-1 w-full rounded-2xl border border-ink/10 bg-white/75 px-4 py-3 text-sm outline-none transition focus:border-primary focus:bg-white"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-ink">Assign Collaborator</label>
              <div className="mt-1 rounded-2xl bg-white/45 p-1">
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => switchMode("select")}
                    className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                      recipientMode === "select"
                        ? "bg-white shadow-xs text-ink"
                        : "text-muted-foreground hover:text-ink"
                    }`}
                  >
                    <UserCheck className="size-3.5" /> Registered user
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("email")}
                    className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                      recipientMode === "email"
                        ? "bg-white shadow-xs text-ink"
                        : "text-muted-foreground hover:text-ink"
                    }`}
                  >
                    Enter email
                  </button>
                </div>
              </div>
            </div>

            {recipientMode === "select" ? (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={userSearch}
                    onChange={(event) => setUserSearch(event.target.value)}
                    placeholder="Search registered accounts..."
                    className="w-full rounded-xl border border-ink/10 bg-white/70 py-2 pl-9 pr-3 text-xs outline-none focus:border-primary"
                  />
                </div>
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-2xl border border-ink/10 bg-white/60 p-2">
                  {users.isLoading ? (
                    <div className="flex items-center justify-center py-4 text-xs text-muted-foreground">
                      <Loader2 className="mr-2 size-3.5 animate-spin" /> Loading accounts...
                    </div>
                  ) : null}
                  {!users.isLoading && filteredUsers.length === 0 ? (
                    <p className="p-3 text-center text-xs text-muted-foreground">
                      No accounts found.
                    </p>
                  ) : null}
                  {filteredUsers.map((user) => {
                    const selected = selectedUserId === user.id;
                    return (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => setSelectedUserId(user.id)}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs transition ${
                          selected
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "hover:bg-white"
                        }`}
                      >
                        <span className="truncate">
                          {user.fullName || user.email}
                          {user.fullName ? (
                            <span
                              className={`ml-1 text-[11px] ${selected ? "text-primary-foreground/80" : "text-muted-foreground"}`}
                            >
                              ({user.email})
                            </span>
                          ) : null}
                        </span>
                        {selected ? <Check className="size-3.5 shrink-0" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="collaborator@example.com"
                  className="w-full rounded-2xl border border-ink/10 bg-white/75 px-4 py-3 text-sm outline-none focus:border-primary"
                />
              </div>
            )}

            {/* PRODUCT SELECTION */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-ink">
                  Attributed Products ({createProductIds.length})
                </label>
                <div className="flex gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={selectAllProducts}
                    className="text-primary hover:underline font-medium"
                  >
                    Select All
                  </button>
                  <span>·</span>
                  <button
                    type="button"
                    onClick={deselectAllProducts}
                    className="text-muted-foreground hover:underline"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="mt-2 max-h-48 space-y-1.5 overflow-y-auto rounded-2xl border border-ink/10 bg-white/60 p-2">
                {(products.data ?? []).map((product) => {
                  const checked = createProductIds.includes(product.id);
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => toggleCreateProduct(product.id)}
                      className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
                        checked ? "bg-primary/10 ring-1 ring-primary/20" : "hover:bg-white"
                      }`}
                    >
                      <span
                        className={`flex size-4.5 shrink-0 items-center justify-center rounded border text-[10px] ${
                          checked
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-ink/20 bg-white"
                        }`}
                      >
                        {checked ? "✓" : ""}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink">
                        {product.title}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {inr(product.price)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              disabled={create.isPending || !token}
              onClick={submit}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-60"
            >
              {create.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Create Permanent Referral Link
            </button>
          </div>

          <div className="mt-5 rounded-2xl bg-white/45 p-4 text-xs leading-5 text-muted-foreground">
            <ShieldCheck className="mb-1 size-4 text-emerald-600" />
            Links are securely generated and verified through authenticated server functions,
            protecting attribution integrity across all transactions.
          </div>
        </div>

        {/* COLLABORATOR PARTNERS DIRECTORY */}
        <div className="glass rounded-4xl p-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="size-4" />
              </div>
              <div>
                <h2 className="font-display text-xl font-extrabold text-ink">
                  Collaborator Partners ({rows.length})
                </h2>
                <p className="text-xs text-muted-foreground">
                  Expand a partner to manage product access and review their assigned links.
                </p>
              </div>
            </div>
            {partners.isLoading ? <Loader2 className="size-5 animate-spin" /> : null}
            {partners.isError ? (
              <button
                type="button"
                onClick={() => void partners.refetch()}
                className="text-xs font-semibold text-destructive underline"
              >
                Retry
              </button>
            ) : null}
          </div>

          <div className="mt-5 space-y-3">
            {partners.isError ? (
              <p className="rounded-3xl bg-destructive/10 p-4 text-xs text-destructive">
                {partners.error instanceof Error
                  ? partners.error.message
                  : "Could not load collaborators"}
              </p>
            ) : null}
            {!partners.isLoading && !partners.isError && rows.length === 0 ? (
              <div className="rounded-3xl bg-white/45 p-8 text-center text-sm text-muted-foreground">
                No collaborators configured yet. Use the form on the left to create one.
              </div>
            ) : null}
            {rows.map((partner) => (
              <PartnerCard
                key={partner.user_id}
                partner={partner}
                products={products.data ?? []}
                open={expanded === partner.user_id}
                onOpen={() => setExpanded(expanded === partner.user_id ? null : partner.user_id)}
                onSave={(productIds) => saveAccess.mutate({ userId: partner.user_id, productIds })}
                saving={saveAccess.isPending}
                onRevoke={() => {
                  if (window.confirm(`Revoke access for ${partner.email}?`))
                    revoke.mutate(partner.user_id);
                }}
                revoking={revoke.isPending}
                onToggle={(id, active) => toggle.mutate({ id, active })}
                toggling={toggle.isPending}
                onCopyLink={(id, url) => handleCopy(id, url)}
                copiedId={copiedId}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="glass rounded-3xl p-5 shadow-xs">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-display text-2xl font-extrabold text-ink">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function MiniMetric({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-xl px-2.5 py-2 ${highlight ? "bg-primary/10" : "bg-white/60"}`}>
      <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={`block font-display text-sm font-extrabold ${highlight ? "text-primary" : "text-ink"}`}
      >
        {value}
      </span>
    </div>
  );
}

function PartnerCard({
  partner,
  products,
  open,
  onOpen,
  onSave,
  saving,
  onRevoke,
  revoking,
  onToggle,
  toggling,
  onCopyLink,
  copiedId,
}: {
  partner: Partner;
  products: Product[];
  open: boolean;
  onOpen: () => void;
  onSave: (ids: string[]) => void;
  saving: boolean;
  onRevoke: () => void;
  revoking: boolean;
  onToggle: (id: string, active: boolean) => void;
  toggling: boolean;
  onCopyLink: (id: string, url: string) => void;
  copiedId: string | null;
}) {
  const [selected, setSelected] = useState<string[]>(partner.product_ids);
  useEffect(() => setSelected(partner.product_ids), [partner.product_ids]);
  const toggleProduct = (productId: string) =>
    setSelected((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );

  const primaryLink = partner.links[0];
  const primaryFullUrl = primaryLink ? getFullUrl(primaryLink.url) : null;

  return (
    <article className="rounded-3xl border border-ink/5 bg-white/60 p-5 shadow-xs transition hover:bg-white/75">
      <button type="button" onClick={onOpen} className="flex w-full items-center gap-4 text-left">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display font-extrabold text-ink">
            {partner.full_name || partner.email}
          </span>
          <span className="block truncate text-xs text-muted-foreground">{partner.email}</span>
        </span>
        <span className="hidden text-xs text-muted-foreground sm:block">
          {partner.product_ids.length} products · {partner.totals.visitors} visitors ·{" "}
          {partner.totals.signups || 0} sign-ups · {partner.totals.sales} sales
        </span>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${partner.active ? "bg-emerald-500/10 text-emerald-600" : "bg-ink/10 text-ink/60"}`}
        >
          {partner.active ? "Active" : "Revoked"}
        </span>
      </button>

      {/* Quick link preview on collapsed card */}
      {!open && primaryLink ? (
        <div className="mt-3 flex items-center justify-between rounded-xl bg-white/70 px-3 py-2 text-xs">
          <span className="truncate font-mono text-muted-foreground">{primaryFullUrl}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCopyLink(primaryLink.id, primaryFullUrl!);
            }}
            className="ml-2 flex shrink-0 items-center gap-1 font-semibold text-primary hover:underline"
          >
            {copiedId === primaryLink.id ? (
              <Check className="size-3 text-emerald-600" />
            ) : (
              <Copy className="size-3" />
            )}
            {copiedId === primaryLink.id ? "Copied" : "Copy"}
          </button>
        </div>
      ) : null}

      {open ? (
        <div className="mt-5 border-t border-ink/10 pt-5 space-y-6">
          {/* ASSIGNED PERMANENT REFERRAL LINKS */}
          <div>
            <h3 className="font-display text-sm font-extrabold text-ink">
              Assigned Referral Links ({partner.links.length})
            </h3>
            <div className="mt-3 space-y-2">
              {partner.links.map((link) => {
                const fullUrl = getFullUrl(link.url);
                const isCopied = copiedId === link.id;

                return (
                  <div key={link.id} className="rounded-2xl border border-ink/5 bg-white/90 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-ink">{link.name}</span>
                        <span className="rounded bg-ink/5 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {link.code}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onCopyLink(link.id, fullUrl)}
                          className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold shadow-xs transition ${
                            isCopied
                              ? "bg-emerald-600 text-white"
                              : "bg-primary text-primary-foreground hover:bg-primary/90"
                          }`}
                        >
                          {isCopied ? <Check className="size-3" /> : <Copy className="size-3" />}
                          {isCopied ? "Copied" : "Copy Link"}
                        </button>
                        <a
                          href={fullUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-semibold text-ink hover:bg-white/80"
                        >
                          <ExternalLink className="size-3" /> Open
                        </a>
                        <button
                          type="button"
                          disabled={toggling}
                          onClick={() => onToggle(link.id, !link.active)}
                          className="rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-semibold text-muted-foreground hover:text-ink disabled:opacity-50"
                        >
                          {toggling ? "..." : link.active ? "Pause" : "Reactivate"}
                        </button>
                      </div>
                    </div>

                    <div className="mt-2 font-mono text-xs text-muted-foreground select-all bg-ink/5 rounded-lg px-2.5 py-1.5">
                      {fullUrl}
                    </div>

                    <div className="mt-3 grid grid-cols-5 gap-2 text-center">
                      <div className="rounded-lg bg-ink/5 p-1.5">
                        <div className="text-[10px] text-muted-foreground">Visitors</div>
                        <div className="font-bold text-xs">{link.visitors}</div>
                      </div>
                      <div className="rounded-lg bg-ink/5 p-1.5">
                        <div className="text-[10px] text-muted-foreground">Views</div>
                        <div className="font-bold text-xs">{link.page_views}</div>
                      </div>
                      <div className="rounded-lg bg-primary/10 p-1.5">
                        <div className="text-[10px] text-primary">Sign-ups</div>
                        <div className="font-bold text-xs text-primary">{link.signups || 0}</div>
                      </div>
                      <div className="rounded-lg bg-ink/5 p-1.5">
                        <div className="text-[10px] text-muted-foreground">Sales</div>
                        <div className="font-bold text-xs">{link.sales}</div>
                      </div>
                      <div className="rounded-lg bg-ink/5 p-1.5">
                        <div className="text-[10px] text-muted-foreground">Revenue</div>
                        <div className="font-bold text-xs">{inr(link.revenue)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {partner.links.length === 0 ? (
                <p className="rounded-2xl bg-white/45 p-4 text-xs text-muted-foreground">
                  No referral links generated yet for this partner.
                </p>
              ) : null}
            </div>
          </div>

          {/* PRODUCT ACCESS MANAGEMENT */}
          <div>
            <h3 className="font-display text-sm font-extrabold text-ink">
              Authorized Products ({selected.length})
            </h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(products.length ? products : partner.products).map((product) => {
                const checked = selected.includes(product.id);
                return (
                  <button
                    key={product.id}
                    type="button"
                    disabled={!partner.active}
                    onClick={() => toggleProduct(product.id)}
                    className={`rounded-2xl p-3 text-left transition disabled:opacity-50 ${
                      checked
                        ? "bg-primary/10 ring-1 ring-primary/20"
                        : "bg-white/60 hover:bg-white"
                    }`}
                  >
                    <span className="block text-xs font-semibold text-ink">
                      {checked ? "✓ " : "○ "}
                      {product.title}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {product.category} · {inr(product.price)}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!partner.active || saving}
                onClick={() => onSave([...new Set(selected)])}
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? <Loader2 className="size-3.5 animate-spin" /> : null} Save product access
              </button>
              {partner.active ? (
                <button
                  type="button"
                  disabled={revoking}
                  onClick={onRevoke}
                  className="inline-flex items-center gap-2 rounded-full bg-destructive/10 px-5 py-2.5 text-xs font-semibold text-destructive transition hover:bg-destructive/20 disabled:opacity-50"
                >
                  <UserX className="size-3.5" /> {revoking ? "Revoking…" : "Revoke access"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}

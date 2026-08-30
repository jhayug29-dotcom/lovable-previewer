import { useEffect, useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  CircleUserRound,
  Download,
  ExternalLink,
  Loader2,
  LogOut,
  Package,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { signOut } from "@/lib/auth";
import { formatPrice } from "@/lib/products";

type PurchaseRow = {
  id: string;
  amount: number;
  created_at: string;
  download_link: string | null;
  products: {
    slug: string;
    title: string;
    cover_url: string | null;
    category: string | null;
    download_link: string | null;
  } | null;
};

type AccountData = {
  profile: {
    full_name: string | null;
    avatar_url: string | null;
    created_at: string | null;
  } | null;
  purchases: PurchaseRow[];
};

/**
 * Loads the signed-in user's profile row and their paid orders in one pass.
 *
 * Both reads go through the *browser* client on purpose — `profiles` and `orders`
 * each carry an owner-scoped RLS policy ("own profile read", "own orders read"),
 * so the database itself guarantees a user can only ever see their own rows. No
 * service-role key and no server function are involved.
 */
async function fetchAccount(userId: string): Promise<AccountData> {
  if (!supabase) return { profile: null, purchases: [] };
  const client = supabase;

  const [profileRes, ordersRes] = await Promise.all([
    client
      .from("profiles")
      .select("full_name, avatar_url, created_at")
      .eq("id", userId)
      .maybeSingle(),
    client
      .from("orders")
      .select(
        "id, amount, created_at, download_link, products(slug, title, cover_url, category, download_link)",
      )
      .eq("user_id", userId)
      .eq("status", "PAID")
      .order("created_at", { ascending: false }),
  ]);

  return {
    profile: (profileRes.data as AccountData["profile"]) ?? null,
    purchases: (ordersRes.data as PurchaseRow[] | null) ?? [],
  };
}

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * The header's account control.
 *
 * Signed out it is a plain link to `/auth` — unchanged behaviour. Signed in it
 * becomes a disclosure button that opens a panel with the user's profile and every
 * pack they own, each with its download link. Purchases are fetched lazily (only
 * once the panel is first opened) so the header costs a signed-in visitor nothing
 * until they ask for it.
 */
export function AccountMenu() {
  const { user, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // `enabled` keeps this from firing until the panel is opened; react-query then
  // caches it, so re-opening is instant.
  const { data, isPending } = useQuery({
    queryKey: ["account-purchases", user?.id],
    queryFn: () => fetchAccount(user!.id),
    enabled: open && Boolean(user?.id),
    staleTime: 60_000,
  });

  useEffect(() => setOpen(false), [pathname]);

  // Dismiss on outside click / Escape. Both listeners are only attached while the
  // panel is open, so a closed menu adds no global handlers.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!user) {
    return (
      <Link
        to="/auth"
        className="glass flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-ink transition-transform duration-500 hover:scale-105 active:scale-95"
        aria-label="Sign in"
      >
        <CircleUserRound className="size-5" strokeWidth={1.6} />
        <span className="hidden sm:inline">Sign in</span>
      </Link>
    );
  }

  const meta = user.user_metadata as { full_name?: string; avatar_url?: string } | undefined;
  const name = data?.profile?.full_name ?? meta?.full_name ?? user.email?.split("@")[0] ?? "You";
  const avatar = data?.profile?.avatar_url ?? meta?.avatar_url ?? null;
  const since = data?.profile?.created_at ?? user.created_at;
  const purchases = data?.purchases ?? [];

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Your account and purchases"
        className="glass flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-ink transition-transform duration-500 hover:scale-105 active:scale-95"
      >
        {avatar ? (
          <img
            src={avatar}
            alt=""
            className="size-6 rounded-full object-cover"
            width={24}
            height={24}
          />
        ) : (
          <CircleUserRound className="size-5" strokeWidth={1.6} />
        )}
        <span className="hidden sm:inline">Account</span>
      </button>

      {open ? (
        <AccountPanel
          {...{ name, avatar, since, purchases, isPending, isAdmin }}
          email={user.email ?? ""}
        />
      ) : null}
    </div>
  );
}

/** The disclosed panel: identity block, then every pack the user owns. */
function AccountPanel({
  name,
  email,
  avatar,
  since,
  purchases,
  isPending,
  isAdmin,
}: {
  name: string;
  email: string;
  avatar: string | null;
  since: string | null | undefined;
  purchases: PurchaseRow[];
  isPending: boolean;
  isAdmin: boolean;
}) {
  /* Placement is breakpoint-dependent. From `sm` up the panel hangs off the
     button's right edge, which is what you want next to a header control. On a
     phone that anchor doesn't fit: the button sits ~72px in from the right (its
     own padding plus the hamburger beside it), so a 23rem panel pinned to it
     starts ~40px off the left edge of the screen and the first characters of
     every line get cut. Below `sm` it becomes a viewport-anchored sheet instead
     — `inset-x-4` gives it the same 1rem gutters the header uses, and
     `top-[4.375rem]` puts it 0.6rem below the fixed-height sticky header bar. */
  return (
    <div
      role="menu"
      aria-label="Account"
      className="animate-rise-in z-50 w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-border/60 bg-popover text-popover-foreground shadow-[0_30px_80px_-30px_rgba(0,0,0,0.55)] max-sm:fixed max-sm:inset-x-4 max-sm:top-[4.375rem] max-sm:w-auto sm:absolute sm:right-0 sm:top-[calc(100%+0.6rem)]"
    >
      {/* ---------------------------------------------------------- profile */}
      <div className="flex items-start gap-3 border-b border-border/60 p-4">
        {avatar ? (
          <img
            src={avatar}
            alt=""
            className="size-11 shrink-0 rounded-full object-cover"
            width={44}
            height={44}
          />
        ) : (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-base font-bold uppercase text-foreground">
            {name.slice(0, 1)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
          {since ? (
            <p className="mt-1 text-[0.7rem] text-muted-foreground">
              Member since {dateFmt.format(new Date(since))}
            </p>
          ) : null}
        </div>
        {isAdmin ? (
          <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-foreground">
            <ShieldCheck className="size-3" strokeWidth={2} />
            Admin
          </span>
        ) : null}
      </div>

      {/* -------------------------------------------------------- purchases */}
      <div className="max-h-[min(26rem,50vh)] overflow-y-auto p-2">
        <p className="px-2 pb-1 pt-2 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-muted-foreground">
          Your purchases {purchases.length > 0 ? `(${purchases.length})` : ""}
        </p>

        {isPending ? (
          <p className="flex items-center gap-2 px-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" strokeWidth={2} />
            Loading your packs…
          </p>
        ) : purchases.length === 0 ? (
          <div className="px-2 py-5 text-sm text-muted-foreground">
            <Package className="mb-2 size-5" strokeWidth={1.6} />
            Nothing here yet. Every pack you buy shows up in this list with its download link.
            <Link
              to="/store"
              className="mt-3 flex w-fit items-center gap-1.5 text-sm font-semibold text-foreground hover:underline"
            >
              Browse the store
              <ExternalLink className="size-3.5" strokeWidth={1.8} />
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {purchases.map((order) => (
              <PurchaseItem key={order.id} order={order} />
            ))}
          </ul>
        )}
      </div>

      {/* ------------------------------------------------------------ actions */}
      <div className="flex items-center justify-between gap-2 border-t border-border/60 p-2">
        {isAdmin ? (
          <Link
            to="/admin"
            role="menuitem"
            className="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <ShieldCheck className="size-4" strokeWidth={1.7} />
            Admin panel
          </Link>
        ) : (
          <Link
            to="/store"
            role="menuitem"
            className="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            <Package className="size-4" strokeWidth={1.7} />
            Browse store
          </Link>
        )}
        <button
          type="button"
          role="menuitem"
          onClick={() => void signOut()}
          className="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="size-4" strokeWidth={1.7} />
          Sign out
        </button>
      </div>
    </div>
  );
}

/**
 * One owned pack.
 *
 * The row itself links to the product page; the download button is a sibling,
 * not a nested anchor, so the markup stays valid. The link is read from the
 * order first and only then from the product — an order snapshots the URL it was
 * sold with, so a later change to the product's link never breaks an old buyer's
 * download.
 */
function PurchaseItem({ order }: { order: PurchaseRow }) {
  const product = order.products;
  const href = order.download_link ?? product?.download_link ?? null;

  return (
    <li className="group/item flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-muted">
      {product?.cover_url ? (
        <img
          src={product.cover_url}
          alt=""
          loading="lazy"
          className="size-12 shrink-0 rounded-xl object-cover"
          width={48}
          height={48}
        />
      ) : (
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Package className="size-5 text-muted-foreground" strokeWidth={1.6} />
        </span>
      )}

      <div className="min-w-0 flex-1">
        {product?.slug ? (
          <Link
            to="/product/$slug"
            params={{ slug: product.slug }}
            role="menuitem"
            className="block truncate text-sm font-semibold text-foreground hover:underline"
          >
            {product.title}
          </Link>
        ) : (
          <p className="truncate text-sm font-semibold text-foreground">Purchase</p>
        )}
        <p className="truncate text-[0.7rem] text-muted-foreground">
          {[
            product?.category,
            order.amount > 0 ? formatPrice(order.amount) : "Free",
            dateFmt.format(new Date(order.created_at)),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          role="menuitem"
          aria-label={`Download ${product?.title ?? "your pack"}`}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-transform duration-300 hover:scale-105 active:scale-95"
        >
          <Download className="size-4" strokeWidth={1.9} />
        </a>
      ) : (
        <span className="shrink-0 px-2 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
          Emailed
        </span>
      )}
    </li>
  );
}

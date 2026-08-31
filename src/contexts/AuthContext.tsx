import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthState = {
  session: Session | null;
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  session: null,
  user: null,
  isAdmin: false,
  loading: true,
  signOut: async () => {},
});

export const MASTER_ADMIN_EMAILS = ["yjha019@gmail.com", "growchannel2026@gmail.com"];

export function isMasterAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return MASTER_ADMIN_EMAILS.some((adm) => adm.toLowerCase() === normalized);
}

/**
 * Module-level cache for the "is this user an admin?" lookup.
 *
 * Supabase's `onAuthStateChange` is chatty: it re-emits `SIGNED_IN` on token
 * refresh, on tab visibility changes, and on every `getSession()` call made
 * elsewhere in the app (the admin route, the page-view tracker and the OAuth
 * callback each make one). Without a cache that turned a single page load into
 * 40+ identical `user_roles?role=eq.admin` round-trips.
 *
 * A user's role does not change mid-visit, so the answer is cached for the tab's
 * lifetime and keyed by user id — signing in as somebody else misses the cache
 * and re-queries. `inflight` collapses concurrent callers onto one request so a
 * burst of events during startup still costs exactly one query.
 */
const roleCache = new Map<string, boolean>();
const inflight = new Map<string, Promise<boolean>>();

async function isUserAdmin(
  client: NonNullable<typeof supabase>,
  userId: string,
  userEmail?: string | null,
) {
  if (isMasterAdminEmail(userEmail)) {
    roleCache.set(userId, true);
    return true;
  }

  const cached = roleCache.get(userId);
  if (cached !== undefined) return cached;

  const pending = inflight.get(userId);
  if (pending) return pending;

  const request = (async () => {
    try {
      const { data, error } = await client
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      // Only a definitive answer is cached. A network/RLS failure must stay
      // uncached so the next event can retry instead of pinning `false`.
      if (error) return isMasterAdminEmail(userEmail);
      const admin = Boolean(data) || isMasterAdminEmail(userEmail);
      roleCache.set(userId, admin);
      return admin;
    } catch {
      return isMasterAdminEmail(userEmail);
    }
  })().finally(() => inflight.delete(userId));

  inflight.set(userId, request);
  return request;
}

async function syncUserProfile(client: NonNullable<typeof supabase>, user: User) {
  try {
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const fullName =
      (meta["full_name"] as string | undefined) ??
      (meta["name"] as string | undefined) ??
      user.email?.split("@")[0] ??
      "User";
    const avatarUrl = (meta["avatar_url"] as string | undefined) ?? null;
    await client.from("profiles").upsert(
      {
        id: user.id,
        email: user.email,
        full_name: fullName,
        avatar_url: avatarUrl,
        last_sign_in_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  } catch {
    // Non-blocking sync
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    let active = true;
    // Tracks who `isAdmin` currently describes, so a repeat event for the same
    // user is a no-op rather than another query.
    let resolvedFor: string | null = null;

    const loadRole = async (userId: string | undefined, userEmail?: string | null) => {
      if (!userId) {
        resolvedFor = null;
        if (active) setIsAdmin(false);
        return;
      }
      if (isMasterAdminEmail(userEmail)) {
        resolvedFor = userId;
        roleCache.set(userId, true);
        if (active) setIsAdmin(true);
        return;
      }
      if (userId === resolvedFor) return;
      resolvedFor = userId;
      const admin = await isUserAdmin(client, userId, userEmail);
      // Re-check: a sign-out or a switch to another account while this was in
      // flight must win over a late answer for the previous user.
      if (active && resolvedFor === userId) setIsAdmin(admin);
    };

    client.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      if (data.session?.user) {
        void syncUserProfile(client, data.session.user);
      }
      await loadRole(data.session?.user.id, data.session?.user.email);
      if (active) setLoading(false);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, next) => {
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
        setSession(next ?? null);
        if (next?.user) {
          void syncUserProfile(client, next.user);
        }
        void loadRole(next?.user.id, next?.user.email);
        return;
      }
      setSession(next ?? null);
      setLoading(false);
      if (next?.user) {
        void syncUserProfile(client, next.user);
      }
      void loadRole(next?.user.id, next?.user.email);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      isAdmin,
      loading,
      signOut: async () => {
        await supabase?.auth.signOut();
        setIsAdmin(false);
      },
    }),
    [session, isAdmin, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

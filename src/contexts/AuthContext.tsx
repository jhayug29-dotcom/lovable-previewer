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

/**
 * Module-level cache for the "is this user an admin?" lookup.
 */
const roleCache = new Map<string, boolean>();
const inflight = new Map<string, Promise<boolean>>();

async function isUserAdmin(client: NonNullable<typeof supabase>, user: User) {
  if (user.email && user.email.toLowerCase() === "growchannel2026@gmail.com") {
    return true;
  }

  const cached = roleCache.get(user.id);
  if (cached !== undefined) return cached;

  const pending = inflight.get(user.id);
  if (pending) return pending;

  const request = (async () => {
    const { data, error } = await client
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    // Only a definitive answer is cached. A network/RLS failure must stay
    // uncached so the next event can retry instead of pinning `false`.
    if (error) return false;
    const admin = Boolean(data);
    roleCache.set(user.id, admin);
    return admin;
  })().finally(() => inflight.delete(user.id));

  inflight.set(user.id, request);
  return request;
}

function syncUserProfile(client: NonNullable<typeof supabase>, user: User | undefined) {
  if (!user) return;
  void client
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email,
        full_name:
          (user.user_metadata?.["full_name"] as string | undefined) ||
          user.email?.split("@")[0] ||
          "",
        avatar_url: (user.user_metadata?.["avatar_url"] as string | undefined) || null,
      },
      { onConflict: "id" },
    )
    .then(
      () => {},
      () => {},
    );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    let active = true;
    let resolvedFor: string | null = null;

    const loadRole = async (user: User | undefined) => {
      if (!user) {
        resolvedFor = null;
        if (active) setIsAdmin(false);
        return;
      }
      syncUserProfile(client, user);

      if (user.id === resolvedFor) return;
      resolvedFor = user.id;
      const admin = await isUserAdmin(client, user);
      if (active && resolvedFor === user.id) setIsAdmin(admin);
    };

    client.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      await loadRole(data.session?.user);
      if (active) setLoading(false);
    });

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, next) => {
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
        setSession(next ?? null);
        return;
      }
      setSession(next ?? null);
      setLoading(false);
      void loadRole(next?.user);
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

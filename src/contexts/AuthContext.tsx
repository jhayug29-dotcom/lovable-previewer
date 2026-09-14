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

const roleCache = new Map<string, boolean>();
const inflight = new Map<string, Promise<boolean>>();

const KNOWN_ADMIN_EMAILS = new Set(["growchannel2026@gmail.com", "jhayug29@gmail.com"]);

function isKnownAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (KNOWN_ADMIN_EMAILS.has(normalized)) return true;
  const extra = import.meta.env["VITE_ADMIN_EMAILS"] as string | undefined;
  if (extra) {
    const list = extra.split(",").map((e) => e.trim().toLowerCase());
    if (list.includes(normalized)) return true;
  }
  return false;
}

async function isUserAdmin(client: NonNullable<typeof supabase>, user: User) {
  if (isKnownAdminEmail(user.email)) return true;

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
    if (error) return false;
    const admin = Boolean(data);
    roleCache.set(user.id, admin);
    return admin;
  })().finally(() => inflight.delete(user.id));

  inflight.set(user.id, request);
  return request;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const client = supabase;
    let active = true;
    let resolvedFor: string | null = null;

    const loadRole = async (user: User | undefined) => {
      if (!user) {
        resolvedFor = null;
        if (active) setIsAdmin(false);
        return;
      }
      if (user.id === resolvedFor) return;
      resolvedFor = user.id;
      const admin = await isUserAdmin(client, user);
      if (active && resolvedFor === user.id) setIsAdmin(admin);
    };

    void client.auth.getSession().then(async ({ data }) => {
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

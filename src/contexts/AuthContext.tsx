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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(Boolean(supabase));

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;

    let active = true;

    const loadRole = async (userId: string | undefined) => {
      if (!userId) {
        if (active) setIsAdmin(false);
        return;
      }
      const { data } = await client
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (active) setIsAdmin(Boolean(data));
    };

    client.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      await loadRole(data.session?.user.id);
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
      void loadRole(next?.user.id);
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

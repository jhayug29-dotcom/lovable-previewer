import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/** Anonymous visit counter that powers the admin analytics tab. */
function sessionId(): string {
  const key = "editly_sid";
  let id = window.localStorage.getItem(key);
  if (!id) {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(key, id);
  }
  return id;
}

export function PageViewTracker() {
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!supabase || typeof window === "undefined") return;
    if (path.startsWith("/admin")) return;
    const client = supabase;
    const timer = window.setTimeout(() => {
      void client.auth.getSession().then(({ data }) =>
        client
          .from("page_views")
          .insert({ path, session_id: sessionId(), user_id: data.session?.user.id ?? null })
          .then(
            () => undefined,
            () => undefined,
          ),
      );
    }, 600);
    return () => window.clearTimeout(timer);
  }, [path]);

  return null;
}

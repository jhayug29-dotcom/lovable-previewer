import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

function sessionId(): string {
  const key = "editly_sid";
  let id = window.localStorage.getItem(key);
  if (!id) {
    id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(key, id);
  }
  return id;
}

/** Anonymous visit counter that preserves the first active collaborator referral. */
export function PageViewTracker() {
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!supabase || typeof window === "undefined") return;
    if (path.startsWith("/admin")) return;

    const client = supabase;
    const params = new URLSearchParams(window.location.search);
    const incomingRef = params.get("ref");
    if (incomingRef && /^[a-zA-Z0-9_-]{8,80}$/.test(incomingRef)) {
      window.localStorage.setItem("editly_ref", incomingRef);
    }
    const collaboratorCode = window.localStorage.getItem("editly_ref");
    const sid = sessionId();

    const timer = window.setTimeout(() => {
      void client.auth.getSession().then(async ({ data }) => {
        const baseRow = {
          path,
          session_id: sid,
          user_id: data.session?.user.id ?? null,
        };

        // The collaborator columns are installed by the collaborator migration. Keep the
        // tracker compatible with older production databases so analytics never produces
        // a noisy 400 when that migration has not been applied yet.
        if (collaboratorCode) {
          const { data: link } = await client.rpc("resolve_collaborator_link", {
            link_code: collaboratorCode,
          });
          const collaboratorLinkId = (link as string | null) ?? null;
          const { error } = await client.from("page_views").insert({
            ...baseRow,
            collaborator_code: collaboratorCode,
            collaborator_link_id: collaboratorLinkId,
          });
          if (!error) return;
        }

        // Legacy schema fallback: only use the fields that existed before collaborator
        // attribution was added. Errors are intentionally swallowed because page tracking
        // must never interrupt storefront navigation.
        const { error } = await client.from("page_views").insert(baseRow);
        if (error) return;
      }).catch(() => undefined);
    }, 600);

    return () => window.clearTimeout(timer);
  }, [path]);

  return null;
}

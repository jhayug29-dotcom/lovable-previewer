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
        let collaboratorLinkId: string | null = null;
        if (collaboratorCode) {
          const { data: link } = await client.rpc("resolve_collaborator_link", {
            link_code: collaboratorCode,
          });
          collaboratorLinkId = (link as string | null) ?? null;
        }

        await client.from("page_views").insert({
          path,
          session_id: sid,
          collaborator_code: collaboratorCode,
          collaborator_link_id: collaboratorLinkId,
          user_id: data.session?.user.id ?? null,
        });
      }).catch(() => undefined);
    }, 600);

    return () => window.clearTimeout(timer);
  }, [path]);

  return null;
}

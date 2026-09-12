import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

function getSessionId(): string {
  const key = "editly_sid";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const value = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(key, value);
  return value;
}

function getProductSlug(path: string): string | null {
  if (!path.startsWith("/product/")) return null;
  const raw = path.slice("/product/".length).split("/")[0];
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Product-aware anonymous page-view tracking with collaborator attribution. */
export function PageViewTrackerV2() {
  const path = useRouterState({ select: (state) => state.location.pathname });

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
    const sid = getSessionId();
    const productSlug = getProductSlug(path);

    const timer = window.setTimeout(() => {
      void client.auth.getSession().then(async ({ data }) => {
        let productId: string | null = null;
        if (productSlug) {
          const { data: product } = await client.from("products").select("id").eq("slug", productSlug).maybeSingle();
          productId = (product?.id as string | undefined) ?? null;
        }

        const userId = data.session?.user.id ?? null;
        if (collaboratorCode) {
          try {
            const { data: collaboratorLink } = await client.rpc("resolve_collaborator_link", { link_code: collaboratorCode });
            const { error } = await client.from("page_views").insert({
              path,
              session_id: sid,
              user_id: userId,
              product_id: productId,
              collaborator_code: collaboratorCode,
              collaborator_link_id: (collaboratorLink as string | null) ?? null,
            });
            if (!error) return;
          } catch {
            // Fall through to a legacy-compatible view row.
          }
        }

        try {
          await client.from("page_views").insert({ path, session_id: sid, user_id: userId });
        } catch {}
      }).catch(() => undefined);
    }, 600);

    return () => window.clearTimeout(timer);
  }, [path]);

  return null;
}

import { useEffect, useRef } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { recordPageView } from "@/lib/analytics.functions";
import { getReferralCode, getVisitorSessionId, saveReferralCode } from "@/lib/referral";

/** Product-aware anonymous and authenticated page-view tracking with collaborator attribution. */
export function PageViewTrackerV2() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const search = useRouterState({ select: (state) => state.location.search });
  const logView = useServerFn(recordPageView);
  const lastRecordedRef = useRef<string>("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (path.startsWith("/admin")) return;

    // 1. Detect and persist any incoming ref from query params or storage/cookie
    let incomingRef: string | null = null;
    if (typeof search === "object" && search !== null) {
      const s = search as Record<string, unknown>;
      incomingRef =
        (s.ref as string) ||
        (s.c as string) ||
        (s.code as string) ||
        (s.collab as string) ||
        (s.collaborator as string) ||
        null;
    }
    if (!incomingRef) {
      const searchString = window.location.search || (typeof search === "string" ? search : "");
      const params = new URLSearchParams(
        searchString.startsWith("?") ? searchString : `?${searchString}`,
      );
      incomingRef =
        params.get("ref") ||
        params.get("c") ||
        params.get("code") ||
        params.get("collab") ||
        params.get("collaborator");
    }

    if (incomingRef) {
      saveReferralCode(incomingRef);
    }
    const collaboratorCode = getReferralCode();
    const sessionId = getVisitorSessionId();

    const currentKey = `${path}|${collaboratorCode || ""}`;
    // Debounce fast transitions
    const timer = window.setTimeout(async () => {
      let userId: string | null = null;
      if (supabase) {
        try {
          const { data } = await supabase.auth.getSession();
          userId = data.session?.user.id ?? null;
        } catch {
          // Ignore session fetch error
        }
      }

      // Avoid duplicate consecutive recordings for the same route and user
      const fullRecordKey = `${currentKey}|${userId || ""}`;
      if (lastRecordedRef.current === fullRecordKey) return;
      lastRecordedRef.current = fullRecordKey;

      try {
        await logView({
          data: {
            path,
            sessionId,
            userId,
            collaboratorCode: collaboratorCode || null,
          },
        });
      } catch (err) {
        console.warn("Could not record visitor view via server function:", err);
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [path, search, logView]);

  return null;
}

import { useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Signing you in — Editly Store" },
      { name: "description", content: "Completing your Editly Store sign-in." },
      { property: "og:title", content: "Signing you in — Editly Store" },
      { property: "og:description", content: "Completing your Editly Store sign-in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!supabase) {
      void navigate({ to: "/" });
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      void navigate({ to: data.session ? "/store" : "/auth" });
    });
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="size-6 animate-spin text-ink/60" />
    </div>
  );
}

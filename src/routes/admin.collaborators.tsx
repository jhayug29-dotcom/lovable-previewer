import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { SiteLayout } from "@/components/site/SiteLayout";
import { CollaboratorsTab } from "@/components/admin/CollaboratorsTab";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import { checkPanelAccess } from "@/lib/analytics.functions";

export const Route = createFileRoute("/admin/collaborators")({
  ssr: false,
  beforeLoad: async () => {
    if (!isSupabaseConfigured || !supabase) throw notFound();
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) throw redirect({ to: "/auth", search: { redirect: "/admin/collaborators" } });
    try {
      const access = await checkPanelAccess({ data: { accessToken } });
      if (!access.admin) throw notFound();
    } catch {
      throw notFound();
    }
  },
  head: () => ({
    meta: [
      { title: "Collaborators — Editly Store" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CollaboratorsPage,
});

function CollaboratorsPage() {
  return (
    <SiteLayout dark>
      <section className="mx-auto max-w-[1600px] px-6 pb-24 lg:px-12">
        <div className="mb-7">
          <h1 className="font-display text-[clamp(2rem,3.5vw,3rem)] font-extrabold text-ink">Control panel</h1>
          <p className="mt-2 text-sm text-muted-foreground">Collaborator partners, referral links and product-level performance.</p>
        </div>
        <CollaboratorsTab />
      </section>
    </SiteLayout>
  );
}

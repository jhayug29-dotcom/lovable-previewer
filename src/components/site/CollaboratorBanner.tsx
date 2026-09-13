import { useQuery } from "@tanstack/react-query";
import { getReferralCode } from "@/lib/referral";
import { resolveCollaboratorDetails } from "@/lib/analytics.functions";
import { HeartHandshake, Sparkles } from "lucide-react";

export function CollaboratorBanner() {
  const code = getReferralCode();

  const { data: collaborator, isLoading } = useQuery({
    queryKey: ["collaborator-details", code],
    queryFn: () => resolveCollaboratorDetails({ data: { code: code! } }),
    enabled: Boolean(code),
    staleTime: 60 * 1000 * 5, // 5 minutes
  });

  if (!code || isLoading || !collaborator) {
    return null;
  }

  return (
    <div className="relative z-50 flex items-center justify-center gap-2 overflow-hidden bg-gradient-to-r from-emerald-950 via-teal-900 to-emerald-950 px-4 py-2.5 text-center text-sm font-medium text-emerald-50 shadow-[0_4px_24px_-8px_rgba(16,185,129,0.5)]">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
      <HeartHandshake className="size-4 text-emerald-400" />
      <span className="relative z-10 flex items-center gap-1.5">
        You are shopping with <strong className="font-bold text-white">{collaborator.name}</strong>
        <Sparkles className="size-3.5 text-emerald-400 animate-pulse" />
      </span>
    </div>
  );
}

import { useAuth } from "@/contexts/AuthContext";
import { useIndependenceMode } from "@/hooks/useIndependenceMode";

export function StoreGreeting() {
  const { user } = useAuth();
  const { isIndependenceMode } = useIndependenceMode();

  if (!user || !isIndependenceMode) return null;

  return (
    <div className="animate-rise-in mx-auto mt-6 max-w-[1600px] px-6 lg:px-12">
      <div className="glass morph-card relative overflow-hidden rounded-4xl p-8 sm:p-10 text-center shadow-lift">
        <div className="absolute inset-0 bg-gradient-to-r from-[#FF9933]/10 via-[#FFFFFF]/10 to-[#138808]/10" />
        <div className="relative">
          <span className="mb-4 inline-block text-5xl animate-bounce">🇮🇳</span>
          <h2 className="font-display text-3xl font-extrabold text-ink sm:text-4xl">
            Welcome back, {user.user_metadata?.name || "Explorer"}!
          </h2>
          <p className="mt-3 text-lg font-medium text-ink/80">
            Happy 80th Independence Day! Celebrate freedom with our exclusive assets to elevate your
            storytelling.
          </p>
        </div>
      </div>
    </div>
  );
}

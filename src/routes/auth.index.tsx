import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Mail,
  Lock,
  User as UserIcon,
  Loader2,
  ArrowLeft,
  Store,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/site/SiteLayout";
import { signIn, signInWithGoogle, signUp, resetPassword } from "@/lib/auth";
import { isSupabaseConfigured } from "@/integrations/supabase/client";
import { useAuth, isMasterAdminEmail } from "@/contexts/AuthContext";

export const Route = createFileRoute("/auth/")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => {
    const next = search["redirect"];
    // Only same-origin paths are honoured.
    return typeof next === "string" && next.startsWith("/") ? { redirect: next } : {};
  },
  head: () => ({
    meta: [
      { title: "Sign in — Editly Store" },
      {
        name: "description",
        content: "Sign in to Editly Store to access your purchases, download links and receipts.",
      },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Sign in — Editly Store" },
      {
        property: "og:description",
        content: "Access your Editly Store purchases and download links.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup";

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const { user, isAdmin, signOut: endSession } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        await signIn(email, password);
        toast.success("Welcome back");
        void navigate({ to: redirect ?? "/store" });
      } else {
        await signUp(email, password, fullName);
        toast.success("Account created — check your inbox to confirm");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  if (user) {
    return (
      <SiteLayout dark>
        <section className="mx-auto flex max-w-[520px] flex-col px-5 pb-24 sm:px-6">
          <div className="glass animate-rise-in rounded-4xl p-7 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Your account
            </p>
            <h1 className="mt-2 font-display text-3xl font-extrabold text-ink">
              {user.user_metadata?.["full_name"] ?? user.email}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You&apos;re signed in — every purchase, download link and receipt is tied to this
              email.
            </p>

            <div className="mt-7 flex flex-col gap-2.5">
              <Link
                to="/store"
                className="hover-pop flex items-center gap-3 rounded-3xl bg-white/10 px-5 py-4 font-display text-sm font-semibold text-ink"
              >
                <Store className="size-5" strokeWidth={1.7} />
                Browse the store
              </Link>
              {isAdmin || isMasterAdminEmail(user?.email) ? (
                <Link
                  to="/admin"
                  className="hover-pop flex items-center gap-3 rounded-3xl bg-white/10 px-5 py-4 font-display text-sm font-semibold text-ink"
                >
                  <ShieldCheck className="size-5" strokeWidth={1.7} />
                  Open admin panel
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  void endSession().then(() => navigate({ to: "/" }));
                }}
                className="hover-pop flex items-center gap-3 rounded-3xl bg-white/45 px-5 py-4 font-display text-sm font-semibold text-ink"
              >
                <LogOut className="size-5" strokeWidth={1.7} />
                Sign out
              </button>
            </div>
          </div>
        </section>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout dark>
      <section className="mx-auto flex max-w-[520px] flex-col px-5 pb-24 sm:px-6">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-ink/70 transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-4" strokeWidth={1.9} />
          Back home
        </Link>

        <div className="glass animate-rise-in rounded-4xl p-7 sm:p-8">
          <h1 className="font-display text-3xl font-extrabold text-ink">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Sign in to reach your downloads and receipts."
              : "One account for every purchase, download and update."}
          </p>

          {!isSupabaseConfigured ? (
            <p className="mt-5 rounded-2xl bg-white/55 px-4 py-3 text-sm font-medium text-ink/80">
              Sign-in activates as soon as the backend is connected.
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => {
              signInWithGoogle().catch((err: unknown) =>
                toast.error(err instanceof Error ? err.message : "Google sign-in failed"),
              );
            }}
            className="hover-pop mt-6 flex w-full items-center justify-center gap-3 rounded-full bg-white px-6 py-4 font-display text-sm font-semibold text-black"
          >
            <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23 12.2c0-.8-.1-1.6-.2-2.3H12v4.4h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.5Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1a7 7 0 0 1-6.6-4.8H1.6v3A12 12 0 0 0 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.4 14.6a7.2 7.2 0 0 1 0-4.6v-3H1.6a12 12 0 0 0 0 10.6l3.8-3Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.8c1.8 0 3.3.6 4.5 1.8l3.3-3.3A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.6 6l3.8 3A7 7 0 0 1 12 4.8Z"
              />
            </svg>
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-4 text-xs uppercase tracking-widest text-muted-foreground">
            <span className="h-px flex-1 bg-ink/10" />
            or
            <span className="h-px flex-1 bg-ink/10" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" ? (
              <Field
                icon={UserIcon}
                placeholder="Full name"
                value={fullName}
                onChange={setFullName}
              />
            ) : null}
            <Field
              icon={Mail}
              type="email"
              placeholder="Email"
              value={email}
              onChange={setEmail}
              required
            />
            <Field
              icon={Lock}
              type="password"
              placeholder="Password"
              value={password}
              onChange={setPassword}
              required
            />

            <button
              type="submit"
              disabled={busy}
              className="btn-shine flex w-full items-center justify-center gap-2 rounded-full bg-primary px-8 py-4 font-display text-base font-semibold text-primary-foreground shadow-float transition-all duration-500 hover:-translate-y-0.5 disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-5 animate-spin" /> : null}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-between text-sm">
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="font-semibold text-ink/80 transition-colors hover:text-ink"
            >
              {mode === "signin" ? "Create an account" : "I already have an account"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!email) {
                  toast.error("Enter your email first");
                  return;
                }
                resetPassword(email)
                  .then(() => toast.success("Reset link sent"))
                  .catch((err: unknown) =>
                    toast.error(err instanceof Error ? err.message : "Could not send reset link"),
                  );
              }}
              className="text-muted-foreground transition-colors hover:text-ink"
            >
              Forgot password?
            </button>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}

function Field({
  icon: Icon,
  value,
  onChange,
  ...rest
}: {
  icon: React.ElementType;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="flex items-center gap-3 rounded-2xl bg-white/60 px-5 py-4 transition-colors focus-within:bg-white/15">
      <Icon className="size-4 text-muted-foreground" strokeWidth={1.8} />
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-sm font-medium text-ink outline-none placeholder:text-muted-foreground"
      />
    </label>
  );
}

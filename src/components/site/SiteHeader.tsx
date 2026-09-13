import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Store, LifeBuoy, Rocket, ShieldCheck, LogOut, Menu, X, Link2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { signOut } from "@/lib/auth";
import { useIndependenceMode } from "@/hooks/useIndependenceMode";
import { AccountMenu } from "@/components/site/AccountMenu";
import { checkPanelAccess } from "@/lib/analytics.functions";

const navItems = [
  { label: "Store", to: "/store", icon: Store },
  { label: "Read more", to: "/read-more", icon: Rocket },
  { label: "Support", to: "/read-more", icon: LifeBuoy },
] as const;

export function SiteHeader() {
  const { user, session, isAdmin } = useAuth();
  const { isIndependenceMode } = useIndependenceMode();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: panelAccess } = useQuery({
    queryKey: ["header-panel-access", session?.access_token ?? ""],
    queryFn: () => checkPanelAccess({ data: { accessToken: session?.access_token } }),
    enabled: Boolean(session?.access_token),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => setOpen(false), [pathname]);

  const canSeeCollaborators = Boolean(panelAccess?.admin || panelAccess?.collaborator);

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5 lg:px-12">
        <Link to="/" className="group flex items-center gap-2.5 sm:gap-3">
          <span className="glass flex size-10 items-center justify-center rounded-2xl transition-transform duration-500 group-hover:scale-105">
            <img
              src="/editly-icon-iris.svg"
              alt="Editly Store logo"
              className="site-logo-mark size-7 object-contain"
              width={28}
              height={28}
            />
          </span>
          <div className="flex flex-col">
            <span className="font-display text-[1.15rem] font-extrabold tracking-tight text-ink sm:text-[1.35rem]">
              Editly Store
            </span>
            {isIndependenceMode && (
              <span
                className="animate-rise-in font-display text-xs sm:text-sm font-extrabold drop-shadow-md"
                style={{
                  background: "linear-gradient(90deg, #FF9933 0%, #FFFFFF 50%, #138808 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                Happy 80th Independence Day
              </span>
            )}
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="rounded-full px-4 py-2.5 text-[0.95rem] font-medium text-ink/80 transition-all duration-500 hover:bg-white/45 hover:text-ink hover:backdrop-blur-xl lg:px-5"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-2.5">
          {isAdmin ? (
            <Link
              to="/admin"
              className="glass flex size-11 items-center justify-center rounded-full text-ink transition-transform duration-500 hover:scale-105 active:scale-95"
              aria-label="Admin panel"
            >
              <ShieldCheck className="size-5" strokeWidth={1.6} />
            </Link>
          ) : null}
          {canSeeCollaborators ? (
            panelAccess?.admin ? (
              <Link
                to="/admin"
                search={{ tab: "collaborators" }}
                className="glass flex size-11 items-center justify-center rounded-full text-ink transition-transform duration-500 hover:scale-105 active:scale-95"
                aria-label="Collaborator analytics"
              >
                <Link2 className="size-5" strokeWidth={1.7} />
              </Link>
            ) : (
              <Link
                to="/admin/collaborators"
                className="glass flex size-11 items-center justify-center rounded-full text-ink transition-transform duration-500 hover:scale-105 active:scale-95"
                aria-label="Collaborator analytics"
              >
                <Link2 className="size-5" strokeWidth={1.7} />
              </Link>
            )
          ) : null}
          <AccountMenu />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="glass flex size-11 items-center justify-center rounded-full text-ink transition-transform duration-500 active:scale-95 md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? (
              <X className="size-5" strokeWidth={1.8} />
            ) : (
              <Menu className="size-5" strokeWidth={1.8} />
            )}
          </button>
        </div>
      </div>

      <div
        className={`overflow-hidden px-4 transition-all duration-500 ease-[var(--ease-macos)] md:hidden ${open ? "max-h-96 opacity-100" : "pointer-events-none max-h-0 opacity-0"}`}
      >
        <nav className="glass flex flex-col gap-1 rounded-4xl p-3">
          {navItems.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="flex items-center gap-3 rounded-3xl px-4 py-3 text-[1rem] font-semibold text-ink/85 transition-colors hover:bg-white/50 hover:text-ink"
            >
              <item.icon className="size-5" strokeWidth={1.6} />
              {item.label}
            </Link>
          ))}
          {canSeeCollaborators ? (
            panelAccess?.admin ? (
              <Link
                to="/admin"
                search={{ tab: "collaborators" }}
                className="flex items-center gap-3 rounded-3xl px-4 py-3 text-[1rem] font-semibold text-ink/85 transition-colors hover:bg-white/50"
              >
                <Link2 className="size-5" strokeWidth={1.6} />
                Collaborator analytics
              </Link>
            ) : (
              <Link
                to="/admin/collaborators"
                className="flex items-center gap-3 rounded-3xl px-4 py-3 text-[1rem] font-semibold text-ink/85 transition-colors hover:bg-white/50"
              >
                <Link2 className="size-5" strokeWidth={1.6} />
                Collaborator analytics
              </Link>
            )
          ) : null}
          {user ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex items-center gap-3 rounded-3xl px-4 py-3 text-left text-[1rem] font-semibold text-ink/85 transition-colors hover:bg-white/50"
            >
              <LogOut className="size-5" strokeWidth={1.6} />
              Sign out
            </button>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

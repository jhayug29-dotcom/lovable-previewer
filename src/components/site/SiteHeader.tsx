import { useEffect, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Store,
  LifeBuoy,
  Rocket,
  ShieldCheck,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { signOut } from "@/lib/auth";
import logoMark from "@/assets/logo.png";
import { useIndependenceMode } from "@/hooks/useIndependenceMode";
import { AccountMenu } from "@/components/site/AccountMenu";

const navItems = [
  { label: "Store", to: "/store", icon: Store },
  { label: "Read more", to: "/read-more", icon: Rocket },
  { label: "Support", to: "/read-more", icon: LifeBuoy },
] as const;

export function SiteHeader() {
  const { user, isAdmin } = useAuth();
  const { isIndependenceMode } = useIndependenceMode();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Close the drawer whenever navigation happens.
  useEffect(() => setOpen(false), [pathname]);

  return (
    <header className="sticky top-0 z-50 w-full">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5 lg:px-12">
        <Link to="/" className="group flex items-center gap-2.5 sm:gap-3">
          <span className="glass flex size-10 items-center justify-center rounded-2xl transition-transform duration-500 group-hover:scale-105">
            <img
              src={logoMark}
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
          {/* Signed out: a link to /auth. Signed in: a disclosure that reveals the
              profile and every pack the user owns, with its download link. The
              old standalone sign-out button now lives inside that panel. */}
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

      {/* Mobile / tablet drawer */}
      <div
        className={`overflow-hidden px-4 transition-all duration-500 ease-[var(--ease-macos)] md:hidden ${
          open ? "max-h-96 opacity-100" : "pointer-events-none max-h-0 opacity-0"
        }`}
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

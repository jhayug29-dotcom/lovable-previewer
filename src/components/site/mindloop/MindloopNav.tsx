import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Instagram, Youtube, Twitter, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Dock, DockIcon } from "./Dock";

/** Concentric-circles brand mark — pure monochrome, scales via props. */
function LoopMark({ outer = "w-7 h-7", inner = "w-3 h-3" }: { outer?: string; inner?: string }) {
  return (
    <span className={`relative flex items-center justify-center rounded-full border-2 border-foreground/60 ${outer}`}>
      <span className={`rounded-full border border-foreground/60 ${inner}`} />
    </span>
  );
}

const NAV_LINKS = [
  { label: "Home", href: "#top", kind: "anchor" as const },
  { label: "How It Works", href: "#how-it-works", kind: "anchor" as const },
  { label: "Collections", href: "#collections", kind: "anchor" as const },
  { label: "Reviews", href: "#reviews", kind: "anchor" as const },
];

const SOCIALS = [
  { icon: Instagram, href: "https://instagram.com", label: "Instagram" },
  { icon: Youtube, href: "https://youtube.com", label: "YouTube" },
  { icon: Twitter, href: "https://twitter.com", label: "X" },
];

export function MindloopNav() {
  const [open, setOpen] = useState(false);

  // Lock body scroll while the mobile sheet is open.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="flex items-center justify-between px-5 py-4 sm:px-8 md:px-16 lg:px-28">
        {/* Logo */}
        <a href="#top" className="flex items-center gap-2.5" aria-label="Editly Store — home">
          <LoopMark />
          <span className="text-lg font-bold tracking-tight text-foreground">Editly Store</span>
        </a>

        {/* Center nav — macOS-dock magnification on the section links (desktop) */}
        <Dock
          direction="middle"
          magnification={1.32}
          distance={110}
          className="hidden gap-1 rounded-full border border-border/40 bg-card/40 px-2 py-1 backdrop-blur-xl lg:flex"
        >
          {NAV_LINKS.map((link) => (
            <DockIcon key={link.label}>
              <a
                href={link.href}
                className="block rounded-full px-3.5 py-1.5 text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
              >
                {link.label}
              </a>
            </DockIcon>
          ))}
        </Dock>

        {/* Right: real store link + socials (desktop) */}
        <div className="hidden items-center gap-3 lg:flex">
          <Link
            to="/store"
            className="text-sm font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"
          >
            Browse store
          </Link>
          <div className="flex items-center gap-2">
            {SOCIALS.map((s) => (
              <motion.a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={s.label}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                className="liquid-glass flex h-10 w-10 items-center justify-center rounded-full text-foreground/90 transition-colors duration-200 hover:text-foreground"
              >
                <s.icon className="h-4 w-4" strokeWidth={1.7} />
              </motion.a>
            ))}
          </div>
        </div>

        {/* Mobile toggle */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          className="liquid-glass flex h-10 w-10 items-center justify-center rounded-full text-foreground lg:hidden"
        >
          {open ? <X className="h-5 w-5" strokeWidth={1.8} /> : <Menu className="h-5 w-5" strokeWidth={1.8} />}
        </button>
      </div>

      {/* Mobile sheet */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="mx-4 overflow-hidden rounded-2xl border border-border/60 bg-card/95 p-2 backdrop-blur-xl lg:hidden"
          >
            <nav className="flex flex-col" aria-label="Mobile">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-4 py-3 text-base text-secondary-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
              <Link
                to="/store"
                onClick={() => setOpen(false)}
                className="rounded-xl px-4 py-3 text-base font-medium text-foreground transition-colors duration-200 hover:bg-secondary"
              >
                Browse store →
              </Link>
            </nav>
            <div className="mt-1 flex items-center gap-2 px-2 pb-1 pt-2">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={s.label}
                  className="liquid-glass flex h-10 w-10 items-center justify-center rounded-full text-foreground/90"
                >
                  <s.icon className="h-4 w-4" strokeWidth={1.7} />
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export { LoopMark };

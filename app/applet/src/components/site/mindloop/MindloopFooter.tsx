import { Link } from "@tanstack/react-router";

const LINKS = [
  { label: "Privacy", to: "/read-more" as const, hash: "privacy" },
  { label: "Terms", to: "/read-more" as const, hash: "licence" },
  { label: "Contact", to: "/read-more" as const, hash: "support" },
];

export function MindloopFooter() {
  return (
    <footer className="border-t border-border/40 px-5 py-12 sm:px-8 md:px-16 lg:px-28">
      <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Editly Store. All rights reserved.
        </p>
        <nav className="flex items-center gap-6" aria-label="Footer">
          {LINKS.map((link) => (
            <Link
              key={link.label}
              to={link.to}
              hash={link.hash}
              className="text-sm text-muted-foreground transition-colors duration-200 hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}

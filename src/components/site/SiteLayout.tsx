import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Mail, Phone, Instagram, Youtube, Twitter } from "lucide-react";
import heroBg from "@/assets/hero-bg-4k.jpg";
import heroBgSmall from "@/assets/hero-bg-1080.jpg";
import { DEFAULT_SETTINGS, fetchSettings } from "@/lib/settings";
import { SiteHeader } from "./SiteHeader";
import { RainingFlags } from "./RainingFlags";

export function SiteLayout({ children, background }: { children: ReactNode; background?: ReactNode }) {
  const { data: settings = DEFAULT_SETTINGS } = useQuery({
    queryKey: ["site-settings"],
    queryFn: fetchSettings,
    staleTime: 5 * 60 * 1000,
  });

  const socials = [
    { icon: Instagram, href: settings.instagram, label: "Instagram" },
    { icon: Youtube, href: settings.youtube, label: "YouTube" },
    { icon: Twitter, href: settings.twitter, label: "X" },
  ].filter((s) => s.href);

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Single fixed background shared by the whole page — never scrolls away */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
        {background ?? (
          <img
            src={heroBg}
            srcSet={`${heroBgSmall} 1920w, ${heroBg} 3840w`}
            sizes="100vw"
            alt=""
            fetchPriority="high"
            decoding="async"
            className="size-full object-cover object-center"
          />
        )}
      </div>

      <SiteHeader />
      <RainingFlags />
      <main>{children}</main>

      <footer className="mx-auto mt-24 max-w-[1600px] px-6 pb-12 lg:px-12">
        <div className="glass flex flex-col gap-8 rounded-4xl px-8 py-9 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-sm">
            <p className="font-display text-lg font-extrabold text-ink">Editly Store</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Premium assets for editors, motion designers and storytellers.
            </p>
            {socials.length > 0 && (
              <div className="mt-5 flex items-center gap-3">
                {socials.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noreferrer noopener"
                    aria-label={social.label}
                    className="press-pop flex size-10 items-center justify-center rounded-2xl bg-white/60 text-violet-deep"
                  >
                    <social.icon className="size-4.5" strokeWidth={1.7} />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div className="grid gap-8 sm:grid-cols-2">
            <div className="text-sm font-medium text-ink/75">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-violet-deep">
                Explore
              </p>
              <div className="flex flex-col gap-2">
                <Link to="/store" className="transition-colors hover:text-ink">
                  Store
                </Link>
                <Link to="/read-more" className="transition-colors hover:text-ink">
                  Read more
                </Link>
                <Link to="/read-more" hash="licence" className="transition-colors hover:text-ink">
                  Licence
                </Link>
                <Link to="/read-more" hash="refunds" className="transition-colors hover:text-ink">
                  Refunds
                </Link>
              </div>
            </div>

            <div className="text-sm font-medium text-ink/75">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-violet-deep">
                Support
              </p>
              <div className="flex flex-col gap-2">
                <a
                  href={`mailto:${settings.support_email}`}
                  className="flex items-center gap-2 transition-colors hover:text-ink"
                >
                  <Mail className="size-4" strokeWidth={1.7} />
                  {settings.support_email}
                </a>
                {settings.phone && (
                  <a
                    href={`tel:${settings.phone.replace(/\s+/g, "")}`}
                    className="flex items-center gap-2 transition-colors hover:text-ink"
                  >
                    <Phone className="size-4" strokeWidth={1.7} />
                    {settings.phone}
                  </a>
                )}
                {settings.support_hours && (
                  <p className="text-muted-foreground">{settings.support_hours}</p>
                )}
                {settings.address && <p className="text-muted-foreground">{settings.address}</p>}
              </div>
            </div>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Editly Store. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

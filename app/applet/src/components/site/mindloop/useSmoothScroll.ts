import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Inertial smooth scrolling for the landing page only, wired to GSAP.
 *
 * Lenis is created on mount and destroyed on unmount, so native scrolling is
 * restored the moment you navigate away to the (light) store — nothing here
 * leaks into the rest of the app. In-page anchor links (#collections, …) are
 * routed through Lenis so they glide to a slow, eased stop instead of jumping.
 *
 * GSAP integration: `ScrollTrigger.update` runs on every Lenis scroll, so any
 * scroll-scrubbed animation tracks the eased position exactly.
 *
 * Lenis deliberately runs on its OWN requestAnimationFrame loop rather than
 * gsap.ticker. Sharing the ticker means one throwing callback anywhere in the
 * page can take the loop down and leave the page unscrollable; here the frame
 * is re-queued before any work happens and errors are swallowed, so scrolling
 * cannot be broken by unrelated animation code.
 */
export function useSmoothScroll() {
  useEffect(() => {
    // SSR / reduced-motion guard: skip smoothing for users who ask for less motion.
    if (typeof window === "undefined") return;
    const prefersReduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    let lenis: import("lenis").default | null = null;
    let cancelled = false;
    let onClick: ((e: MouseEvent) => void) | null = null;
    let frame = 0;
    let onLenisScroll: (() => void) | null = null;

    (async () => {
      const { default: Lenis } = await import("lenis");
      if (cancelled) return;

      lenis = new Lenis({
        // Long-ish duration + exponential ease-out = gentle glide, slow soft stop.
        duration: 1.15,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        wheelMultiplier: 0.9,
        touchMultiplier: 1.2,
      });

      // Keep ScrollTrigger in lockstep with Lenis so scroll-scrubbed animations
      // follow the eased scroll position frame-for-frame.
      onLenisScroll = () => {
        try {
          ScrollTrigger.update();
        } catch {
          /* an animation error must not stall scrolling */
        }
      };
      lenis.on("scroll", onLenisScroll);

      // Private, self-healing rAF loop (see the note above). GSAP's ticker gets
      // lag smoothing disabled so its own animations stay in step with this one.
      gsap.ticker.lagSmoothing(0);
      const raf = (time: number) => {
        frame = requestAnimationFrame(raf); // re-queue first — never stalls
        try {
          lenis?.raf(time);
        } catch {
          /* keep the loop alive no matter what */
        }
      };
      frame = requestAnimationFrame(raf);

      // Smoothly ease in-page anchors instead of the instant native jump.
      onClick = (e: MouseEvent) => {
        const anchor = (e.target as HTMLElement | null)?.closest?.('a[href^="#"]');
        if (!anchor) return;
        const href = anchor.getAttribute("href");
        if (!href || href === "#") return;
        const target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        lenis?.scrollTo(target as HTMLElement, { offset: -8 });
      };
      document.addEventListener("click", onClick);

      // Recompute trigger start/end positions now that Lenis owns the scroll.
      ScrollTrigger.refresh();
    })();

    return () => {
      cancelled = true;
      if (onClick) document.removeEventListener("click", onClick);
      if (frame) cancelAnimationFrame(frame);
      if (lenis && onLenisScroll) lenis.off("scroll", onLenisScroll);
      lenis?.destroy();
    };
  }, []);
}

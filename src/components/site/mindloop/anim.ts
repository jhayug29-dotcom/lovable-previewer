/**
 * Shared motion helpers for the Mindloop landing page.
 * `motion` is framer-motion (renamed); `useScroll`/`useTransform` live here too.
 */
import type { Variants } from "motion/react";

/** Staggered fade-up used by every section on the landing page. */
export const fadeUp = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" } as const,
  transition: { duration: 0.6, delay, ease: "easeOut" as const },
});

/**
 * Hero entrance — one element (or heading line) at a time.
 *
 * Deliberately slower and heavier than `fadeUp`: the expo-out curve spends most
 * of its time decelerating, so each line glides to a stop instead of snapping.
 * It plays on mount rather than on scroll (the hero is already in view), and it
 * only touches opacity / transform / filter — all compositor properties — with
 * `will-change` declared up front so the browser promotes the layer before the
 * first frame. That combination is what keeps it smooth over the hero video.
 */
export const heroReveal = (delay: number) => ({
  initial: { opacity: 0, y: 32, filter: "blur(10px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { duration: 1.1, delay, ease: [0.16, 1, 0.3, 1] as const },
  style: { willChange: "transform, opacity, filter" },
});

/** Container/child variants for lists that reveal one item at a time. */
export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
};

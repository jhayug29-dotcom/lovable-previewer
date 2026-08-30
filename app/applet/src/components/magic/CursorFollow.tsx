import { useEffect, useRef, type ReactNode } from "react";
import { motion, useSpring, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * CursorFollow — the wrapped element drifts toward the pointer while hovered.
 *
 * The motion is deliberately slow and heavily damped (see `DRIFT`): the element
 * lags well behind the cursor and glides to a stop instead of snapping, which is
 * what makes a decorative object feel suspended rather than dragged. On leave
 * both springs settle back to 0, so it always returns to its layout position.
 *
 * Only transforms are animated, so this never triggers layout — the element's box
 * stays exactly where the grid put it and nothing around it reflows.
 */
export interface CursorFollowProps {
  children: ReactNode;
  /**
   * Fraction of the cursor's offset from centre that the element travels.
   * 0.12 ≈ a 40px drift across a 700px-wide element. @default 0.12
   */
  strength?: number;
  /** Peak lean in degrees at the far edges. Set 0 for pure translation. @default 6 */
  tilt?: number;
  /** Perspective depth for the lean, in px. @default 900 */
  perspective?: number;
  className?: string;
}

// Very low stiffness + heavy mass = a long, soft trail behind the cursor.
const DRIFT = { stiffness: 26, damping: 20, mass: 1.4 } as const;

export function CursorFollow({
  children,
  strength = 0.12,
  tilt = 6,
  perspective = 900,
  className,
}: CursorFollowProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Element size, captured from the rect the pointer handler already measures —
  // so the per-frame transforms below cost no extra layout reads.
  const box = useRef({ w: 0, h: 0 });

  // Normalised pointer offset from the element's centre, in [-1, 1].
  const nx = useSpring(0, DRIFT);
  const ny = useSpring(0, DRIFT);

  const x = useTransform(nx, (v) => v * box.current.w * strength * 0.5);
  const y = useTransform(ny, (v) => v * box.current.h * strength * 0.5);
  const rotateY = useTransform(nx, (v) => v * tilt);
  const rotateX = useTransform(ny, (v) => -v * tilt);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const track = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      box.current = { w: rect.width, h: rect.height };
      nx.set(((event.clientX - rect.left) / rect.width) * 2 - 1);
      ny.set(((event.clientY - rect.top) / rect.height) * 2 - 1);
    };

    const reset = () => {
      nx.set(0);
      ny.set(0);
    };

    host.addEventListener("pointermove", track);
    host.addEventListener("pointerleave", reset);
    host.addEventListener("pointercancel", reset);

    return () => {
      host.removeEventListener("pointermove", track);
      host.removeEventListener("pointerleave", reset);
      host.removeEventListener("pointercancel", reset);
    };
  }, [nx, ny]);

  return (
    <div ref={ref} className={cn("relative", className)} style={{ perspective }}>
      <motion.div style={{ x, y, rotateX, rotateY, transformStyle: "preserve-3d" }}>
        {children}
      </motion.div>
    </div>
  );
}

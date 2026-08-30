import { useEffect, useRef, useState } from "react";
import { motion, useMotionTemplate, useSpring } from "motion/react";

/**
 * MagicGlow — the magicui MagicCard "orb" effect, as a drop-in layer.
 *
 * Two things follow the pointer: a large blurred orb that lights the card from
 * inside, and a hairline ring highlight masked to the border. Both are driven by
 * springs, so the orb *trails* the cursor instead of snapping to it — that lag is
 * what makes it read as a light source rather than a cursor decoration.
 *
 * Two deliberate constraints, both from the brief:
 *  - **it only covers the box.** The layer container is `absolute inset-0` with
 *    `overflow-hidden` and `rounded-[inherit]`, so the orb is clipped to the
 *    card's own rounded rectangle and never bleeds onto the page.
 *  - **it never covers the text.** The container sits at `z-0`; the host's
 *    content must sit above it (`relative z-10`). The glow lights the surface
 *    behind the copy, it is not painted over it.
 *
 * Pointer tracking is bound to `parentElement`, so this must be rendered as a
 * **direct child** of the host, and the host needs `relative` + a stacking
 * context. Binding to the host (rather than to `window`) means real
 * enter/leave events and no per-frame `getBoundingClientRect` on every card.
 */
export interface MagicGlowProps {
  /** Orb diameter in px. @default 560 */
  size?: number;
  /** Radius of the border-ring highlight in px. @default 420 */
  ringSize?: number;
  /** Orb core colour. @default the green in `--magic-glow-from` */
  glowFrom?: string;
  /** Orb falloff colour. @default the green in `--magic-glow-to` */
  glowTo?: string;
  /** Border-ring colour. @default the green in `--magic-glow-ring` */
  ringColor?: string;
  /** Peak orb opacity. Kept below 1 so card copy stays legible. @default 0.62 */
  intensity?: number;
  /** Gaussian blur on the orb, in px. Higher = softer edge. @default 56 */
  blur?: number;
}

// Soft and slow: low stiffness with heavy damping gives a trailing glide and no
// overshoot, which is what separates "a light following you" from "a cursor".
const FOLLOW = { stiffness: 55, damping: 18, mass: 0.9 } as const;

export function MagicGlow({
  size = 560,
  ringSize = 420,
  glowFrom = "var(--magic-glow-from)",
  glowTo = "var(--magic-glow-to)",
  ringColor = "var(--magic-glow-ring)",
  intensity = 0.62,
  blur = 56,
}: MagicGlowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  const x = useSpring(0, FOLLOW);
  const y = useSpring(0, FOLLOW);

  useEffect(() => {
    const host = ref.current?.parentElement;
    if (!host) return;

    const track = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      x.set(event.clientX - rect.left);
      y.set(event.clientY - rect.top);
    };

    const enter = (event: PointerEvent) => {
      // Seed the springs at the entry point, otherwise the orb sweeps in from
      // the top-left corner the first time the card is hovered.
      const rect = host.getBoundingClientRect();
      x.jump(event.clientX - rect.left);
      y.jump(event.clientY - rect.top);
      setHovered(true);
    };

    const leave = () => setHovered(false);

    host.addEventListener("pointerenter", enter);
    host.addEventListener("pointermove", track);
    host.addEventListener("pointerleave", leave);
    host.addEventListener("pointercancel", leave);

    return () => {
      host.removeEventListener("pointerenter", enter);
      host.removeEventListener("pointermove", track);
      host.removeEventListener("pointerleave", leave);
      host.removeEventListener("pointercancel", leave);
    };
  }, [x, y]);

  const ring = useMotionTemplate`radial-gradient(${ringSize}px circle at ${x}px ${y}px, ${ringColor}, transparent 72%)`;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]"
    >
      {/* Orb — trails the cursor, lights the card from within. Four stops rather
          than three: the extra mid-stop stretches the falloff so the edge
          dissolves into the card instead of ending on a visible rim. */}
      <motion.div
        style={{
          x,
          y,
          width: size,
          height: size,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          background: `radial-gradient(circle at center, ${glowFrom} 0%, ${glowFrom} 12%, ${glowTo} 38%, color-mix(in oklab, ${glowTo} 35%, transparent) 58%, transparent 82%)`,
          filter: `blur(${blur}px)`,
        }}
        animate={{ opacity: hovered ? intensity : 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="absolute left-0 top-0 rounded-full"
      />

      {/* Border ring — the same light, masked to the 1px edge so the card's
          outline picks up the colour without tinting its surface. */}
      <motion.div
        style={{
          background: ring,
          padding: 1,
          mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          maskComposite: "exclude",
          WebkitMaskComposite: "xor",
        }}
        animate={{ opacity: hovered ? 1 : 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="absolute inset-0 rounded-[inherit]"
      />
    </div>
  );
}

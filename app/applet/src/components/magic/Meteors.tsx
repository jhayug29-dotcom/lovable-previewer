import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Meteors — magicui's meteor shower, grey instead of the original blue.
 *
 * Each meteor is a 2px head with a 50px gradient tail, rotated by `--angle` and
 * flung along its own axis by the `meteor` keyframes (see styles.css). Positions,
 * delays and durations are randomised **in an effect**, not during render: the
 * landing page is server-rendered, and `Math.random()` in the render pass would
 * produce different markup on the server and the client and trip hydration.
 * Rendering nothing on the first pass is fine — this is purely decorative.
 *
 * Spread is expressed in percentages of the host, so the shower is scoped to the
 * section it decorates rather than the viewport, and needs no resize handling.
 */
export interface MeteorsProps {
  /** How many meteors to scatter. @default 24 */
  number?: number;
  /** Shortest / longest start delay in seconds. */
  minDelay?: number;
  maxDelay?: number;
  /** Shortest / longest fall duration in seconds. */
  minDuration?: number;
  maxDuration?: number;
  /** Fall direction in degrees. @default 215 */
  angle?: number;
  /**
   * How far down the host the shower reaches, as a CSS length/percentage. The
   * streaks start at the host's top edge and dissolve before this line, so the
   * shower sits in the band where the black background begins instead of raining
   * through the whole section. @default "40%"
   */
  depth?: string;
  /** Distance each streak travels along its own axis, in px. @default 300 */
  travel?: number;
  /** Extra classes on each meteor (colour overrides go here). */
  className?: string;
}

export function Meteors({
  number = 24,
  minDelay = 0.2,
  maxDelay = 1.4,
  minDuration = 3,
  maxDuration = 9,
  angle = 215,
  depth = "40%",
  travel = 300,
  className,
}: MeteorsProps) {
  const [meteors, setMeteors] = useState<CSSProperties[]>([]);

  useEffect(() => {
    // Deal the meteors across the full width plus a margin on each side, so the
    // ones that drift in from off-screen keep the shower from looking bounded.
    setMeteors(
      Array.from({ length: number }, (_, i) => {
        const slot = (i + Math.random()) / number; // even spread, jittered
        return {
          "--angle": `${-angle}deg`,
          "--meteor-travel": `${travel}px`,
          "--meteor-delay": `${(minDelay + Math.random() * (maxDelay - minDelay)).toFixed(2)}s`,
          "--meteor-duration": `${(minDuration + Math.random() * (maxDuration - minDuration)).toFixed(2)}s`,
          top: "-2%",
          left: `${(slot * 130 - 15).toFixed(2)}%`,
        } as CSSProperties;
      }),
    );
  }, [number, minDelay, maxDelay, minDuration, maxDuration, angle, travel]);

  return (
    <div
      aria-hidden="true"
      style={{
        height: depth,
        // The streaks fade out well before the band's bottom edge, so there is no
        // hard line where the shower stops.
        maskImage: "linear-gradient(to bottom, #000 0%, #000 45%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to bottom, #000 0%, #000 45%, transparent 100%)",
      }}
      className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden"
    >
      {meteors.map((style, i) => (
        <span
          key={i}
          style={style}
          className={cn(
            "animate-meteor absolute size-0.5 rotate-[var(--angle)] rounded-full bg-zinc-400/80 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]",
            className,
          )}
        >
          {/* Tail — drawn behind the head, fading to nothing. */}
          <span className="absolute top-1/2 -z-10 h-px w-[52px] -translate-y-1/2 bg-gradient-to-r from-zinc-400/80 to-transparent" />
        </span>
      ))}
    </div>
  );
}

import { useMemo, type CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";

export type AuroraBarsProps = {
  barCount?: number;
  colors?: string[];
  maxHeightRatio?: number;
  minHeightRatio?: number;
  /** Higher = faster bobbing. */
  speed?: number;
  gap?: number;
  blur?: number;
  background?: string;
  className?: string;
  style?: CSSProperties;
};

/**
 * Animated "aurora bars" — a row of softly glowing vertical bars that bob
 * organically (tallest near the centre, shorter toward the edges). Used as the
 * cinematic hero background. Respects `prefers-reduced-motion`.
 */
export function AuroraBars({
  barCount = 24,
  colors = ["#ffd6eb", "#ff9acb", "#ff5aa6", "#ff2d78", "#00000000"],
  maxHeightRatio = 0.92,
  minHeightRatio = 0.18,
  speed = 0.5,
  gap = 3,
  blur = 0,
  background = "#000000",
  className = "",
  style,
}: AuroraBarsProps) {
  const reduced = useReducedMotion();

  // Only the bold colors are used to tint the bars — the trailing transparent
  // stop is dropped so every bar stays visible (it represents the fade in the
  // original palette).
  const tints = useMemo(() => colors.filter((c) => !/^#?0{6,8}$/i.test(c)), [colors]);

  const bars = useMemo(() => {
    const center = (barCount - 1) / 2;
    return Array.from({ length: barCount }).map((_, i) => {
      const dist = center === 0 ? 0 : Math.abs(i - center) / center;
      const bell = Math.pow(Math.cos(Math.min(dist, 1) * (Math.PI / 2)), 1.4);
      const base = minHeightRatio + (maxHeightRatio - minHeightRatio) * bell;
      // Slightly odd/staggered durations + delays so bars never sync up.
      const dur = (6.5 + ((i * 1.7) % 4.5)) / Math.max(0.1, speed);
      const delay = (i % 9) * 0.45;
      const color = tints.length ? tints[i % tints.length] : colors[i % colors.length];
      return { base, dur, delay, color };
    });
  }, [barCount, minHeightRatio, maxHeightRatio, speed, tints, colors]);

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 select-none overflow-hidden ${className}`}
      style={{ background, ...style }}
    >
      <div className="flex h-full w-full items-end justify-center" style={{ gap }}>
        {bars.map((bar, i) => {
          const baseStyle = {
            background: `linear-gradient(to top, ${bar.color}00 0%, ${bar.color}cc 55%, ${bar.color}f2 100%)`,
            height: `${bar.base * 100}%`,
            opacity: 0.34,
          };
          const style = blur ? { ...baseStyle, filter: `blur(${blur}px)` } : baseStyle;
          return (
            <motion.div
              key={i}
              className="h-full w-full self-end rounded-t-full"
              style={style}
              animate={
                reduced
                  ? {}
                  : {
                      height: [
                        `${bar.base * 100}%`,
                        `${bar.base * 70}%`,
                        `${Math.min(112, bar.base * 112)}%`,
                        `${bar.base * 100}%`,
                      ],
                    }
              }
              transition={
                reduced
                  ? {}
                  : {
                      duration: bar.dur,
                      repeat: Infinity,
                      ease: "easeInOut" as const,
                      delay: -bar.delay,
                    }
              }
            />
          );
        })}
      </div>
    </div>
  );
}

export default AuroraBars;

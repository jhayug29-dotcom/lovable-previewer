import { useRef, type ReactNode } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "motion/react";

/**
 * Scroll-driven, word-by-word reveal. Each word eases from dim (0.15) to full
 * opacity as the paragraph travels through the viewport. Highlighted words sit
 * in pure white; the rest ride the muted foreground.
 */
export function ScrollRevealWords({
  text,
  highlight = [],
  className = "",
  dim = "rgba(255,255,255,0.55)",
  bright = "#ffffff",
}: {
  text: string;
  /** Words rendered brighter (matched case-insensitively, punctuation-trimmed). */
  highlight?: string[];
  className?: string;
  dim?: string;
  bright?: string;
}) {
  const ref = useRef<HTMLParagraphElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start 0.85", "start 0.35"],
  });

  const words = text.split(" ");
  const highlightSet = new Set(highlight.map((w) => w.toLowerCase().replace(/[^a-z]/gi, "")));

  return (
    <p ref={ref} className={className}>
      {words.map((word, i) => {
        const start = i / words.length;
        const end = start + 1 / words.length;
        const clean = word.toLowerCase().replace(/[^a-z]/gi, "");
        return (
          <Word
            key={`${word}-${i}`}
            progress={scrollYProgress}
            range={[start, end]}
            color={highlightSet.has(clean) ? bright : dim}
          >
            {word}
          </Word>
        );
      })}
    </p>
  );
}

function Word({
  children,
  progress,
  range,
  color,
}: {
  children: ReactNode;
  progress: MotionValue<number>;
  range: [number, number];
  color: string;
}) {
  const opacity = useTransform(progress, range, [0.15, 1]);
  return (
    <motion.span style={{ opacity, color }} className="inline-block">
      {children}
      {" "}
    </motion.span>
  );
}

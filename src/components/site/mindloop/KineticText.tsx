"use client";

/**
 * Kinetic typography — the Magic UI `kinetic-text` interaction.
 *
 * Each character is its own span. As the cursor moves across the line, the
 * letter under the pointer swells to a heavy weight with a specular text-stroke,
 * and its immediate neighbours taper down through 600 → 400 for a fluid ripple.
 * The effect is pure CSS (`:hover` + sibling `has-[]` / adjacency selectors), so
 * it needs no scroll and no JS. A visually-hidden copy of the full string keeps
 * it accessible while every animated glyph is aria-hidden.
 *
 * Adapted for this store:
 *  - text is grouped by word, so words never break across lines mid-character;
 *  - highlighted words render in the serif-italic accent used across the landing;
 *  - **the ripple is layout-free.** Each letter box is measured once by a hidden
 *    `::before` ghost pinned to the resting weight (see `.kt-letter` in
 *    styles.css) and the live glyph is painted in an absolutely positioned child.
 *    Hovering therefore changes no box width anywhere, so the line can't re-wrap
 *    under the cursor — the trailing word stays put — and the browser only has to
 *    repaint, which keeps the motion perfectly smooth. Because the ghost measures
 *    at the resting weight, the resting line also tracks like ordinary text.
 */

import { useMemo } from "react";
import { cn } from "@/lib/utils";

// The per-letter ripple, lifted from the Magic UI component. Padding-based
// swelling is intentionally dropped — the glyph is out of flow, so it can grow
// past its own box; weight and stroke carry the effect without touching layout.
const LETTER =
  "kt-letter [will-change:font-weight,-webkit-text-stroke-width] " +
  "[-webkit-text-stroke-color:transparent] [-webkit-text-stroke-width:var(--text-stroke-width)] " +
  "[transition:font-weight_0.45s_cubic-bezier(0.22,1,0.36,1),_-webkit-text-stroke-color_0.45s_ease-out,_-webkit-text-stroke-width_0.45s_ease-out] " +
  "hover:font-[900] hover:[-webkit-text-stroke-color:currentcolor] " +
  "hover:[-webkit-text-stroke-width:calc(var(--text-stroke-width)*2)] " +
  "has-[+span+span:hover]:font-[400] " +
  "has-[+span:hover]:font-[650] " +
  "[:hover+&]:font-[650] [:hover+span+&]:font-[400]";

export interface KineticTextProps {
  text: string;
  className?: string;
  /** Words rendered in the serif-italic accent (case-insensitive match). */
  highlight?: string[];
  /** Override the accent classes applied to highlighted words. */
  highlightClassName?: string;
}

export function KineticText({
  text,
  className,
  highlight = [],
  highlightClassName,
}: KineticTextProps) {
  const words = useMemo(() => text.split(" "), [text]);
  const highlightSet = useMemo(() => new Set(highlight.map((w) => w.toLowerCase())), [highlight]);

  return (
    <span
      className={cn("inline-flex flex-wrap justify-center font-[300]", className)}
      style={
        {
          // The hidden ghost that reserves each letter box measures at THIS weight
          // — the resting one — so the headline tracks like ordinary text. Keep it
          // in sync with the `font-[300]` above.
          "--kt-rest-weight": "300",
          "--text-stroke-width": "calc(1em * 125 / 6000)",
        } as React.CSSProperties
      }
    >
      {words.map((word, wi) => {
        const isHighlight = highlightSet.has(word.toLowerCase());
        return (
          <span key={`${word}-${wi}`} className="inline-flex whitespace-nowrap" aria-hidden="true">
            {Array.from(word).map((ch, ci) =>
              isHighlight ? (
                // Accent words keep the serif italic look and skip the weight
                // ripple (Instrument Serif has no heavy weights to swell into).
                <span
                  key={ci}
                  className={cn(
                    "inline-block",
                    highlightClassName ?? "font-instrument font-normal italic",
                  )}
                >
                  {ch}
                </span>
              ) : (
                // data-ch feeds the hidden width-reserving ghost (styles.css).
                <span key={ci} className={LETTER} data-ch={ch}>
                  <span>{ch}</span>
                </span>
              ),
            )}
            {wi < words.length - 1 && <span className="inline-block">&nbsp;</span>}
          </span>
        );
      })}
      <span className="sr-only">{text}</span>
    </span>
  );
}

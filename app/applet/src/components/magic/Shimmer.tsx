import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Shimmer — the magicui shimmer-button effect, unbundled from `<button>`.
 *
 * The original ships as a self-contained button, but on this site the surfaces
 * that need it are already other things: a TanStack `<Link>` (Explore Assets), a
 * `<span>` badge inside a product link (the arrow), and the product card itself.
 * Nesting a button inside a link is invalid HTML, so the three animated layers
 * live here instead and any host can opt in by adding `SHIMMER_SURFACE`.
 *
 * How it reads: a conic-gradient spark orbits behind the surface while sliding
 * across it; an opaque backdrop inset by `--cut` covers everything except a
 * hairline rim, so all you see is a highlight travelling around the border. The
 * spark sits at `-z-30` and the backdrop at `-z-20`, so the host's own content
 * always paints on top — the label is never washed over.
 */
export interface ShimmerLayersProps {
  /** Colour of the travelling spark. */
  shimmerColor?: string;
  /** Width of the rim the spark shows through. @default "1.5px" */
  shimmerSize?: string;
  /** Time for one sweep across the surface. @default "3s" */
  shimmerDuration?: string;
  /**
   * Fill painted over the spark. Must match the host's own background, or the
   * rim will read as a colour change rather than a highlight.
   * @default "var(--background)"
   */
  background?: string;
  /**
   * Only show the shimmer while the host is hovered. The host must carry
   * Tailwind's `group` class. Use this on large surfaces (cards) where a
   * permanent animation would be restless.
   */
  onHoverOnly?: boolean;
}

/**
 * Classes the host element needs: `relative` to contain the layers, `z-0` to
 * open a stacking context (so the negative-z layers paint above the host's own
 * background but below its content), and `overflow-hidden` to clip the spark.
 */
export const SHIMMER_SURFACE = "relative z-0 overflow-hidden";

export function ShimmerLayers({
  shimmerColor = "rgba(255, 255, 255, 0.92)",
  shimmerSize = "1.5px",
  shimmerDuration = "3s",
  background = "var(--background)",
  onHoverOnly = false,
}: ShimmerLayersProps) {
  return (
    <>
      {/* Spark: a rotating conic gradient that also slides end to end. */}
      <div
        aria-hidden="true"
        style={
          {
            "--speed": shimmerDuration,
            "--shimmer-color": shimmerColor,
          } as CSSProperties
        }
        className={cn(
          "pointer-events-none absolute inset-0 -z-30 overflow-visible blur-[2px] [container-type:size]",
          onHoverOnly && "opacity-0 transition-opacity duration-300 group-hover:opacity-100",
        )}
      >
        <div className="animate-shimmer-slide absolute inset-0 h-[100cqh] [aspect-ratio:1]">
          <div className="animate-shimmer-spin absolute -inset-full w-auto [background:conic-gradient(from_calc(270deg-(var(--spread,90deg)*0.5)),transparent_0,var(--shimmer-color)_var(--spread,90deg),transparent_var(--spread,90deg))]" />
        </div>
      </div>

      {/* Backdrop: hides the spark except for a `--cut`-wide rim at the edge. */}
      <div
        aria-hidden="true"
        style={{ background, inset: shimmerSize }}
        className="pointer-events-none absolute -z-20 rounded-[inherit]"
      />
    </>
  );
}

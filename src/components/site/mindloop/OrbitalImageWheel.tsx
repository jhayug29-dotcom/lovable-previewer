"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger);

export interface OrbitalImageWheelImage {
  src: string;
  alt?: string;
  label?: string;
}

export interface OrbitalImageWheelProps {
  /** Images displayed around the wheel. */
  images: OrbitalImageWheelImage[];
  /** Number of full wheel turns during the scroll range. @default 4 */
  turns?: number;
  /** Maximum blur amount (px) away from the focus zone. @default 4 */
  blur?: number;
  /** Minimum brightness (%) away from focus. @default 40 */
  dim?: number;
  /** Extra brightness boost (%) around the active card. @default 30 */
  brightnessBoost?: number;
  /** Multiplier for out-of-focus darkening intensity. @default 1.05 */
  darknessStrength?: number;
  /** Minimum saturation (%) away from focus. @default 55 */
  minSaturation?: number;
  /** Multiplier for out-of-focus desaturation intensity. @default 0.6 */
  saturationStrength?: number;
  /** Focus zone width as normalized angular range. @default 0.34 */
  focusSpread?: number;
  /** Scale reduction amount away from focus. @default 0.06 */
  scaleEffect?: number;
  /** Scroll sensitivity multiplier. Lower values require longer scrolling. @default 0.7 */
  scrollSensitivity?: number;
  /** Card width in pixels. Treated as a maximum — the real width is capped by
   * the gap between neighbours so cards can never overlap. @default 220 */
  itemWidth?: number;
  /** Card height in pixels. Only its ratio to `itemWidth` is used. @default 300 */
  itemHeight?: number;
  /** Optional fixed wheel diameter in pixels. Defaults to a responsive value based on viewport width. */
  wheelSize?: number;
  /**
   * Peak `rotateY` in degrees at the far ends of the arc. This is what gives the
   * reference its look: each card is mounted tangentially on a cylinder, so the
   * ones toward the edges turn away from the viewer and foreshorten into a
   * trapezoid instead of sliding past as flat rectangles. 0 disables it.
   * @default 30
   */
  yaw?: number;
  /**
   * Dissolve the arc's left and right ends into the page instead of letting the
   * outermost cards leave on a hard vertical edge. @default true
   */
  edgeFade?: boolean;
  /** @deprecated The arc is now sized from the ring geometry; this is ignored. */
  cropRatio?: number;
  /** Scroll section height in viewport units. @default 330 */
  scrollLength?: number;
  /** Optional scrollable container element used as the animation scroller. */
  scrollContainerRef?: RefObject<HTMLElement | null>;
  /**
   * Spin continuously on a slow, seamless loop instead of scrubbing to scroll.
   * Keep `turns` a whole number so the loop wraps without a visible jump.
   * @default false
   */
  autoplay?: boolean;
  /** Seconds for one full autoplay cycle (all `turns`). @default 46 */
  autoplayDuration?: number;
  /** @deprecated The section height is now derived from the ring geometry. */
  autoplayHeight?: string;
  /** Additional class name on the root element. */
  className?: string;
}

const DEFAULT_TURNS = 4;
const DEFAULT_BLUR = 4;
const DEFAULT_DIM = 40;
const DEFAULT_BRIGHTNESS_BOOST = 30;
const DEFAULT_DARKNESS_STRENGTH = 1.05;
const DEFAULT_MIN_SATURATION = 55;
const DEFAULT_SATURATION_STRENGTH = 0.6;
const DEFAULT_FOCUS_SPREAD = 0.34;
const DEFAULT_SCALE_EFFECT = 0.06;
const DEFAULT_SCROLL_SENSITIVITY = 0.7;
const DEFAULT_ITEM_WIDTH = 248;
const DEFAULT_ITEM_HEIGHT = 300;
const DEFAULT_SCROLL_LENGTH = 330;
const DEFAULT_CROP_RATIO = 0.75;
const DEFAULT_AUTOPLAY_DURATION = 46;
const DEFAULT_AUTOPLAY_HEIGHT = "72vh";

/* Motion constants shared by the animation and the layout math. The height of
 * the section is derived from these, so a card can never be painted outside the
 * box and clipped against the black page behind it. */
const MAX_TILT_DEG = 4.5; // peak lean at the far ends of the arc
const MAX_DEPTH = 100; // stacking depth of the focused card (z-index only)
const DEFAULT_YAW_DEG = 30; // peak rotateY at the far ends of the arc
/* Per-card perspective. Applied *inside* each card's own transform (GSAP's
 * `transformPerspective`) rather than as a `perspective` on the stage: a stage
 * perspective is measured from the stage's centre, which for this wheel is the
 * ring centre far below the section — every card would then be projected
 * radially outward and the top of the arc would clip. Per-card perspective is
 * measured from the card's own centre, so `rotateY` foreshortens it in place. */
const CARD_PERSPECTIVE = 900;
/* Where the arc dissolves into the page, as stops for a horizontal mask. */
const EDGE_FADE =
  "linear-gradient(to right, transparent 0%, #000 11%, #000 89%, transparent 100%)";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function shortestAngleDistance(a: number, b: number) {
  const full = Math.PI * 2;
  const raw = ((a - b + Math.PI) % full) - Math.PI;
  const normalized = raw < -Math.PI ? raw + full : raw;
  return Math.abs(normalized);
}

function applyScrollSensitivity(progress: number, sensitivity: number) {
  const safeSensitivity = clamp(sensitivity, 0.25, 1.6);
  const exponent = 1 / safeSensitivity;
  return Math.pow(clamp(progress, 0, 1), exponent);
}

function getFocusedImageIndexWithHysteresis(
  progress: number,
  total: number,
  turns: number,
  currentIndex: number,
  hysteresis = 0.18,
) {
  if (total <= 0 || turns <= 0) return 0;

  const phaseRaw = total * (0.25 + progress * turns);
  const phase = ((phaseRaw % total) + total) % total;

  if (currentIndex < 0) {
    return Math.round(phase) % total;
  }

  let next = currentIndex;
  let delta = phase - next;

  if (delta > total / 2) delta -= total;
  if (delta < -total / 2) delta += total;

  const threshold = 0.5 + clamp(hysteresis, 0, 0.35);

  while (delta > threshold) {
    next = (next + 1) % total;
    delta -= 1;
  }

  while (delta < -threshold) {
    next = (next - 1 + total) % total;
    delta += 1;
  }

  return next;
}

function useViewportWidth(viewportRef: RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState(1200);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const update = () => setWidth(viewport.clientWidth || 1200);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(viewport);

    return () => observer.disconnect();
  }, [viewportRef]);

  return width;
}

/**
 * Scroll-driven orbital wheel of images — adapted from the source component.
 * The caption / title-pill block was removed (product names are not shown here),
 * and the animation is synced to the page's Lenis smooth scroll via GSAP's
 * ticker (see `useSmoothScroll`).
 */
export function OrbitalImageWheel({
  images,
  turns = DEFAULT_TURNS,
  blur = DEFAULT_BLUR,
  dim = DEFAULT_DIM,
  brightnessBoost = DEFAULT_BRIGHTNESS_BOOST,
  darknessStrength = DEFAULT_DARKNESS_STRENGTH,
  minSaturation = DEFAULT_MIN_SATURATION,
  saturationStrength = DEFAULT_SATURATION_STRENGTH,
  focusSpread = DEFAULT_FOCUS_SPREAD,
  scaleEffect = DEFAULT_SCALE_EFFECT,
  scrollSensitivity = DEFAULT_SCROLL_SENSITIVITY,
  itemWidth = DEFAULT_ITEM_WIDTH,
  itemHeight = DEFAULT_ITEM_HEIGHT,
  wheelSize,
  yaw = DEFAULT_YAW_DEG,
  edgeFade = true,
  cropRatio = DEFAULT_CROP_RATIO,
  scrollLength = DEFAULT_SCROLL_LENGTH,
  scrollContainerRef,
  autoplay = false,
  autoplayDuration = DEFAULT_AUTOPLAY_DURATION,
  autoplayHeight = DEFAULT_AUTOPLAY_HEIGHT,
  className,
}: OrbitalImageWheelProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const wheelScrollTriggerRef = useRef<ScrollTrigger | null>(null);

  const viewportWidth = useViewportWidth(viewportRef);

  const boundedTurns = clamp(turns, 0.2, 4);
  const boundedBlur = clamp(blur, 0, 36);
  const boundedDim = clamp(dim, 0, 100);
  const boundedBrightnessBoost = clamp(brightnessBoost, 0, 120);
  const boundedDarknessStrength = clamp(darknessStrength, 0.2, 3);
  const boundedMinSaturation = clamp(minSaturation, 0, 100);
  const boundedSaturationStrength = clamp(saturationStrength, 0.2, 3);
  const boundedFocusSpread = clamp(focusSpread, 0.08, 0.8);
  const boundedScaleEffect = clamp(scaleEffect, 0, 0.3);
  const boundedScrollSensitivity = clamp(scrollSensitivity, 0.25, 1.6);
  const boundedCropRatio = clamp(cropRatio, 0.2, 0.8);
  const boundedScrollLength = clamp(scrollLength, 180, 700);
  const boundedYaw = clamp(yaw, 0, 60);

  /* ------------------------------------------------------------------ geometry
   * Everything below is derived from the container width so the ring can never
   * be clipped and cards can never overlap, at any viewport size:
   *
   *   radius     — deliberately much larger than the viewport, so the visible
   *                slice of the ring reads as a *gentle* arc rather than a tight
   *                curl at the sides (and the ends sit closer to the centre)
   *   visible    — how many cards should span the width; drives `ringCount`, so
   *                on-screen density stays constant however flat the arc is
   *   chord      — straight-line gap between two neighbouring card centres;
   *                card width is capped just under it, which *guarantees* a
   *                visible gap instead of the cards touching / overlapping
   *   arcDepth   — how far the ring drops from its top point to the screen edge
   *   cardHalfSpan — half the *painted* card height, i.e. after the tilt and the
   *                perspective push have made its box taller than `itemHeight`
   *   height     — pad + painted card + arcDepth: exactly what the arc needs, so
   *                nothing is ever cut off by the black section edge
   */
  const aspect = itemHeight / itemWidth;

  // Card size target, scaled down on small screens so it stays proportionate.
  const itemScale =
    viewportWidth < 480 ? 0.62 : viewportWidth < 768 ? 0.74 : viewportWidth < 1024 ? 0.86 : 1;
  const targetItemWidth = itemWidth * itemScale;

  // A wide radius flattens the arc; wheelSize (when given) still wins.
  const responsiveRadius = clamp(viewportWidth * 1.35, 520, 2400);
  const radius = wheelSize ? clamp(wheelSize / 2, 320, 2600) : responsiveRadius;

  // Half of the ring's angular sweep across the visible width.
  const halfAngle = Math.asin(clamp(viewportWidth / (2 * radius), 0, 1));

  // Keep the same number of cards on screen no matter how flat the arc is:
  // pick the on-screen count first, then back out the full ring size from it.
  const visibleCards = Math.max(2, Math.round(viewportWidth / (targetItemWidth * 1.16)));
  const angularStep = (halfAngle * 2) / visibleCards;
  const ringCount = clamp(Math.round((Math.PI * 2) / angularStep), 8, 64);

  // Chord between neighbours — the hard ceiling on card width.
  const chord = 2 * radius * Math.sin(Math.PI / ringCount);
  const boundedItemWidth = clamp(Math.min(targetItemWidth, chord * 0.82), 84, 520);
  const boundedItemHeight = boundedItemWidth * aspect;

  // Vertical drop of the arc. Measured to the angle where a card's *body* still
  // touches the screen edge (its centre may already be past it), which is the
  // lowest point anything is actually painted at — measuring to `halfAngle`
  // alone under-reserves and lets that card dip below the section.
  const edgeAngle = Math.asin(clamp((viewportWidth + boundedItemWidth) / (2 * radius), 0, 1));
  const arcDepth = radius * (1 - Math.cos(edgeAngle));

  // Cards are tilted, so their painted box is slightly taller than
  // `boundedItemHeight`. Reserve that overshoot at both ends of the arc,
  // otherwise the top card clips the section edge and the lowest one gets
  // sliced by the black below. (Cards are never pushed along z — see the note
  // in `applyState` — so this is the whole of the overshoot.)
  const tiltRad = (MAX_TILT_DEG * Math.PI) / 180;
  const cardHalfSpan =
    (boundedItemWidth * Math.sin(tiltRad) + boundedItemHeight * Math.cos(tiltRad)) / 2;

  const edgePad = viewportWidth < 640 ? 14 : 24;
  const ringTop = edgePad + cardHalfSpan;
  const autoHeight = Math.round(edgePad * 2 + cardHalfSpan * 2 + arcDepth);

  // The cards actually mounted on the ring — `images` is cycled so the ring is
  // always full, and the count follows the viewport (see `ringCount`).
  const ringImages = useMemo(() => {
    if (images.length === 0) return [];
    return Array.from({ length: ringCount }, (_, i) => images[i % images.length]!);
  }, [images, ringCount]);

  // Every numeric knob the animation reads, folded into one primitive dep. The
  // effect below then has a fixed-length dependency list, so hot reloads can
  // never trip React's "dependency array changed size" guard.
  const animKey = [
    radius,
    boundedTurns,
    boundedBlur,
    boundedDim,
    boundedBrightnessBoost,
    boundedDarknessStrength,
    boundedMinSaturation,
    boundedSaturationStrength,
    boundedFocusSpread,
    boundedScaleEffect,
    boundedScrollSensitivity,
    boundedYaw,
  ].join("|");

  useEffect(() => {
    const section = sectionRef.current;
    const wheel = wheelRef.current;
    if (!section || !wheel || ringImages.length === 0) return;

    let previousActive = -1;

    const context = gsap.context(() => {
      const cards = Array.from(
        wheel.querySelectorAll<HTMLElement>(".oiw-item"),
      );
      if (cards.length === 0) return undefined;

      const topAnchor = -Math.PI / 2;
      const focusArc = Math.PI * boundedFocusSpread;

      const applyState = (rawProgress: number) => {
        // Autoplay spins at a constant rate for a seamless wrap; scroll mode
        // eases through the sensitivity curve so the scrub feels weighted.
        const p = autoplay
          ? clamp(rawProgress, 0, 1)
          : applyScrollSensitivity(rawProgress, boundedScrollSensitivity);
        const rotation = -p * boundedTurns * Math.PI * 2;
        const focusedIndex = getFocusedImageIndexWithHysteresis(
          p,
          cards.length,
          boundedTurns,
          previousActive,
        );

        cards.forEach((card, index) => {
          const base = (index / cards.length) * Math.PI * 2 - Math.PI;
          const theta = base + rotation;
          const x = Math.cos(theta) * radius;
          const y = Math.sin(theta) * radius;

          const distanceToFocus = shortestAngleDistance(theta, topAnchor);
          const focusIntensity = clamp(distanceToFocus / focusArc, 0, 1);

          const darkIntensity = clamp(
            focusIntensity * boundedDarknessStrength,
            0,
            1,
          );
          const saturationIntensity = clamp(
            focusIntensity * boundedSaturationStrength,
            0,
            1,
          );

          const currentBlur = darkIntensity * boundedBlur;
          const peakBrightness = clamp(100 + boundedBrightnessBoost, 100, 220);
          const currentBrightness =
            boundedDim + (1 - darkIntensity) * (peakBrightness - boundedDim);
          const currentSaturation =
            boundedMinSaturation +
            (1 - saturationIntensity) * (100 - boundedMinSaturation);
          const currentScale = 1 - darkIntensity * boundedScaleEffect;
          const drift = clamp(x / radius, -1, 1);
          // Gentle tilt — cards lean with the arc without looking thrown. The
          // section height reserves room for this (see `cardHalfSpan`).
          const tilt = drift * MAX_TILT_DEG;
          // Yaw is what makes this read as an *orbit* rather than a conveyor:
          // each card is tangential to the ring, so it turns away from the viewer
          // as it travels outward and foreshortens into a trapezoid. Negative
          // `drift` (left of centre) turns the card's right edge toward us, which
          // is the direction a cylinder actually presents.
          const cardYaw = -drift * boundedYaw;
          // `depth` drives stacking order only. It is deliberately NOT applied
          // as a `z` translation: the wheel's perspective origin is the ring
          // *centre*, so pushing a card toward the viewer also throws it
          // radially outward — which lifted the top card ~100px out of the
          // section and clipped it. The focus "pop" comes from `scale`, which
          // grows the card about its own centre and moves nothing.
          const depth = clamp((1 - focusIntensity) * MAX_DEPTH, 0, MAX_DEPTH);

          gsap.set(card, {
            x,
            y,
            xPercent: -50,
            yPercent: -50,
            rotate: tilt,
            rotationY: cardYaw,
            transformPerspective: CARD_PERSPECTIVE,
            scale: currentScale,
            filter: `blur(${currentBlur}px) brightness(${currentBrightness}%) saturate(${currentSaturation}%)`,
            zIndex: Math.round(depth),
          });
        });

        previousActive = focusedIndex;
      };

      applyState(0);

      if (autoplay) {
        // Continuous spin on a private rAF loop.
        //
        // Deliberately NOT a GSAP tween: the page also drives Lenis smooth
        // scrolling off gsap.ticker, and a throw inside any ticker callback can
        // take the whole shared loop down with it — which would stop this wheel
        // *and* freeze page scrolling. An own loop that re-queues itself before
        // doing any work (and swallows errors) can't stall either one.
        const durationMs = Math.max(6, autoplayDuration) * 1000;
        const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        if (reduced) return undefined;

        let frame = 0;
        const start = performance.now();
        const loop = (now: number) => {
          frame = requestAnimationFrame(loop); // re-queue first — never stalls
          try {
            // Off-screen: keep the clock running, skip the DOM writes.
            const rect = section.getBoundingClientRect();
            if (rect.bottom < -240 || rect.top > window.innerHeight + 240) return;
            applyState(((now - start) % durationMs) / durationMs);
          } catch {
            /* a bad frame must never kill the loop */
          }
        };
        frame = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frame);
      }

      const trigger = ScrollTrigger.create({
        trigger: section,
        // Only pass `scroller` when there really is one — ScrollTrigger's typings
        // reject an explicit `undefined` under exactOptionalPropertyTypes.
        ...(scrollContainerRef?.current ? { scroller: scrollContainerRef.current } : {}),
        start: "top top",
        end: "bottom bottom",
        scrub: true,
        onUpdate: (self) => {
          try {
            applyState(self.progress);
          } catch {
            /* never break ScrollTrigger's shared update pass */
          }
        },
      });

      wheelScrollTriggerRef.current = trigger;
      return undefined;
    }, section);

    ScrollTrigger.refresh();

    return () => {
      context.revert();
      wheelScrollTriggerRef.current = null;
    };
  }, [
    scrollContainerRef,
    ringImages,
    animKey,
    autoplay,
    autoplayDuration,
  ]);

  if (ringImages.length === 0) {
    return null;
  }

  return (
    <section
      ref={sectionRef}
      // No `w-full` on purpose: a block section already fills its parent, and
      // leaving the width `auto` lets a caller break the wheel out of a padded
      // section with negative margins (full-bleed) instead of just shifting it.
      className={cn("relative", className)}
      style={{ height: autoplay ? `${autoHeight}px` : `${boundedScrollLength}vh` }}
    >
      <div
        ref={viewportRef}
        {...(edgeFade ? { style: { maskImage: EDGE_FADE, WebkitMaskImage: EDGE_FADE } } : {})}
        className={cn(
          "w-full overflow-hidden",
          autoplay ? "relative h-full" : "sticky top-0 h-screen",
        )}
      >
        {/* Backdrop. Two very wide, very low-contrast washes sitting behind the
            ring — it is first in DOM order at `z-0` while the cards are painted
            after it, so it never covers artwork. A cool lavender pool ties this
            section to the CTA's silk, and a white core reads as the light the
            cards are catching. Masked top and bottom as well as at the ends,
            because a radial clipped by the container edge shows the clip. */}
        <div
          aria-hidden="true"
          style={{
            maskImage:
              "linear-gradient(to bottom, transparent 0%, #000 30%, #000 66%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, transparent 0%, #000 30%, #000 66%, transparent 100%)",
          }}
          className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(70%_120%_at_50%_18%,rgba(146,108,238,0.16),transparent_70%),radial-gradient(38%_78%_at_50%_10%,rgba(255,255,255,0.07),transparent_72%)]"
        />
        {/* The wheel is a square the size of the ring. Its top edge *is* the
            ring's topmost point, so anchoring `top` to `ringTop` puts the
            highest card exactly `edgePad` below the section edge — no clipping,
            whatever the viewport. */}
        <div
          ref={wheelRef}
          className="absolute left-1/2 -translate-x-1/2"
          style={{ width: radius * 2, height: radius * 2, top: `${ringTop}px` }}
        >
          {/* Flat stage — no `perspective`. See the `depth` note in `applyState`:
              a perspective origin at the ring centre made the z-push move cards
              radially, which is what clipped the top of the arc. */}
          <div className="relative h-full w-full">
            {ringImages.map((img, i) => (
              <figure
                key={i}
                className="oiw-item absolute left-1/2 top-1/2 m-0 overflow-hidden rounded-xl bg-card"
                style={{ width: boundedItemWidth, height: boundedItemHeight }}
              >
                <div
                  className="absolute inset-0 h-full w-full bg-cover bg-center"
                  style={{ backgroundImage: `url(${img.src})` }}
                  role="img"
                  aria-label={img.alt ?? img.label ?? `Image ${i + 1}`}
                />
              </figure>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default OrbitalImageWheel;

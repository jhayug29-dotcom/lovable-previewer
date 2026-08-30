"use client";

/**
 * macOS-style magnifying dock — adapted from the Magic UI `dock` component.
 *
 * The original magnifies each icon's width/height; here the magnification is
 * applied as a `scale` on the child wrapper so it works for text pills (the
 * landing nav) as well as icons. Proximity to the cursor drives a spring, so
 * hovering one item gently swells it and its neighbours — the classic dock feel.
 */

import { cva, type VariantProps } from "class-variance-authority";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import React, { useRef } from "react";
import { cn } from "@/lib/utils";

const DEFAULT_MAGNIFICATION = 1.35;
const DEFAULT_DISTANCE = 120;

const dockVariants = cva("mx-auto flex w-max items-center justify-center gap-1");

export interface DockProps extends VariantProps<typeof dockVariants> {
  className?: string;
  /** Peak scale of the item directly under the cursor. @default 1.35 */
  magnification?: number;
  /** Pixel radius over which neighbouring items are affected. @default 120 */
  distance?: number;
  direction?: "top" | "middle" | "bottom";
  children: React.ReactNode;
}

export const Dock = React.forwardRef<HTMLDivElement, DockProps>(function Dock(
  {
    className,
    children,
    magnification = DEFAULT_MAGNIFICATION,
    distance = DEFAULT_DISTANCE,
    direction = "middle",
  },
  ref,
) {
  const mouseX = useMotionValue(Infinity);

  const renderChildren = () =>
    React.Children.map(children, (child) => {
      if (React.isValidElement<DockIconProps>(child) && child.type === DockIcon) {
        return React.cloneElement(child, { mouseX, magnification, distance });
      }
      return child;
    });

  return (
    <motion.div
      ref={ref}
      onMouseMove={(e) => mouseX.set(e.pageX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className={cn(dockVariants({ className }), {
        "items-start": direction === "top",
        "items-center": direction === "middle",
        "items-end": direction === "bottom",
      })}
    >
      {renderChildren()}
    </motion.div>
  );
});

export interface DockIconProps {
  magnification?: number;
  distance?: number;
  mouseX?: MotionValue<number>;
  className?: string;
  children?: React.ReactNode;
}

export function DockIcon({
  magnification = DEFAULT_MAGNIFICATION,
  distance = DEFAULT_DISTANCE,
  mouseX,
  className,
  children,
}: DockIconProps) {
  const ref = useRef<HTMLDivElement>(null);
  const defaultMouseX = useMotionValue(Infinity);
  const source = mouseX ?? defaultMouseX;

  // Signed horizontal distance from cursor to this item's centre.
  const distanceCalc = useTransform(source, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const scaleTarget = useTransform(
    distanceCalc,
    [-distance, 0, distance],
    [1, magnification, 1],
  );
  const scale = useSpring(scaleTarget, { mass: 0.1, stiffness: 150, damping: 12 });

  return (
    <motion.div ref={ref} style={{ scale }} className={cn("origin-center", className)}>
      {children}
    </motion.div>
  );
}

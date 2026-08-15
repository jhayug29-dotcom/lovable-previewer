import { useEffect, useState } from "react";
import { useIndependenceMode } from "@/hooks/useIndependenceMode";

export function RainingFlags() {
  const { isIndependenceMode } = useIndependenceMode();
  const [show, setShow] = useState(false);
  const [flags, setFlags] = useState<
    { id: number; left: number; delay: number; duration: number }[]
  >([]);

  useEffect(() => {
    if (isIndependenceMode) {
      // Generate random flags
      const newFlags = Array.from({ length: 8 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100, // 0 to 100%
        delay: Math.random() * 1.5, // 0 to 1.5s delay
        duration: 2.5 + Math.random() * 1.5, // 2.5s to 4s duration
      }));
      setFlags(newFlags);
      setShow(true);

      // Keep duration short and fade out
      const timer = setTimeout(() => setShow(false), 6000);
      return () => clearTimeout(timer);
    } else {
      setShow(false);
    }
  }, [isIndependenceMode]);

  if (!show) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {flags.map((flag) => (
        <span
          key={flag.id}
          className="absolute top-[-50px] animate-rain text-3xl sm:text-4xl"
          style={{
            left: `${flag.left}%`,
            animationDelay: `${flag.delay}s`,
            animationDuration: `${flag.duration}s`,
          }}
        >
          🇮🇳
        </span>
      ))}
    </div>
  );
}

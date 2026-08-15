import { useEffect, useState } from "react";

export function useIndependenceMode() {
  const [isIndependenceMode, setIsIndependenceMode] = useState(false);

  useEffect(() => {
    // Check initial state
    const current = localStorage.getItem("independence_mode") === "true";
    setIsIndependenceMode(current);

    // Listen to changes in other tabs
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "independence_mode") {
        setIsIndependenceMode(e.newValue === "true");
      }
    };

    // Listen to custom event for same-tab updates
    const handleCustomEvent = () => {
      setIsIndependenceMode(localStorage.getItem("independence_mode") === "true");
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("independence_mode_changed", handleCustomEvent);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("independence_mode_changed", handleCustomEvent);
    };
  }, []);

  const toggleIndependenceMode = (value: boolean) => {
    localStorage.setItem("independence_mode", String(value));
    setIsIndependenceMode(value);
    window.dispatchEvent(new Event("independence_mode_changed"));
  };

  return { isIndependenceMode, toggleIndependenceMode };
}

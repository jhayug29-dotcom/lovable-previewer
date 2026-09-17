import { useState } from "react";
import { Calendar, Check, Clock, RefreshCw, Radio } from "lucide-react";
import type { AnalyticsTimeframe } from "@/lib/timeframe";

const TIMEFRAME_OPTIONS: { id: AnalyticsTimeframe; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "1m", label: "1 month" },
  { id: "3m", label: "3 months" },
  { id: "10m", label: "10 months" },
  { id: "custom", label: "Custom range" },
];

interface Props {
  timeframe: AnalyticsTimeframe;
  onTimeframeChange: (tf: AnalyticsTimeframe) => void;
  customStartDate?: string;
  customEndDate?: string;
  onCustomRangeChange?: (start: string, end: string) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  className?: string;
}

export function AnalyticsTimeframeSelector({
  timeframe,
  onTimeframeChange,
  customStartDate = "",
  customEndDate = "",
  onCustomRangeChange,
  onRefresh,
  isRefreshing = false,
  className = "",
}: Props) {
  const [startInput, setStartInput] = useState(customStartDate);
  const [endInput, setEndInput] = useState(customEndDate);
  const [showCustomPicker, setShowCustomPicker] = useState(timeframe === "custom");

  const handleSelect = (tf: AnalyticsTimeframe) => {
    onTimeframeChange(tf);
    if (tf === "custom") {
      setShowCustomPicker(true);
    } else {
      setShowCustomPicker(false);
    }
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (startInput && onCustomRangeChange) {
      onCustomRangeChange(startInput, endInput || startInput);
      onTimeframeChange("custom");
    }
  };

  return (
    <div
      className={`glass relative overflow-hidden rounded-3xl p-4 sm:p-5 border border-white/40 shadow-sm ${className}`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Timeframe pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Clock className="size-3.5 text-primary" /> Timeframe:
          </span>
          <div className="flex flex-wrap gap-1 rounded-2xl bg-black/5 p-1">
            {TIMEFRAME_OPTIONS.map((opt) => {
              const active = timeframe === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelect(opt.id)}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all duration-300 ${
                    active
                      ? "bg-primary text-white shadow-xs"
                      : "text-ink/70 hover:bg-white/60 hover:text-ink"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Live indicator & Refresh button */}
        <div className="flex items-center gap-3 self-end lg:self-center">
          <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            Live Tracking
          </div>

          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh Analytics"
              className="flex items-center gap-1.5 rounded-2xl border border-ink/10 bg-white/80 px-3 py-1.5 text-xs font-semibold text-ink shadow-xs transition hover:bg-white disabled:opacity-60"
            >
              <RefreshCw
                className={`size-3.5 ${isRefreshing ? "animate-spin text-primary" : "text-muted-foreground"}`}
              />
              <span>{isRefreshing ? "Syncing..." : "Refresh"}</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Custom Date Range Picker Accordion */}
      {showCustomPicker ? (
        <form
          onSubmit={handleApplyCustom}
          className="mt-4 flex flex-wrap items-end gap-3 border-t border-ink/5 pt-4"
        >
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            <Calendar className="size-4 text-primary" />
            <span>Custom dates:</span>
          </div>

          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              From Date
            </span>
            <input
              type="date"
              value={startInput}
              onChange={(e) => setStartInput(e.target.value)}
              className="rounded-xl border border-ink/10 bg-white/90 px-3 py-1.5 text-xs font-medium text-ink outline-none focus:border-primary"
              required
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              To Date (Inclusive)
            </span>
            <input
              type="date"
              value={endInput}
              onChange={(e) => setEndInput(e.target.value)}
              className="rounded-xl border border-ink/10 bg-white/90 px-3 py-1.5 text-xs font-medium text-ink outline-none focus:border-primary"
            />
          </label>

          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-ink/90"
          >
            <Check className="size-3.5" />
            Apply Date Range
          </button>
        </form>
      ) : null}
    </div>
  );
}

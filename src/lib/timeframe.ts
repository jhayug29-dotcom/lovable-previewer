export type AnalyticsTimeframe = "today" | "7d" | "1m" | "3m" | "10m" | "custom";

export interface TimeframeBounds {
  timeframe: AnalyticsTimeframe;
  start: Date;
  end: Date;
  startIso: string;
  endIso: string;
  label: string;
}

export interface ActivityBucket {
  day: string; // Date or hour label (e.g. "2026-09-17" or "14:00")
  orders: number;
  revenue: number;
}

/**
 * Calculates start and end Date bounds for the given timeframe.
 * "Today" strictly starts at 00:00:00 IST (UTC+05:30) of the current day.
 */
export function getTimeframeBounds(
  timeframe: AnalyticsTimeframe = "1m",
  customStart?: string | null,
  customEnd?: string | null,
): TimeframeBounds {
  const now = new Date();
  let start: Date;
  let end: Date = now;
  let label = "1 Month";

  if (timeframe === "today") {
    // Current date in IST (Asia/Kolkata)
    const istDateString = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
    start = new Date(`${istDateString}T00:00:00+05:30`);
    label = "Today";
  } else if (timeframe === "7d") {
    start = new Date(now.getTime() - 7 * 86_400_000);
    label = "Last 7 Days";
  } else if (timeframe === "1m") {
    start = new Date(now.getTime() - 30 * 86_400_000);
    label = "Last 1 Month";
  } else if (timeframe === "3m") {
    start = new Date(now.getTime() - 90 * 86_400_000);
    label = "Last 3 Months";
  } else if (timeframe === "10m") {
    start = new Date(now.getTime() - 300 * 86_400_000);
    label = "Last 10 Months";
  } else if (timeframe === "custom" && customStart) {
    start = new Date(`${customStart}T00:00:00+05:30`);
    if (isNaN(start.getTime())) {
      start = new Date(now.getTime() - 30 * 86_400_000);
    }
    if (customEnd) {
      end = new Date(`${customEnd}T23:59:59.999+05:30`);
      if (isNaN(end.getTime())) end = now;
    } else {
      end = now;
    }
    label = `Custom (${customStart}${customEnd ? ` to ${customEnd}` : ""})`;
  } else {
    start = new Date(now.getTime() - 30 * 86_400_000);
    label = "Last 1 Month";
  }

  return {
    timeframe,
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    label,
  };
}

/**
 * Builds standard date/hour bucket map for the timeframe to ensure continuous
 * graphs without missing gaps.
 */
export function buildTimeframeBuckets(bounds: TimeframeBounds): Map<string, ActivityBucket> {
  const buckets = new Map<string, ActivityBucket>();

  if (bounds.timeframe === "today") {
    // 2-hour slots for today in IST: 00:00, 02:00, ..., 22:00
    for (let hour = 0; hour <= 23; hour += 2) {
      const slot = `${hour.toString().padStart(2, "0")}:00`;
      buckets.set(slot, { day: slot, orders: 0, revenue: 0 });
    }
    return buckets;
  }

  // Daily slots for 7d, 1m, 3m, 10m, or custom
  const DAY_MS = 86_400_000;
  const startTime = bounds.start.getTime();
  const endTime = bounds.end.getTime();

  // If longer than 120 days (e.g. 10m), bucket by 7-day intervals
  if (endTime - startTime > 120 * DAY_MS) {
    const cur = new Date(bounds.start);
    while (cur.getTime() <= endTime) {
      const key = cur.toISOString().slice(0, 10);
      buckets.set(key, { day: key, orders: 0, revenue: 0 });
      cur.setDate(cur.getDate() + 7);
    }
    const lastKey = bounds.end.toISOString().slice(0, 10);
    if (!buckets.has(lastKey)) {
      buckets.set(lastKey, { day: lastKey, orders: 0, revenue: 0 });
    }
    return buckets;
  }

  // Daily buckets
  const cur = new Date(bounds.start);
  while (cur.getTime() <= endTime + DAY_MS) {
    const key = cur.toISOString().slice(0, 10);
    buckets.set(key, { day: key, orders: 0, revenue: 0 });
    cur.setDate(cur.getDate() + 1);
  }

  return buckets;
}

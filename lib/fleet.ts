import type { RouteData } from "@/lib/route";

/**
 * Time-of-day fleet scheduler for the demo map.
 *
 * The Bangladesh clock (Asia/Dhaka) decides which autos are on duty and on
 * which real corridor. Each auto lives a chronological lifecycle while on
 * duty: PARKED (start/end of shift) → WAITING at a stand → CARRYING a
 * passenger along the corridor → arrived → WAITING again → … → PARKED.
 * The roster is built so at most MAX_CONCURRENT_AUTOS are ever on duty.
 */

export const MAX_CONCURRENT_AUTOS = 5;

// ---------- time bands (BD minutes-of-day, end exclusive) ----------

export type TimeBand = {
  id: string;
  label: string;
  /** BD minutes-of-day window; the list must cover 0–1440 without gaps. */
  from: number;
  to: number;
  /**
   * Scales how long an auto waits at a stand: rush hour fares come fast,
   * late night fares are scarce.
   */
  dwellScale: number;
};

export const TIME_BANDS: TimeBand[] = [
  { id: "late-night", label: "Late night", from: 0, to: 240, dwellScale: 1.7 },
  { id: "early-morning", label: "Early morning", from: 240, to: 360, dwellScale: 1.3 },
  { id: "morning-rush", label: "Morning rush", from: 360, to: 600, dwellScale: 0.65 },
  { id: "midday", label: "Midday", from: 600, to: 960, dwellScale: 1.0 },
  { id: "evening-rush", label: "Evening rush", from: 960, to: 1200, dwellScale: 0.75 },
  { id: "night", label: "Night", from: 1200, to: 1440, dwellScale: 1.35 },
];

export function timeBand(minutes: number): TimeBand {
  const m = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  return TIME_BANDS.find((b) => m >= b.from && m < b.to) ?? TIME_BANDS[2];
}

// ---------- roster ----------

export type FleetShift = {
  /** BD minutes-of-day, inclusive. */
  start: number;
  /** BD minutes-of-day, exclusive. May exceed 1440 for shifts past midnight. */
  end: number;
  /** Corridor id in data/routes.json. */
  corridor: string;
};

export type FleetAutoDef = {
  id: string;
  /** Auto nickname, shown on the map panel. */
  name: string;
  driver: string;
  plate: string;
  color: string;
  shifts: FleetShift[];
};

export const FLEET: FleetAutoDef[] = [
  {
    id: "pahar", name: "Pahar", driver: "Jahangir", plate: "METRO-31-2044", color: "#475569",
    shifts: [{ start: 270, end: 660, corridor: "airport-banani" }], // 4:30–11:00
  },
  {
    id: "bullet", name: "Bullet", driver: "Jashim", plate: "METRO-12-5801", color: "#2563eb",
    shifts: [{ start: 360, end: 720, corridor: "mirpur10-farmgate" }], // 6:00–12:00
  },
  {
    id: "rocket", name: "Rocket", driver: "Kabir", plate: "METRO-14-9317", color: "#9333ea",
    shifts: [{ start: 420, end: 780, corridor: "uttara-farmgate" }], // 7:00–13:00
  },
  {
    id: "bijoy", name: "Bijoy", driver: "Selim", plate: "METRO-45-1108", color: "#d97706",
    shifts: [{ start: 450, end: 690, corridor: "kakrail-mirpur12" }], // 7:30–11:30
  },
  {
    id: "rocky", name: "Rocky", driver: "Rashid", plate: "METRO-23-7756", color: "#059669",
    shifts: [{ start: 540, end: 1020, corridor: "banani-gulshan1" }], // 9:00–17:00
  },
  {
    id: "speed", name: "Speed", driver: "Salma", plate: "METRO-52-3419", color: "#0891b2",
    shifts: [{ start: 660, end: 1080, corridor: "dhanmondi-gulshan2" }], // 11:00–18:00
  },
  {
    id: "jontro", name: "Jontro", driver: "Rakib", plate: "METRO-36-9025", color: "#65a30d",
    shifts: [{ start: 720, end: 960, corridor: "moghbazar-mohakhali" }], // 12:00–16:00
  },
  {
    id: "tornado", name: "Tornado", driver: "Habib", plate: "METRO-18-6623", color: "#ea580c",
    shifts: [{ start: 840, end: 1260, corridor: "asadgate-motijheel" }], // 14:00–21:00
  },
  {
    id: "raja", name: "Raja", driver: "Nasir", plate: "METRO-27-8450", color: "#e11d48",
    shifts: [{ start: 960, end: 1380, corridor: "malibagh-rampura" }], // 16:00–23:00
  },
  {
    id: "duronto", name: "Duronto", driver: "Aminul", plate: "METRO-63-2914", color: "#7c3aed",
    shifts: [{ start: 990, end: 1230, corridor: "gulistan-motijheel" }], // 16:30–20:30
  },
  {
    id: "chalo", name: "Chalo", driver: "Mizan", plate: "METRO-49-5573", color: "#db2777",
    shifts: [{ start: 1200, end: 1560, corridor: "newmarket-motijheel" }], // 20:00–2:00
  },
  {
    id: "tara", name: "Tara", driver: "Ruma", plate: "METRO-58-4027", color: "#0d9488",
    shifts: [{ start: 1350, end: 1710, corridor: "gulistan-sadarghat" }], // 22:30–4:30
  },
];

/** True when `minutes` falls inside the shift (handles past-midnight wrap). */
export function isOnDuty(shift: FleetShift, minutes: number): boolean {
  const m = ((minutes % 1440) + 1440) % 1440;
  if (shift.end <= 1440) return m >= shift.start && m < shift.end;
  return m >= shift.start || m < shift.end - 1440;
}

/** Minutes from `now` until the shift ends (always positive while on duty). */
export function minutesUntilShiftEnd(shift: FleetShift, minutes: number): number {
  const m = ((minutes % 1440) + 1440) % 1440;
  const span = shift.end - shift.start;
  const elapsed = shift.end <= 1440 ? m - shift.start : (m - shift.start + 1440) % 1440;
  return Math.max(0, span - elapsed);
}

export type ActiveAuto = {
  auto: FleetAutoDef;
  shift: FleetShift;
  /** Index into the auto's shift list — part of the map component key so a
   * new shift remounts the engine fresh. */
  shiftIndex: number;
};

/** Which roster autos are on duty at this BD minute, sorted by shift start. */
export function activeFleet(minutes: number): ActiveAuto[] {
  const out: ActiveAuto[] = [];
  for (const auto of FLEET) {
    auto.shifts.forEach((shift, shiftIndex) => {
      if (isOnDuty(shift, minutes)) out.push({ auto, shift, shiftIndex });
    });
  }
  return out.sort((a, b) => a.shift.start - b.shift.start).slice(0, MAX_CONCURRENT_AUTOS);
}

// ---------- Bangladesh clock ----------

export type DhakaClock = {
  /** Minutes-of-day (0–1439). */
  minutes: number;
  /** "HH:MM" in 24h BD time. */
  text: string;
};

const dhakaFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** Bangladesh clock in seconds-of-day (0–86399). */
export function dhakaClockSec(date = new Date()): number {
  const parts = dhakaFormatter.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const second = Number(parts.find((p) => p.type === "second")?.value ?? "0");
  return (hour % 24) * 3600 + minute * 60 + second;
}

/**
 * A moment of BD time plus the wall-clock instant it was read, so renderers
 * can interpolate smoothly between ticks: bdSec + (now − unixMs)/1000.
 */
export type BdClockAnchor = { bdSec: number; unixMs: number };

/** "390" → "06:30"; also wraps past-midnight shift ends (e.g. 1560 → "02:00"). */
export function formatShiftMinute(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

// ---------- lifecycle ----------

export type FleetPhase = "parked" | "waiting" | "carrying";

export const PHASE_LABEL: Record<FleetPhase, string> = {
  parked: "Parked",
  waiting: "Waiting for passengers",
  carrying: "Carrying passengers",
};

/** Live state of one auto, written by the engine and polled for the panel. */
export type FleetLiveStatus = {
  phase: FleetPhase;
  /** 0–1 along the corridor while carrying. */
  progress: number;
  /** The (current or upcoming) trip's endpoints. */
  fromName: string;
  toName: string;
  /** Where the auto sits while waiting/parked. */
  standName: string;
};

// ---------- seeded randomness (stable per auto, varied over time) ----------

export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Resolve a corridor id to its fetched road geometry. */
export function corridorRoute(
  corridorId: string,
  routes: RouteData[],
): RouteData | null {
  return routes.find((r) => r.id === corridorId) ?? null;
}

// ---------- deterministic shift timeline ----------
//
// The whole lifecycle of a shift is a pure function of (auto, shift, BD
// clock): parked pad → waiting → carrying → waiting → … → parked. No wall
// timers or Math.random at render time, so reloading at the same BD second
// resumes the exact same phase and trip progress.

export type FleetSegment =
  | { kind: "parked"; startSec: number; endSec: number; stand: "a" | "b" }
  | {
      kind: "waiting";
      startSec: number;
      endSec: number;
      stand: "a" | "b";
      tripIndex: number;
      dir: 1 | -1;
    }
  | {
      kind: "carrying";
      startSec: number;
      endSec: number;
      stand: "a" | "b";
      tripIndex: number;
      dir: 1 | -1;
    };

export const shiftSpanSec = (shift: FleetShift): number =>
  (shift.end - shift.start) * 60;

/** Seconds since the shift began for a BD seconds-of-day value (wrap-safe). */
export function shiftElapsedSec(shift: FleetShift, bdSec: number): number {
  const span = shiftSpanSec(shift);
  let elapsed = bdSec - shift.start * 60;
  if (elapsed < 0) elapsed += 86400;
  return Math.max(0, Math.min(elapsed, span));
}

/**
 * The full chronological cycle of one shift. Dwell times are seeded per trip
 * and scaled by the time band at that BD moment; trips alternate direction;
 * nothing starts within a minute of the shift end, so every trip completes.
 */
export function buildShiftSegments(
  autoId: string,
  shiftIndex: number,
  shift: FleetShift,
  tripSeconds: number,
): FleetSegment[] {
  const span = shiftSpanSec(shift);
  const rand = mulberry32(hashSeed(`${autoId}:${shiftIndex}:plan`));
  const padSec = 4 + rand() * 5;
  /** No trip may start this close to the shift end. */
  const endGuardSec = 60;

  const segments: FleetSegment[] = [
    { kind: "parked", startSec: 0, endSec: padSec, stand: "a" },
  ];
  let t = padSec;
  let tripIndex = 0;
  for (;;) {
    const remain = span - endGuardSec - t;
    if (remain <= 0) break;
    const dir: 1 | -1 = tripIndex % 2 === 0 ? 1 : -1;
    const stand: "a" | "b" = dir === 1 ? "a" : "b";
    const bdMinAt = (shift.start + Math.floor(t / 60)) % 1440;
    const dwell = Math.min(
      remain,
      (7 + rand() * 9) * timeBand(bdMinAt).dwellScale,
    );
    segments.push({
      kind: "waiting",
      startSec: t,
      endSec: t + dwell,
      stand,
      tripIndex,
      dir,
    });
    t += dwell;
    if (span - endGuardSec - t < tripSeconds) break;
    segments.push({
      kind: "carrying",
      startSec: t,
      endSec: t + tripSeconds,
      stand,
      tripIndex,
      dir,
    });
    t += tripSeconds;
    tripIndex += 1;
  }
  // Park at wherever the last trip ended until duty ends.
  const finalStand: "a" | "b" =
    tripIndex === 0 || (tripIndex - 1) % 2 !== 0 ? "a" : "b";
  const last = segments[segments.length - 1];
  if (last.endSec < span) {
    segments.push({
      kind: "parked",
      startSec: last.endSec,
      endSec: span,
      stand: finalStand,
    });
  }
  return segments;
}

/** The segment covering `elapsedSec` (clamped into the shift). */
export function segmentAt(
  segments: FleetSegment[],
  elapsedSec: number,
): FleetSegment {
  for (const seg of segments) {
    if (elapsedSec < seg.endSec) return seg;
  }
  return segments[segments.length - 1];
}

// ---------- deterministic stop-and-go trip plans ----------

export type TripPlan = {
  /** Traffic pauses as fractions along the trip (0 and 1 excluded). */
  stops: { at: number; pauseSec: number }[];
  /** Trip duration minus all pauses: pure driving time. */
  driveSec: number;
};

/** Seeded stop-and-go plan for one trip — the same trip always pauses at the
 * same spots for the same durations, which is what keeps progress stable. */
export function buildTripPlan(
  autoId: string,
  shiftIndex: number,
  tripIndex: number,
  tripSeconds: number,
  routeKm: number,
): TripPlan {
  const rand = mulberry32(
    hashSeed(`${autoId}:${shiftIndex}:${tripIndex}:trip`),
  );
  const count = Math.max(3, Math.round(routeKm / 0.13));
  const stops: TripPlan["stops"] = [];
  let pauseTotal = 0;
  for (let i = 0; i < count; i += 1) {
    const pauseSec = 0.35 + rand() * 0.75;
    pauseTotal += pauseSec;
    stops.push({ at: (i + 1) / (count + 1), pauseSec });
  }
  return { stops, driveSec: Math.max(1, tripSeconds - pauseTotal) };
}

/** Fraction (0–1) along the trip at `elapsedSec`, pauses included, eased. */
export function tripFractionAt(plan: TripPlan, elapsedSec: number): number {
  const { stops, driveSec } = plan;
  const ease = (local: number) => local * local * (3 - 2 * local);
  let prev = 0;
  let t = 0;
  for (const stop of stops) {
    const segSec = (stop.at - prev) * driveSec;
    if (elapsedSec < t + segSec) {
      return prev + ease((elapsedSec - t) / segSec) * (stop.at - prev);
    }
    t += segSec;
    if (elapsedSec < t + stop.pauseSec) return stop.at;
    t += stop.pauseSec;
    prev = stop.at;
  }
  const finalSec = Math.max(0.0001, (1 - prev) * driveSec);
  if (elapsedSec < t + finalSec) {
    return prev + ease((elapsedSec - t) / finalSec) * (1 - prev);
  }
  return 1;
}

// ---------- stationary (always parked) autos ----------

export type StationaryAutoDef = {
  id: string;
  name: string;
  driver: string;
  plate: string;
  color: string;
  at: { name: string; lng: number; lat: number };
};

/**
 * Autos that never leave their stand: always on the map at a real spot,
 * cycling between waiting and parked phases on a seeded BD-clock schedule
 * (predefined times, reload-stable) but never driving.
 */
export const STATIONARY_AUTOS: StationaryAutoDef[] = [
  {
    id: "stand-gulshan2", name: "Rustom", driver: "Sohel", plate: "METRO-71-6634", color: "#64748b",
    at: { name: "Gulshan 2", lng: 90.41435, lat: 23.794397 },
  },
  {
    id: "stand-azimpur", name: "Shahin", driver: "Polash", plate: "METRO-76-9021", color: "#78716c",
    at: { name: "Azimpur", lng: 90.386019, lat: 23.728536 },
  },
  {
    id: "stand-kamalapur", name: "Jony", driver: "Babul", plate: "METRO-79-1176", color: "#52525b",
    at: { name: "Kamalapur", lng: 90.426466, lat: 23.729251 },
  },
];

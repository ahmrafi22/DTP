/** Bangladesh wall clock helpers — the demo world runs on Dhaka time. */

const bdFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dhaka",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** Bangladesh clock in seconds-of-day (0–86399). */
export function dhakaClockSec(date = new Date()): number {
  const parts = bdFormatter.formatToParts(date);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  const second = Number(parts.find((p) => p.type === "second")?.value ?? "0");
  return (hour % 24) * 3600 + minute * 60 + second;
}

/** Minutes-of-day → "HH:MM". */
export function formatBdMinute(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Rough time-of-day label for the clock chip. */
export function bdTimeBand(min: number): string {
  const m = ((Math.floor(min) % 1440) + 1440) % 1440;
  if (m < 240) return "Late night";
  if (m < 360) return "Early morning";
  if (m < 600) return "Morning rush";
  if (m < 960) return "Midday";
  if (m < 1200) return "Evening rush";
  return "Night";
}

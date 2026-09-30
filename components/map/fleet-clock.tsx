"use client";

import { IoMoonOutline, IoSunnyOutline } from "react-icons/io5";
import { timeBand } from "@/lib/fleet";
import { cn } from "@/lib/utils";

/**
 * The Bangladesh clock in the bottom-left corner.
 *
 * Deliberately just that: the time in 12-hour form and whether it is day or
 * night. The 24-hour shift roster and the on-duty head-count that used to live
 * behind a popover are gone — they were clutter, not something a rider needs
 * to decide where to go.
 */
export function FleetClockChip({ nowMin }: { nowMin: number | null }) {
  const band = nowMin == null ? null : timeBand(nowMin);
  const isNight = band ? band.label.toLowerCase().includes("night") : false;

  return (
    <div className="absolute bottom-4 left-4 z-20 max-md:bottom-24">
      <div
        className="bg-card border-border text-foreground flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-bold shadow-lg"
        aria-label="Bangladesh time"
      >
        <Icon isNight={isNight} />
        <span className="tabular-nums">
          {nowMin == null ? "--:--" : formatTwelveHour(nowMin)}
        </span>
        {band && (
          <span className="text-muted-foreground hidden font-medium sm:inline">
            {band.label}
          </span>
        )}
      </div>
    </div>
  );
}

function Icon({ isNight }: { isNight: boolean }) {
  const cls = cn("size-3.5 shrink-0", isNight ? "text-indigo-400" : "text-amber-500");
  return isNight ? <IoMoonOutline className={cls} /> : <IoSunnyOutline className={cls} />;
}

/**
 * BD minutes-of-day as 12-hour clock time, e.g. 20:41 -> "8:41 PM".
 * Midnight and noon are the two cases a naive `% 12` gets wrong, so both are
 * handled explicitly.
 */
export function formatTwelveHour(minutes: number): string {
  const m = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  const hour24 = Math.floor(m / 60);
  const mins = String(m % 60).padStart(2, "0");
  const suffix = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${mins} ${suffix}`;
}
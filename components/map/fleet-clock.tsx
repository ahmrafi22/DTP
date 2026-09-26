"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { IoClose, IoTime } from "react-icons/io5";
import {
  FLEET,
  MAX_CONCURRENT_AUTOS,
  formatShiftMinute,
  isOnDuty,
  timeBand,
} from "@/lib/fleet";
import type { RouteData } from "@/lib/route";
import { cn } from "@/lib/utils";

/**
 * Bottom-left chip showing the Bangladesh clock that drives the fleet, with
 * a popover listing the full 24h roster (who works which corridor when) and
 * a preview slider to demo any time of day without waiting for it.
 */
export function FleetClockChip({
  nowMin,
  previewActive,
  routes,
  onPreview,
  onLive,
}: {
  /** Effective BD minutes-of-day (live clock or preview override). */
  nowMin: number | null;
  previewActive: boolean;
  routes: RouteData[];
  onPreview: (minutes: number) => void;
  onLive: () => void;
}) {
  const [open, setOpen] = useState(false);
  const band = nowMin == null ? null : timeBand(nowMin);
  const corridorNames = new Map(routes.map((r) => [r.id, r.name]));
  const onDutyCount =
    nowMin == null
      ? 0
      : FLEET.filter((auto) => auto.shifts.some((s) => isOnDuty(s, nowMin)))
          .length;
  const roster = [...FLEET].sort(
    (a, b) => a.shifts[0].start - b.shifts[0].start,
  );

  return (
    <div className="absolute bottom-4 left-4 z-20 max-md:bottom-24">
      <AnimatePresence>
        {open && (
          <motion.div
            key="fleet-popover"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="bg-card border-border absolute bottom-full left-0 mb-2 w-[300px] max-w-[calc(100vw-2rem)] rounded-2xl border p-3 shadow-xl"
          >
            <div className="flex items-center justify-between pb-1.5">
              <p className="text-foreground text-xs font-black">
                Fleet schedule
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close schedule"
                className="hover:bg-muted active:scale-[0.94] flex size-6 items-center justify-center rounded-lg transition-all"
              >
                <IoClose className="size-3.5" />
              </button>
            </div>
            <p className="text-muted-foreground pb-2 text-[10px] font-medium">
              Dhaka time decides who drives when — max{" "}
              {MAX_CONCURRENT_AUTOS} autos on the map at once.
            </p>

            <ul className="max-h-60 space-y-0.5 overflow-y-auto pr-0.5">
              {roster.map((auto) =>
                auto.shifts.map((shift, i) => {
                  const onDuty = nowMin != null && isOnDuty(shift, nowMin);
                  return (
                    <li
                      key={`${auto.id}-${i}`}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-2 py-1.5",
                        onDuty && "bg-muted",
                      )}
                    >
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: auto.color }}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-foreground truncate text-[11px] font-bold">
                          {auto.name}
                          <span className="text-muted-foreground font-medium">
                            {" "}
                            · {auto.driver}
                          </span>
                        </p>
                        <p className="text-muted-foreground truncate text-[10px]">
                          {corridorNames.get(shift.corridor) ?? shift.corridor}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-muted-foreground text-[10px] font-semibold tabular-nums">
                          {formatShiftMinute(shift.start)}–
                          {formatShiftMinute(shift.end)}
                        </p>
                        {onDuty && (
                          <p className="text-primary text-[9px] font-black tracking-wide uppercase">
                            On duty
                          </p>
                        )}
                      </div>
                    </li>
                  );
                }),
              )}
            </ul>

            <div className="border-border mt-2 border-t pt-2">
              <div className="flex items-center justify-between pb-1">
                <p className="text-muted-foreground text-[10px] font-bold tracking-wide uppercase">
                  Preview the day
                </p>
                {previewActive && (
                  <button
                    type="button"
                    onClick={onLive}
                    className="text-primary active:scale-[0.97] text-[10px] font-bold transition-transform"
                  >
                    Back to live
                  </button>
                )}
              </div>
              <input
                type="range"
                min={0}
                max={1439}
                step={10}
                value={nowMin ?? 0}
                onChange={(e) => onPreview(Number(e.target.value))}
                aria-label="Preview the fleet at a different time of day"
                className="accent-primary w-full"
              />
              <div className="text-muted-foreground flex justify-between text-[9px] font-semibold tabular-nums">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>23:50</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Fleet schedule and Bangladesh time"
        className="bg-card border-border text-foreground active:scale-[0.98] flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-bold shadow-lg transition-all"
      >
        <IoTime className="text-primary size-3.5 shrink-0" />
        <span className="tabular-nums">
          {nowMin == null ? "--:--" : formatShiftMinute(nowMin)}
        </span>
        {band && (
          <span className="text-muted-foreground hidden font-medium sm:inline">
            {band.label}
          </span>
        )}
        <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums">
          {onDutyCount}/{MAX_CONCURRENT_AUTOS}
        </span>
        {previewActive && (
          <span className="bg-amber-500/15 text-amber-600 rounded-full px-1.5 py-0.5 text-[10px] font-black">
            Preview
          </span>
        )}
      </button>
    </div>
  );
}

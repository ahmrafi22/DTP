"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { IoClose, IoTime } from "react-icons/io5";
import { NODES, formatTaka } from "@/lib/network";
import { bdTimeBand, formatBdMinute } from "@/lib/bd-clock";
import type { MapLivePayload } from "@/lib/api";
import { cn } from "@/lib/utils";

/**
 * Bottom-left chip: the Dhaka clock the demo world runs on, plus a popover
 * listing the real fleet straight from GET /map/live — who is online, who is
 * carrying riders, where the free seats are.
 */
export function FleetClockChip({
  nowMin,
  live,
}: {
  nowMin: number | null;
  live: MapLivePayload | null;
}) {
  const [open, setOpen] = useState(false);
  const online = live?.drivers.filter((d) => d.online) ?? [];
  const onboard = online.filter((d) => d.phase === "onboard");
  const freeSeats = online.reduce((sum, d) => sum + (d.capacity - d.seatsTaken), 0);

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
            className="bg-card border-border absolute bottom-full left-0 mb-2 max-h-[60vh] w-[300px] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border p-3 shadow-xl"
          >
            <div className="flex items-center justify-between pb-1.5">
              <p className="text-foreground text-xs font-black">Live fleet</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close fleet list"
                className="hover:bg-muted active:scale-[0.94] flex size-6 items-center justify-center rounded-lg transition-all"
              >
                <IoClose className="size-3.5" />
              </button>
            </div>
            <p className="text-muted-foreground pb-2 text-[10px] font-medium">
              Tap an auto on the map to see who is aboard — fares stay private.
            </p>

            <ul className="space-y-0.5">
              {(live?.drivers ?? []).map((d) => (
                <li
                  key={d.driverId}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-1.5",
                    d.online && "bg-muted/60",
                  )}
                >
                  <span
                    className={cn(
                      "size-2.5 shrink-0 rounded-full",
                      d.phase === "onboard" && "animate-pulse bg-blue-500",
                      d.phase === "waiting" && "animate-pulse bg-amber-500",
                      d.phase === "offline" && "bg-zinc-400",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate text-[11px] font-bold">
                      {d.vehicleName}
                      <span className="text-muted-foreground font-medium"> · {d.driverName}</span>
                    </p>
                    <p className="text-muted-foreground truncate text-[10px]">
                      {d.phase === "onboard" && d.ride
                        ? `On the trip · ${d.ride.passengers.map((p) => p.firstName).join(", ") || "riding"}`
                        : d.phase === "waiting"
                          ? `Waiting at ${d.baseStopId ? NODES[d.baseStopId]?.name : "the stand"}`
                          : "Offline"}
                    </p>
                  </div>
                  <span className="text-muted-foreground shrink-0 text-[10px] font-bold tabular-nums">
                    {d.seatsTaken}/{d.capacity}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="Dhaka time and live fleet"
        className="bg-card border-border text-foreground active:scale-[0.98] flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-bold shadow-lg transition-all"
      >
        <IoTime className="text-primary size-3.5 shrink-0" />
        <span className="tabular-nums">{nowMin == null ? "--:--" : formatBdMinute(nowMin)}</span>
        <span className="text-muted-foreground hidden font-medium sm:inline">
          {nowMin == null ? "" : bdTimeBand(nowMin)}
        </span>
        <span className="bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 text-[10px] font-black tabular-nums">
          {freeSeats} seats · {onboard.length} riding
        </span>
      </button>
    </div>
  );
}

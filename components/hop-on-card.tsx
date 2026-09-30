"use client";

import { useState } from "react";
import { IoSwapVertical } from "react-icons/io5";
import { useStore } from "@/components/store";
import { WAIT_SAVE_DISCOUNT_PCT, WAIT_SAVE_MINUTES } from "@/lib/api";
import { stopName } from "@/lib/stops";
import { cn } from "@/lib/utils";

/**
 * "Get on this Tesla" — the passenger half of pooling.
 *
 * Every other rider's open trip is listed here. Picking one lets you board at
 * any stop the auto has not reached yet, which is the whole point: Nusrat's
 * ride should not be Rafiq's loss just because it started first.
 */
export function HopOnCard() {
  const { openRides, hopOn, busy, error, persona, vehicle } = useStore();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [boardAt, setBoardAt] = useState<string | null>(null);
  const [leaveAt, setLeaveAt] = useState<string | null>(null);
  const [waitAndSave, setWaitAndSave] = useState(false);

  // Nobody hops into their own trip, and drivers do not use this panel at all.
  if (persona?.role !== "passenger" || vehicle) return null;
  if (openRides.length === 0) return null;

  const reset = () => {
    setBoardAt(null);
    setLeaveAt(null);
    setWaitAndSave(false);
  };

  return (
    <section className="bg-card border-border rounded-2xl border p-3 shadow-sm">
      <p className="text-muted-foreground flex items-center gap-1.5 pb-2 text-[10px] font-bold tracking-wide uppercase">
        <IoSwapVertical className="size-3.5" />
        Rides you can still get on
      </p>

      <ul className="space-y-1.5">
        {openRides.map((r) => {
          const isOpen = expanded === r.rideId;
          const stopsAhead = r.aheadStopIds;
          const boardable = isOpen && boardAt && leaveAt && leaveAt !== boardAt;

          return (
            <li key={r.rideId} className="border-border rounded-xl border">
              <button
                type="button"
                onClick={() => {
                  setExpanded(isOpen ? null : r.rideId);
                  reset();
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-xl p-2.5 text-left transition-colors",
                  isOpen ? "bg-secondary/60" : "hover:bg-secondary/40",
                )}
              >
                <img
                  src="/auto.png"
                  alt=""
                  draggable={false}
                  className="h-7 w-auto shrink-0 select-none drop-shadow"
                  style={{ transform: "scaleX(-1)" }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-foreground truncate text-xs font-bold">
                    {r.vehicleName} · {r.driverName}
                  </p>
                  <p className="text-muted-foreground truncate text-[10px]">
                    {r.routeStopIds.map(stopName).join(" → ")}
                  </p>
                </div>
                <span className="bg-secondary text-secondary-foreground shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold">
                  {r.seatsFree} free
                </span>
              </button>

              {isOpen && (
                <div className="border-border space-y-2.5 border-t p-2.5">
                  <p className="text-muted-foreground text-[11px]">
                    Pick where you get on — stops the auto has not reached yet.
                  </p>

                  <StopChoice
                    label="Get on at"
                    stops={stopsAhead}
                    value={boardAt}
                    onChange={setBoardAt}
                  />

                  <StopChoice
                    label="Get off at"
                    stops={
                      boardAt
                        ? stopsAhead.slice(stopsAhead.indexOf(boardAt) + 1)
                        : stopsAhead
                    }
                    value={leaveAt}
                    onChange={setLeaveAt}
                    disabled={!boardAt}
                  />

                  {/* Wait and Save: same extra discount, promise to wait. */}
                  <button
                    type="button"
                    onClick={() => setWaitAndSave((v) => !v)}
                    aria-pressed={waitAndSave}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-left transition-colors",
                      waitAndSave
                        ? "border-primary bg-secondary/60"
                        : "border-border hover:bg-muted",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="text-foreground block text-[11px] font-bold">
                        Wait &amp; save {WAIT_SAVE_DISCOUNT_PCT}%
                      </span>
                      <span className="text-muted-foreground block text-[10px]">
                        Wait up to {WAIT_SAVE_MINUTES} min at pickup
                      </span>
                    </span>
                    <span
                      className={cn(
                        "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                        waitAndSave ? "bg-primary" : "bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 size-4 rounded-full bg-white transition-all",
                          waitAndSave ? "left-[18px]" : "left-0.5",
                        )}
                      />
                    </span>
                  </button>

                  {error && (
                    <p
                      role="alert"
                      className="rounded-lg bg-destructive/10 px-2 py-1.5 text-[11px] font-semibold text-destructive"
                    >
                      {error}
                    </p>
                  )}

                  <button
                    type="button"
                    disabled={!boardable || busy}
                    onClick={() => {
                      if (!boardAt || !leaveAt) return;
                      void hopOn(r.rideId, boardAt, leaveAt, waitAndSave)
                        .then(() => setExpanded(null))
                        .catch(() => {
                          // Already shown via the store's `error` banner.
                        });
                      reset();
                    }}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-xl py-2.5 text-xs font-bold transition-all disabled:pointer-events-none disabled:opacity-50"
                  >
                    {busy ? "Getting on…" : "Get on this Tesla"}
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function StopChoice({
  label,
  stops,
  value,
  onChange,
  disabled,
}: {
  label: string;
  stops: readonly string[];
  value: string | null;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="text-muted-foreground pb-1 text-[10px] font-bold tracking-wide uppercase">
        {label}
      </p>
      <div className="flex flex-wrap gap-1">
        {stops.map((id) => (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(id)}
            aria-pressed={value === id}
            className={cn(
              "rounded-lg px-2 py-1 text-[11px] font-semibold transition-all disabled:opacity-40",
              value === id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-secondary",
            )}
          >
            {stopName(id)}
          </button>
        ))}
        {stops.length === 0 && (
          <span className="text-muted-foreground text-[11px]">No stops left on this trip</span>
        )}
      </div>
    </div>
  );
}
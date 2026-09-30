"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { MarkerContent, RouteMarker } from "@/components/ui/map";
import { TripRoute } from "@/components/map/trip-route";
import { useStore } from "@/components/store";
import { useTripProgress } from "@/lib/trip-progress";
import { stopName } from "@/lib/stops";
import type { ApiOpenRide } from "@/lib/api";
import { cn } from "@/lib/utils";

// The auto sprites are plain <img>, not next/image: MapLibre positions
// the marker wrapper every frame, and an optimized image wrapper
// interferes with that per-frame transform.

/**
 * Other people's rides, drawn on the map itself — not only in the sidebar.
 *
 * Each open trip gets its route line and a clickable auto sprite riding it.
 * The sprite animates on the same 90-second budget as the viewer's own trip
 * (the PRD demo compression), so a Tesla already on the road visibly moves past
 * the stops a new passenger could still board at.
 */
export function OpenRideMarkers() {
  const { openRides, selectedOpenRideId, selectOpenRide, persona, vehicle } = useStore();

  // Drivers run their own trips; a passenger already riding has the panel.
  if (persona?.role !== "passenger" || vehicle) return null;
  if (openRides.length === 0) return null;

  return (
    <>
      {openRides.map((ride) => (
        <OpenRideAuto
          key={ride.rideId}
          ride={ride}
          selected={selectedOpenRideId === ride.rideId}
          onSelect={() =>
            selectOpenRide(selectedOpenRideId === ride.rideId ? null : ride.rideId)
          }
        />
      ))}
    </>
  );
}

function OpenRideAuto({
  ride,
  selected,
  onSelect,
}: {
  ride: ApiOpenRide;
  selected: boolean;
  onSelect: () => void;
}) {
  // A hook per ride, so each animates against its own start time.
  const progress = useTripProgress(ride.status === "STARTED", ride.startedAt);

  return (
    <TripRoute
      id={`open-${ride.rideId}`}
      stopIds={ride.routeStopIds}
      riders={[]}
      progress={progress}
    >
      <RouteMarker at="progress">
        <MarkerContent>
          <button
            type="button"
            onClick={onSelect}
            aria-label={`${ride.vehicleName} driven by ${ride.driverName}, ${ride.seatsFree} seat${ride.seatsFree === 1 ? "" : "s"} free`}
            className="relative block cursor-pointer"
          >
            {/* The ring is the "you can board this" affordance. */}
            <span
              className={cn(
                "absolute -inset-1.5 rounded-full transition-all",
                selected ? "bg-emerald-400/50 ring-2 ring-emerald-500" : "bg-emerald-400/25",
              )}
            />
            <img
              src="/auto.png"
              alt=""
              draggable={false}
              className="relative h-9 w-auto max-w-none select-none drop-shadow-[0_3px_5px_rgba(0,0,0,0.4)]"
              // Sprite art faces left; routes generally head east.
              style={{ transform: selected ? "scaleX(-1) scale(1.12)" : "scaleX(-1)" }}
            />
          </button>
        </MarkerContent>
      </RouteMarker>
    </TripRoute>
  );
}

/**
 * Detail card for the auto the user tapped. Rendered as a map overlay by the
 * workspace, so it sits beside the map rather than inside its layers.
 */
export function OpenRideDetail() {
  const { openRides, selectedOpenRideId } = useStore();
  const ride = openRides.find((r) => r.rideId === selectedOpenRideId);
  if (!ride) return null;
  return <OpenRideCard ride={ride} />;
}

export function OpenRideCard({ ride }: { ride: ApiOpenRide }) {
  const { hopOn, selectOpenRide, busy, error } = useStore();
  const [boardAt, setBoardAt] = useState<string | null>(null);
  const [leaveAt, setLeaveAt] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "WALLET">("CASH");

  const ahead = ride.aheadStopIds;
  const canGo = Boolean(boardAt && leaveAt && leaveAt !== boardAt);
  const dropOptions = boardAt ? ahead.slice(ahead.indexOf(boardAt) + 1) : [];

  return (
    <motion.aside
      key={ride.rideId}
      role="dialog"
      aria-label={`${ride.vehicleName} trip details`}
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      transition={{ type: "spring", bounce: 0.1, duration: 0.35 }}
      className="bg-card border-border absolute top-20 bottom-4 left-4 z-30 hidden w-[320px] overflow-y-auto rounded-2xl border p-4 shadow-lg md:block"
    >
      <div className="flex items-center gap-2.5 pb-2">
        <img
          src="/auto.png"
          alt=""
          draggable={false}
          className="h-8 w-auto shrink-0 select-none drop-shadow"
          style={{ transform: "scaleX(-1)" }}
        />
        <div className="min-w-0 flex-1">
          <p className="text-foreground text-sm font-bold">
            {ride.vehicleName} · {ride.driverName}
          </p>
          <p className="text-muted-foreground text-[11px]">
            {ride.status} · {ride.seatsFree} of {ride.capacity} seats free
          </p>
        </div>
        <button
          type="button"
          onClick={() => selectOpenRide(null)}
          aria-label="Close"
          className="text-muted-foreground hover:text-foreground text-xs font-bold"
        >
          ✕
        </button>
      </div>

      {/* Who is riding — first name and destination only (PRD §5). */}
      {ride.riders.length > 0 && (
        <div className="border-border rounded-xl border p-2.5">
          <p className="text-muted-foreground pb-1 text-[10px] font-bold tracking-wide uppercase">
            On board
          </p>
          <ul className="space-y-1">
            {ride.riders.map((r, i) => (
              <li key={`${r.firstName}-${i}`} className="text-xs">
                <span className="text-foreground font-semibold">{r.firstName}</span>
                <span className="text-muted-foreground"> → {stopName(r.dropStopId)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="pt-2.5">
        <p className="text-muted-foreground pb-1 text-[10px] font-bold tracking-wide uppercase">
          Route
        </p>
        <p className="text-foreground text-[11px] leading-relaxed">
          {ride.routeStopIds.map(stopName).join(" → ")}
        </p>
      </div>

      <StopPicker
        label="Get on at"
        stops={ahead}
        value={boardAt}
        onChange={(id) => {
          setBoardAt(id);
          setLeaveAt(null);
        }}
      />
      <StopPicker
        label="Get off at"
        stops={dropOptions}
        value={leaveAt}
        onChange={setLeaveAt}
        emptyHint={boardAt ? "This is the last stop on the trip" : "Pick a boarding stop first"}
      />

      {/* A joining rider has no wait-and-save promise to make — the car is already
          out — so the only choice is how to pay. */}
      <div className="border-border bg-card mt-2.5 flex rounded-xl border p-1">
        {(["CASH", "WALLET"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setPaymentMethod(m)}
            aria-pressed={paymentMethod === m}
            className={cn(
              "flex-1 rounded-lg py-2 text-[11px] font-bold transition-all",
              paymentMethod === m
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {m === "CASH" ? "Cash" : "TeslaCash"}
          </button>
        ))}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-2 rounded-lg bg-destructive/10 px-2 py-1.5 text-[11px] font-semibold text-destructive"
        >
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={!canGo || busy}
        onClick={() => {
          if (!boardAt || !leaveAt) return;
          // `hopOn` surfaces its own failure through the store's `error`;
          // swallow here so it never becomes an unhandled rejection.
          void hopOn(ride.rideId, boardAt, leaveAt, paymentMethod).catch(() => {});
        }}
        className="bg-primary text-primary-foreground hover:bg-primary/90 mt-3 w-full rounded-xl py-2.5 text-xs font-bold transition-all disabled:pointer-events-none disabled:opacity-50"
      >
        {busy ? "Getting on…" : "Get on this Tesla"}
      </button>
    </motion.aside>
  );
}

function StopPicker({
  label,
  stops,
  value,
  onChange,
  emptyHint,
}: {
  label: string;
  stops: readonly string[];
  value: string | null;
  onChange: (id: string) => void;
  emptyHint?: string;
}) {
  return (
    <div className="pt-2.5">
      <p className="text-muted-foreground pb-1 text-[10px] font-bold tracking-wide uppercase">
        {label}
      </p>
      <div className="flex flex-wrap gap-1">
        {stops.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-pressed={value === id}
            className={cn(
              "rounded-lg px-2 py-1 text-[11px] font-semibold transition-all",
              value === id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-secondary",
            )}
          >
            {stopName(id)}
          </button>
        ))}
        {stops.length === 0 && (
          <span className="text-muted-foreground text-[11px]">{emptyHint ?? "No stops left"}</span>
        )}
      </div>
    </div>
  );
}
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { IoArrowForward, IoClose, IoSwapVertical } from "react-icons/io5";
import { NODES, formatTaka } from "@/lib/network";
import {
  fetchJoinPreview,
  joinRideByStops,
  type Fare,
  type MapLiveDriver,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const SPRING = { type: "spring" as const, bounce: 0.2, duration: 0.4 };

/**
 * The hop-on flow: pick where to get in and where to get out along the
 * running trip, watch your fare settle live (polled every 2.5s — it drops as
 * legs fill with riders), then claim the seat. The fare shown is the
 * joiner's own; nobody else's pricing is ever displayed.
 */
export function JoinRideSheet({
  driver,
  onClose,
  onJoined,
}: {
  driver: MapLiveDriver;
  onClose: () => void;
  onJoined: () => void;
}) {
  const ride = driver.ride;
  const stops = ride?.stopIds ?? [];

  // Reachable get-in stops: ahead of the auto's current position.
  const minGetIn = useMemo(
    () => Math.floor((ride?.progress ?? 0) * Math.max(stops.length - 1, 0)),
    [ride?.progress, stops.length],
  );

  const [getIn, setGetIn] = useState<string | null>(null);
  const [getOut, setGetOut] = useState<string | null>(null);
  const [fare, setFare] = useState<Fare | null>(null);
  const [seatsFree, setSeatsFree] = useState<number | null>(null);
  const [pricing, setPricing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyRef = useRef(`join-${Math.random().toString(36).slice(2)}-${Date.now()}`);

  // Sensible defaults: hop in at the first reachable stop, ride to the end.
  useEffect(() => {
    if (stops.length === 0) return;
    setGetIn((cur) => cur ?? stops[minGetIn] ?? stops[0] ?? null);
    setGetOut((cur) => cur ?? stops[stops.length - 1] ?? null);
  }, [stops, minGetIn]);

  const valid = Boolean(getIn && getOut && stops.indexOf(getIn) < stops.indexOf(getOut));

  // Live pricing: re-polled while the sheet is open so the number stays true
  // even when someone else claims a seat (or joins) mid-preview.
  useEffect(() => {
    if (!ride || !valid || !getIn || !getOut) {
      setFare(null);
      return;
    }
    let cancelled = false;
    const load = () => {
      fetchJoinPreview(ride.id, { pickupStopId: getIn, dropStopId: getOut })
        .then((res) => {
          if (cancelled) return;
          setFare(res.fare);
          setSeatsFree(res.seatsFree);
          setPricing(false);
        })
        .catch(() => {
          if (!cancelled) setPricing(false);
        });
    };
    setPricing(true);
    load();
    const timer = window.setInterval(load, 2500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [ride, getIn, getOut, valid]);

  const confirm = async () => {
    if (!ride || !getIn || !getOut) return;
    setConfirming(true);
    setError(null);
    try {
      await joinRideByStops(ride.id, {
        pickupStopId: getIn,
        dropStopId: getOut,
        idempotencyKey: keyRef.current,
      });
      onJoined();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join — try again.");
      setConfirming(false);
    }
  };

  if (!ride) return null;
  const getInOptions = stops.slice(minGetIn, stops.length - 1);
  const getOutOptions = stops.slice(stops.indexOf(getIn ?? stops[0]) + 1);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-foreground text-sm font-bold tracking-tight">
          Hop in
          <span className="text-muted-foreground font-medium"> · {driver.vehicleName}</span>
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="hover:bg-muted active:scale-[0.94] flex size-7 items-center justify-center rounded-lg transition-all"
        >
          <IoClose className="size-4" />
        </button>
      </div>

      {/* Where the auto is on its path */}
      <div className="border-border rounded-xl border p-3">
        <div className="flex items-center justify-between pb-1">
          <p className="text-muted-foreground text-[10px] font-bold tracking-wide uppercase">
            {driver.driverName}&apos;s route
          </p>
          <span className="bg-secondary text-secondary-foreground rounded-full px-2 py-0.5 text-[10px] font-bold">
            {driver.seatsTaken}/{driver.capacity} seats
          </span>
        </div>

        <StopSelect
          label="Get in at"
          value={getIn}
          options={getInOptions}
          onChange={(id) => {
            setGetIn(id);
            // Keep get-out strictly after get-in.
            setGetOut((cur) => (cur && id && stops.indexOf(cur) > stops.indexOf(id) ? null : cur));
          }}
          accent="bg-primary"
        />
        <div className="border-border mx-4 h-3 border-l-2 border-dashed" />
        <StopSelect
          label="Get out at"
          value={getOut}
          options={getOutOptions}
          onChange={setGetOut}
          accent="bg-ink"
        />

        {!valid && (
          <p className="text-muted-foreground pt-2 text-[11px]">
            Pick a get-out stop after your get-in stop.
          </p>
        )}
      </div>

      {/* Live personal fare */}
      <div className="border-primary bg-secondary rounded-xl border p-3">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-xs font-semibold">
            {pricing && !fare ? "Checking the fare…" : "Your fare, live"}
          </p>
          {fare && seatsFree !== null && (
            <span className="text-muted-foreground text-[10px] font-bold tabular-nums">
              {seatsFree} seat{seatsFree === 1 ? "" : "s"} left
            </span>
          )}
        </div>
        {fare ? (
          <>
            <div className="pt-1">
              <p className="text-muted-foreground text-[11px] leading-snug">
                {fare.lines.reduce((s, l) => s + l.riders, 0) > fare.lines.length
                  ? "Shared legs already — your discount is in."
                  : "Solo right now — new riders drop it further."}
              </p>
              <motion.p
                key={fare.total}
                initial={{ scale: 1.06, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-foreground pt-0.5 text-xl font-black tracking-tight"
              >
                {formatTaka(fare.total)}
              </motion.p>
            </div>
            {fare.poolDiscount > 0 && (
              <p className="text-foreground pt-0.5 text-[11px] font-semibold">
                Pool discount applied: −{formatTaka(fare.poolDiscount)}
              </p>
            )}
            <div className="border-border mt-2 space-y-1 border-t pt-2">
              {fare.lines.map((line) => (
                <div key={line.edgeId} className="text-muted-foreground flex justify-between text-[11px]">
                  <span className="truncate">
                    {NODES[line.from]?.name ?? line.from} → {NODES[line.to]?.name ?? line.to}
                    {line.riders > 1 && (
                      <span className="text-foreground font-semibold">
                        {" "}· {line.riders} riders −{line.discountPct}%
                      </span>
                    )}
                  </span>
                  <span className="text-foreground shrink-0 font-semibold">
                    {formatTaka(line.paidPaisa)}
                  </span>
                </div>
              ))}
              <div className="text-muted-foreground flex justify-between border-t pt-1 text-[11px]">
                <span>Base fare</span>
                <span className="text-foreground font-semibold">{formatTaka(fare.baseFare)}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-1.5 pt-1">
            <div className="bg-muted h-4 w-24 animate-pulse rounded" />
            <div className="bg-muted h-3 w-full animate-pulse rounded" />
          </div>
        )}
      </div>

      {error && (
        <p className="text-destructive bg-destructive/10 rounded-lg px-3 py-2 text-center text-xs font-semibold">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={!valid || confirming || !fare}
        onClick={() => void confirm()}
        className="bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold shadow-sm transition-all disabled:opacity-60"
      >
        {confirming ? "Joining…" : "Claim this seat"} <IoArrowForward className="size-4" />
      </button>
      <p className="text-muted-foreground text-center text-[11px] leading-relaxed">
        You board at {getIn ? NODES[getIn]?.name : "—"} and pay only the legs you ride.
      </p>
    </div>
  );
}

/** Compact native select for picking a stop — mobile-friendly, keyboard-safe. */
function StopSelect({
  label,
  value,
  options,
  onChange,
  accent,
}: {
  label: string;
  value: string | null;
  options: string[];
  onChange: (id: string) => void;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-2 py-2">
      <span className={cn("size-2.5 shrink-0 rounded-full", accent)} />
      <label className="text-muted-foreground w-16 shrink-0 text-[11px] font-bold tracking-wide uppercase">
        {label}
      </label>
      <div className="border-border bg-card focus-within:border-primary flex-1 rounded-lg border px-2.5 py-1.5">
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="text-foreground w-full bg-transparent text-sm font-semibold outline-none"
        >
          {!value && <option value="">Pick a stop…</option>}
          {options.map((id) => (
            <option key={id} value={id}>
              {NODES[id]?.name ?? id}
            </option>
          ))}
        </select>
      </div>
      <IoSwapVertical className="text-muted-foreground size-3.5 shrink-0" />
    </div>
  );
}

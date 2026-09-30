"use client";

import { useEffect, useState } from "react";
import { serverNow } from "./server-clock";

/**
 * Trip progress for the live ride drawn on the map.
 *
 * The demo compresses every trip into the same wall-clock budget so a reviewer
 * can watch a full journey without waiting out real traffic: any route, short
 * or long, completes in 90 seconds. Progress is therefore a pure function of
 * elapsed time, not of distance — a two-leg hop and a cross-city run both take
 * the same time, which is a demo choice and not a routing model.
 */

/** Every ongoing trip finishes within 1.5 minutes. */
export const TRIP_DURATION_MS = 90_000;

/** Refresh rate for the progress value while the trip is running. */
const TICK_MS = 100;

/** Clamp `n` into the unit interval. */
const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n);

/**
 * Fraction of the route covered, 0 → 1.
 *
 * Returns 0 until the trip reaches STARTED, then ticks until 1. `startedAt`
 * must be the ride's *immutable* STARTED instant (`rides.started_at`), never
 * `updated_at`: the latter moves on every later transition, so anchoring to it
 * makes two browsers disagree and rewinds the auto when a rider is dropped off.
 * Elapsed time comes from `serverNow()` so every session counts from the same
 * clock and the auto sits in the same place in all of them.
 */
export function useTripProgress(
  running: boolean,
  startedAt: string | null | undefined,
): number {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!running || !startedAt) {
      setProgress(0);
      return;
    }

    const start = new Date(startedAt).getTime();
    if (!Number.isFinite(start)) {
      setProgress(0);
      return;
    }

    // A stale STARTED (e.g. the tab was reopened much later) shows the trip
    // finished rather than snapping it back to the start.
    const tick = () => setProgress(clamp01((serverNow() - start) / TRIP_DURATION_MS));

    tick();
    const timer = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(timer);
  }, [running, startedAt]);

  return progress;
}
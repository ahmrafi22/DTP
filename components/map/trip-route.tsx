"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MapMarker,
  MapRoute,
  MarkerContent,
  RouteMarker,
  RouteProgress,
} from "@/components/ui/map";
import { NODES } from "@/lib/network";

export type RiderPin = {
  /** Unique rider key. */
  id: string;
  pickup: [number, number];
  drop: [number, number];
};

/** Upcoming road: present but recessive. */
const UPCOMING_COLOR = "#86efac";
const UPCOMING_OPACITY = 0.45;
/** Road already covered — the bright, saturated fill. */
const TRAVELED_COLOR = "#15803d";

const coordOf = (stopId: string): [number, number] => [
  NODES[stopId].lng,
  NODES[stopId].lat,
];

/**
 * Route geometry cache, shared by every tab in the browser.
 *
 * This was a plain in-memory Map, which meant two windows could disagree about
 * where the auto is: whichever fetched OSRM first got real road geometry,
 * while a window that opened later and hit the rate limit fell back to a
 * straight line between the stops — a visibly different path, and therefore a
 * visibly different position for the same ride. Persisting to localStorage
 * means the first window's result is reused by all the others.
 *
 * Only *successful* geometry is cached. An earlier version also cached
 * failures as a `null`, which meant one timeout or one 429 from the shared
 * public OSRM server pinned that route to straight lines for the full day —
 * across reloads and restarts — even though the service was reachable again
 * seconds later. Because every window reads this cache, a single unlucky fetch
 * degraded the whole fleet's routes. Failures are now simply retried, and any
 * `null` left behind by an older build is ignored on read so a poisoned cache
 * heals itself instead of needing a manual clear.
 *
 * The map is effectively static, so successful entries are kept for a day.
 */
const GEOMETRY_CACHE_KEY = "dtp-route-geometry";
const GEOMETRY_TTL_MS = 24 * 60 * 60 * 1000;

/** Per-attempt cap. Generous, because the public OSRM demo server is slow. */
const GEOMETRY_TIMEOUT_MS = 12_000;

/** Attempts before settling for the dashed skeleton for this mount. */
const GEOMETRY_MAX_ATTEMPTS = 3;

/** Backoff between attempts; linear, so recovery starts almost immediately. */
const GEOMETRY_RETRY_MS = 1_500;

type GeometryMap = Record<string, { coords: [number, number][] | null; at: number }>;

function readSharedCache(): GeometryMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(GEOMETRY_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as GeometryMap;
    const cutoff = Date.now() - GEOMETRY_TTL_MS;
    return Object.fromEntries(
      // `coords: null` is a cached failure from an older build. Dropping it
      // here is what lets an already-poisoned cache recover on its own.
      Object.entries(parsed).filter(
        ([, v]) => v && v.coords !== null && v.at > cutoff,
      ),
    );
  } catch {
    return {};
  }
}

function writeSharedCache(next: GeometryMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GEOMETRY_CACHE_KEY, JSON.stringify(next));
  } catch {
    // Quota or private mode: the in-memory copy below still works for this tab.
  }
}

// In-memory mirror so repeated reads in one tab stay cheap.
let geometryCache = new Map<string, [number, number][] | null>(
  Object.entries(readSharedCache()).map(([k, v]) => [k, v.coords]),
);

/**
 * Store geometry that is known good.
 *
 * Deliberately typed to reject `null`: caching a failure is what turned a
 * transient OSRM error into straight-line routes for a whole day, and there is
 * no reason for any caller to be able to do that again.
 */
function cacheGeometry(key: string, coords: [number, number][]): void {
  geometryCache.set(key, coords);
  const now = Date.now();
  const next: GeometryMap = {};
  for (const [k, value] of geometryCache) next[k] = { coords: value, at: now };
  writeSharedCache(next);
}

/**
 * The active ride (or driver trip) drawn over the demo fleet: a path that
 * follows real roads (OSRM), with pickup/drop pins for every rider. While the
 * geometry is loading — or offline — a dashed straight-line skeleton between
 * the stops is shown instead.
 *
 * Once the trip is running, `progress` (0 → 1) drives two things at once: the
 * road ahead is drawn pale and the road behind is filled bright, and the auto
 * marker rides the boundary between them.
 */
export function TripRoute({
  id,
  stopIds,
  dashed = false,
  riders,
  progress = 0,
  children,
}: {
  id: string;
  /** Ordered stop ids (travel order) of the primary rider. */
  stopIds: string[];
  /** Dashed while the ride is still just a REQUESTED preview. */
  dashed?: boolean;
  riders: RiderPin[];
  /** Fraction of the route covered, 0 → 1. 0 means "not moving yet". */
  progress?: number;
  /** Extra markers to pin to this route — used for a ride's auto sprite. */
  children?: React.ReactNode;
}) {
  const skeleton = useMemo(() => stopIds.map(coordOf), [stopIds]);
  const [fetched, setFetched] = useState<{
    key: string;
    coords: [number, number][] | null;
  } | null>(null);

  const key = `${id}:${stopIds.join(">")}`;
  // Render-time derivation: resolved cache hits never need a setState.
  const road = geometryCache.has(key)
    ? geometryCache.get(key) ?? null
    : fetched?.key === key
      ? fetched.coords
      : null;
  const loadingReal = !geometryCache.has(key) && fetched?.key !== key;

  useEffect(() => {
    if (geometryCache.has(key)) return;
    if (stopIds.length < 2 || !stopIds.every((id) => NODES[id])) return;

    let cancelled = false;
    let attempt = 0;
    let timer: number | undefined;

    const run = async (): Promise<void> => {
      const waypoints = stopIds
        .map((id) => `${NODES[id].lng},${NODES[id].lat}`)
        .join(";");
      const url = `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(GEOMETRY_TIMEOUT_MS) });
        if (!res.ok) throw new Error(`OSRM ${res.status}`);
        const json = await res.json();
        const coords = json?.routes?.[0]?.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2)
          throw new Error("no geometry");
        // Success is cached, so every other tab reuses the same real geometry
        // and they all agree on where the auto is.
        cacheGeometry(key, coords);
        if (!cancelled) setFetched({ key, coords });
      } catch {
        // A failure is NOT cached. The shared public OSRM server rate-limits
        // and occasionally stalls; caching that outcome turned a momentary blip
        // into a full day of straight-line routes. Retry a couple of times
        // instead, and only settle for the dashed skeleton if all of them fail.
        attempt += 1;
        if (!cancelled && attempt < GEOMETRY_MAX_ATTEMPTS) {
          timer = window.setTimeout(() => void run(), GEOMETRY_RETRY_MS * attempt);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [key, stopIds]);

  if (skeleton.length < 2) return null;

  // A trip only paints its progress once the vehicle is actually moving.
  const moving = progress > 0 && progress < 1;

  return (
    <MapRoute
      id={id}
      coordinates={road ?? skeleton}
      // Ahead of the auto: light. Behind it: bright, via RouteProgress below.
      color={moving ? UPCOMING_COLOR : "#22c55e"}
      width={5}
      opacity={moving ? UPCOMING_OPACITY : 0.95}
      active
      progress={moving ? progress : undefined}
      dashArray={dashed || loadingReal ? [1.5, 1.5] : undefined}
    >
      {children}
      {/* The traveled half, painted over the pale base line. */}
      {moving && (
        <RouteProgress color={TRAVELED_COLOR} width={5} opacity={1} />
      )}
      {/* The auto itself, riding the progress point. */}
      {moving && (
        <RouteMarker at="progress">
          <MarkerContent>
            <span className="relative flex items-center justify-center">
              {/* Halo marks this as *your* auto among the fleet. */}
              <span className="absolute size-8 animate-ping rounded-full bg-emerald-400/45" />
              <img
                src="/auto.png"
                alt="Your auto"
                draggable={false}
                className="relative h-9 w-auto max-w-none select-none drop-shadow-[0_3px_5px_rgba(0,0,0,0.4)]"
                // The sprite art faces left; routes generally head east.
                style={{ transform: "scaleX(-1)" }}
              />
            </span>
          </MarkerContent>
        </RouteMarker>
      )}
      {riders.map((rider, i) => (
        <MapMarker
          key={`${rider.id}-p`}
          longitude={rider.pickup[0]}
          latitude={rider.pickup[1]}
        >
          <MarkerContent>
            <span className="relative flex items-center justify-center">
              {i === 0 && (
                <span className="absolute size-5 animate-ping rounded-full bg-emerald-400/60" />
              )}
              <span className="relative block size-3.5 rounded-full border-2 border-white bg-emerald-500 shadow-md" />
            </span>
          </MarkerContent>
        </MapMarker>
      ))}
      {riders.map((rider) => (
        <MapMarker
          key={`${rider.id}-d`}
          longitude={rider.drop[0]}
          latitude={rider.drop[1]}
        >
          <MarkerContent>
            <span className="block size-3.5 rounded-[4px] border-2 border-white bg-zinc-900 shadow-md" />
          </MarkerContent>
        </MapMarker>
      ))}
    </MapRoute>
  );
}

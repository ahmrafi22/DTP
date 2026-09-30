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
 * A `null` entry records "looked and it was unavailable" so we stop retrying.
 * The map is effectively static, so entries are kept for a day.
 */
const GEOMETRY_CACHE_KEY = "dtp-route-geometry";
const GEOMETRY_TTL_MS = 24 * 60 * 60 * 1000;

type GeometryMap = Record<string, { coords: [number, number][] | null; at: number }>;

function readSharedCache(): GeometryMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(GEOMETRY_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as GeometryMap;
    const cutoff = Date.now() - GEOMETRY_TTL_MS;
    return Object.fromEntries(
      Object.entries(parsed).filter(([, v]) => v && v.at > cutoff),
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

function cacheGeometry(key: string, coords: [number, number][] | null): void {
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
    const waypoints = stopIds
      .map((id) => `${NODES[id].lng},${NODES[id].lat}`)
      .join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`;
    fetch(url, { signal: AbortSignal.timeout(8000) })
      .then((res) => {
        if (!res.ok) throw new Error(`OSRM ${res.status}`);
        return res.json();
      })
      .then((json) => {
        const coords = json?.routes?.[0]?.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2)
          throw new Error("no geometry");
        cacheGeometry(key, coords);
        if (!cancelled) setFetched({ key, coords });
      })
      .catch(() => {
        // offline / rate-limited: keep showing the straight-line skeleton
        cacheGeometry(key, null);
        if (!cancelled) setFetched({ key, coords: null });
      });
    return () => {
      cancelled = true;
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

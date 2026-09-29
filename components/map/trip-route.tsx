"use client";

import { useEffect, useMemo, useState } from "react";
import { MapMarker, MapRoute, MarkerContent } from "@/components/ui/map";
import { NODES } from "@/lib/network";

export type RiderPin = {
  /** Unique rider key. */
  id: string;
  pickup: [number, number];
  drop: [number, number];
};

const coordOf = (stopId: string): [number, number] => [
  NODES[stopId].lng,
  NODES[stopId].lat,
];

// in-memory cache only — the demo lives entirely in the browser session.
// A `null` entry means "tried and unavailable" so we stop refetching.
const geometryCache = new Map<string, [number, number][] | null>();

const geometryKey = (stopIds: string[]): string => stopIds.join(">");

/** Road geometry for a stop sequence if we already have it (or straight-line fallback). */
export function getTripGeometry(stopIds: string[]): [number, number][] {
  const cached = geometryCache.get(geometryKey(stopIds));
  if (cached && cached.length >= 2) return cached;
  return stopIds.map(coordOf);
}

/**
 * Ask for the real road geometry once per stop sequence. Shared by the trip
 * overlay and the fleet sprites so an auto glides along the very line it
 * appears to be driving.
 */
export function requestTripGeometry(stopIds: string[]): void {
  const key = geometryKey(stopIds);
  if (geometryCache.has(key)) return;
  if (stopIds.length < 2 || !stopIds.every((id) => NODES[id])) return;
  const waypoints = stopIds.map((id) => `${NODES[id].lng},${NODES[id].lat}`).join(";");
  fetch(`https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`, {
    signal: AbortSignal.timeout(8000),
  })
    .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`OSRM ${res.status}`))))
    .then((json) => {
      const coords = json?.routes?.[0]?.geometry?.coordinates;
      geometryCache.set(key, Array.isArray(coords) && coords.length >= 2 ? coords : null);
    })
    .catch(() => geometryCache.set(key, null));
}

/**
 * The active ride (or driver trip) drawn over the demo fleet: one parrot
 * green path that follows real roads (OSRM), with pickup/drop pins for every
 * rider. While the geometry is loading — or offline — a dashed straight-line
 * skeleton between the stops is shown instead.
 */
export function TripRoute({
  id,
  stopIds,
  dashed = false,
  riders,
}: {
  id: string;
  /** Ordered stop ids (travel order) of the primary rider. */
  stopIds: string[];
  /** Dashed while the ride is still just a REQUESTED preview. */
  dashed?: boolean;
  riders: RiderPin[];
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
    let cancelled = false;
    // Kick the shared fetch, then paint as soon as the cache fills.
    requestTripGeometry(stopIds);
    const timer = window.setInterval(() => {
      if (cancelled) return;
      const coords = geometryCache.get(key) ?? null;
      if (coords !== null || geometryCache.has(key)) {
        setFetched({ key, coords });
        window.clearInterval(timer);
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [key, stopIds]);

  if (skeleton.length < 2) return null;
  return (
    <MapRoute
      id={id}
      coordinates={road ?? skeleton}
      color="#22c55e"
      width={5}
      opacity={0.95}
      active
      dashArray={dashed || loadingReal ? [1.5, 1.5] : undefined}
    >
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

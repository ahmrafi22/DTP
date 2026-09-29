"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as MapLibreGL from "maplibre-gl";
import { useMap } from "@/components/ui/map";
import { fetchMapLive, type MapLiveDriver, type MapLivePayload } from "@/lib/api";
import { NODES } from "@/lib/network";
import { pointAtFraction } from "@/lib/route";

/**
 * The living fleet, straight from the database.
 *
 * `useMapLive` is the single poll (GET /map/live, every 4s — the server
 * collapses concurrent pollers into one set of queries). `LiveFleet` renders
 * one sprite per driver: parked at their base stop when idle or offline,
 * gliding along the running trip's stop path when onboard. The badge tells
 * the story at a glance — amber pulsing = waiting for passengers, blue =
 * carrying riders, gray = engine off.
 *
 * Sprites move imperatively via requestAnimationFrame between polls, so the
 * motion is smooth without re-rendering React every frame.
 */

/** Anchor for interpolation: the payload plus the instant it arrived. */
export interface MapLiveAnchor {
  payload: MapLivePayload;
  at: number;
}

export function useMapLive(intervalMs = 4000): {
  data: MapLivePayload | null;
  dataAt: number;
  refresh: () => void;
} {
  const [data, setData] = useState<MapLivePayload | null>(null);
  const [dataAt, setDataAt] = useState(0);

  const refresh = useCallback(() => {
    fetchMapLive()
      .then((payload) => {
        setData(payload);
        setDataAt(Date.now());
      })
      .catch(() => {
        // Map keeps the last snapshot; the next poll retries.
      });
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, intervalMs);
    return () => window.clearInterval(timer);
  }, [refresh, intervalMs]);

  return { data, dataAt, refresh };
}

/** Where a driver's sprite sits right now (interpolated between polls). */
function positionOf(driver: MapLiveDriver, dataAt: number): [number, number] | null {
  const ride = driver.ride;
  if (ride && ride.stopIds.length >= 2) {
    const coords: [number, number][] = [];
    for (const id of ride.stopIds) {
      const stop = NODES[id];
      if (stop) coords.push([stop.lng, stop.lat]);
    }
    if (coords.length >= 2) {
      const totalSec = Math.max(ride.totalSec, 1);
      const elapsedSec = ride.status === "STARTED" ? (Date.now() - dataAt) / 1000 : 0;
      const progress = Math.min(1, ride.progress + elapsedSec / totalSec);
      return pointAtFraction(coords, progress) ?? coords[0] ?? null;
    }
  }
  const base = driver.baseStopId ? NODES[driver.baseStopId] : null;
  return base ? [base.lng, base.lat] : null;
}

const PHASE_DOT: Record<MapLiveDriver["phase"], string> = {
  waiting: "#f59e0b",
  onboard: "#2563eb",
  offline: "#71717a",
};

interface SpriteRefs {
  marker: MapLibreGL.Marker;
  dot: HTMLSpanElement;
  ping: HTMLSpanElement;
  ring: HTMLSpanElement;
}

export function LiveFleet({
  data,
  dataAt,
  selectedDriverId,
  onSelect,
}: {
  data: MapLivePayload | null;
  dataAt: number;
  selectedDriverId: string | null;
  onSelect: (driverId: string) => void;
}) {
  const { map } = useMap();
  const spritesRef = useRef(new Map<string, SpriteRefs>());
  // Which map instance the current sprites belong to — the Map component can
  // swap instances (theme/style), and markers on a dead map render nowhere.
  const spritesMapRef = useRef<MapLibreGL.Map | null>(null);
  const stateRef = useRef({ data, dataAt, selectedDriverId });
  stateRef.current = { data, dataAt, selectedDriverId };
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Create/remove sprites when the driver set changes; reposition + restyle
  // immediately so a paused rAF (background tab) still shows fresh state.
  useEffect(() => {
    if (!map || !data) return;
    const sprites = spritesRef.current;
    if (spritesMapRef.current !== map) {
      for (const stale of sprites.values()) stale.marker.remove();
      sprites.clear();
      spritesMapRef.current = map;
    }
    const alive = new Set(data.drivers.map((d) => d.driverId));
    for (const [id, sprite] of sprites) {
      if (!alive.has(id)) {
        sprite.marker.remove();
        sprites.delete(id);
      }
    }

    for (const driver of data.drivers) {
      let sprite = sprites.get(driver.driverId);
      if (!sprite) {
        const el = document.createElement("div");
        el.style.cursor = "pointer";
        const img = document.createElement("img");
        img.src = "/auto.png";
        img.alt = `${driver.driverName}'s ${driver.vehicleName}`;
        img.draggable = false;
        img.className =
          "h-9 w-auto max-w-none select-none drop-shadow-[0_3px_5px_rgba(0,0,0,0.35)]";
        img.style.transform = "scaleX(-1)";
        el.appendChild(img);

        const badge = document.createElement("span");
        badge.style.cssText =
          "position:absolute;right:-1px;bottom:-2px;width:11px;height:11px;";
        const ping = document.createElement("span");
        ping.className = "animate-ping";
        ping.style.cssText =
          "position:absolute;inset:0;border-radius:9999px;opacity:0.6;display:none;";
        badge.appendChild(ping);
        const ring = document.createElement("span");
        ring.style.cssText =
          "position:absolute;inset:0;border-radius:9999px;border:2px solid rgba(255,255,255,0.9);";
        badge.appendChild(ring);
        const dot = document.createElement("span");
        dot.style.cssText =
          "position:absolute;inset:1.5px;border-radius:9999px;";
        badge.appendChild(dot);
        el.appendChild(badge);

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectRef.current(driver.driverId);
        });

        const pos = positionOf(driver, dataAt) ?? [90.4, 23.78];
        const marker = new MapLibreGL.Marker({ element: el })
          .setLngLat(pos as [number, number])
          .addTo(map);
        sprite = { marker, dot, ping, ring };
        sprites.set(driver.driverId, sprite);
      }

      const pos = positionOf(driver, dataAt);
      if (pos) sprite.marker.setLngLat(pos);
      styleSprite(sprite, driver, driver.driverId === selectedDriverId);
    }

    return () => {
      // Keep sprites alive across data refreshes; teardown happens on unmount.
    };
  }, [map, data, dataAt, selectedDriverId]);

  // Smooth motion: glide onboard sprites along their path every frame.
  useEffect(() => {
    if (!map) return;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const current = stateRef.current;
      if (!current.data) return;
      for (const driver of current.data.drivers) {
        const sprite = spritesRef.current.get(driver.driverId);
        if (!sprite) continue;
        const pos = positionOf(driver, current.dataAt);
        if (pos && driver.ride) sprite.marker.setLngLat(pos);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [map]);

  // Teardown when the map or the component goes away.
  useEffect(() => {
    const sprites = spritesRef.current;
    return () => {
      for (const sprite of sprites.values()) sprite.marker.remove();
      sprites.clear();
      spritesMapRef.current = null;
    };
  }, []);

  return null;
}

function styleSprite(sprite: SpriteRefs, driver: MapLiveDriver, selected: boolean): void {
  const dotColor = PHASE_DOT[driver.phase];
  sprite.dot.style.backgroundColor = dotColor;
  sprite.ring.style.borderColor =
    selected && driver.color ? driver.color : "rgba(255,255,255,0.9)";
  sprite.ping.style.display = driver.phase === "waiting" ? "block" : "none";
  const scale = selected ? "scale(1.18)" : "scale(1)";
  const img = sprite.marker.getElement().querySelector("img");
  if (img) img.style.scale = scale;
}

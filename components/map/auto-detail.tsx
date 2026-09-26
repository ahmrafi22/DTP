"use client";

import { useMemo } from "react";
import {
  IoClose,
  IoLocation,
  IoNavigate,
  IoPeople,
  IoPerson,
  IoSpeedometer,
} from "react-icons/io5";
import { NODES } from "@/lib/network";
import { PHASE_LABEL, type FleetLiveStatus } from "@/lib/fleet";
import { pointAtFraction } from "@/lib/route";
import type { RouteData } from "@/lib/route";

/** Demo riders, matching the PRD cast plus a few extras. */
const RIDER_NAMES = [
  "Nusrat", "Rafiq", "Shirin", "Tanvir", "Moumita", "Rifat",
  "Sumaiya", "Imran", "Nabila", "Sakib", "Farhana", "Jahangir",
];

const DRIVER_NAMES = [
  "Jashim", "Kabir", "Rashid", "Salma", "Habib", "Nasir", "Aminul", "Ruma",
];

/** Stable per-route pseudo-randomness, so a route always shows the same crew. */
function hashRoute(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type AutoPassenger = {
  name: string;
  /** Real place the rider is dropped at, found on the actual route geometry. */
  dropName: string;
  dropPoint: [number, number];
};

/**
 * Drop-offs are real places too: we take a point partway along the ACTUAL
 * OSRM geometry and find the nearest real Dhaka stop to it, so every rider
 * gets dropped somewhere that genuinely lies on this auto's road path.
 */
function nearestStop(point: [number, number]) {
  let best: { name: string; point: [number, number] } | null = null;
  let bestD = Infinity;
  for (const node of Object.values(NODES)) {
    const dx = (node.lng - point[0]) * Math.cos((node.lat * Math.PI) / 180);
    const dy = node.lat - point[1];
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      best = { name: node.name, point: [node.lng, node.lat] };
    }
  }
  return best;
}

export function passengersForRoute(route: RouteData): AutoPassenger[] {
  const h = hashRoute(route.id);
  // Most autos are partly full; a couple run empty.
  const count = h % 4 === 0 ? 0 : 1 + (h % 3);
  const out: AutoPassenger[] = [];
  for (let i = 0; i < count; i++) {
    // Spread drop-offs between 55% and 92% along the real path.
    const frac = 0.55 + (((h >> (i * 5)) & 0xff) / 255) * 0.37;
    const point = pointAtFraction(route.coordinates, frac);
    if (!point) continue;
    const stop = nearestStop(point);
    if (!stop) continue;
    out.push({
      name: RIDER_NAMES[(h + i * 5) % RIDER_NAMES.length],
      dropName: stop.name,
      dropPoint: stop.point,
    });
  }
  return out;
}

export function driverForRoute(route: RouteData) {
  const h = hashRoute(route.id);
  return {
    name: DRIVER_NAMES[h % DRIVER_NAMES.length],
    plate: `METRO-${(h % 90) + 10}-${1000 + (h % 8999)}`,
  };
}

function formatKm(meters: number | null) {
  if (meters == null) return null;
  return meters >= 1000
    ? `${(meters / 1000).toFixed(1)} km`
    : `${Math.round(meters)} m`;
}

function formatMin(seconds: number | null) {
  if (seconds == null) return null;
  const mins = Math.max(1, Math.round(seconds / 60));
  return mins >= 60 ? `${Math.floor(mins / 60)} h ${mins % 60} min` : `${mins} min`;
}

const STATUS_LABEL = {
  destination: "On a trip",
  wander: "Roaming",
  stationary: "Parked",
} as const;

/** Full detail for the selected auto, shown in the sliding side panel. */
export function AutoDetailCard({
  route,
  progress,
  fleet,
  onClose,
}: {
  route: RouteData;
  /** 0–1 along the route, read live from the driving engine. */
  progress: number;
  /** Present when the auto belongs to the BD-clock scheduled fleet. */
  fleet?: {
    name: string;
    driver: string;
    plate: string;
    status: FleetLiveStatus;
  };
  onClose: () => void;
}) {
  const passengers = useMemo(() => passengersForRoute(route), [route]);
  const fallbackDriver = useMemo(() => driverForRoute(route), [route]);
  const driver = fleet
    ? { name: fleet.driver, plate: fleet.plate }
    : fallbackDriver;
  const distance = formatKm(route.distance);
  const duration = formatMin(route.duration);
  const pct = Math.round(Math.min(1, Math.max(0, progress)) * 100);
  const carrying = fleet ? fleet.status.phase === "carrying" : route.kind !== "stationary";
  const statusLabel = fleet
    ? PHASE_LABEL[fleet.status.phase]
    : STATUS_LABEL[route.kind];
  const standName = fleet?.status.standName || route.fromName;

  return (
    <div className="flex h-full flex-col">
      {/* header */}
      <div className="flex items-start gap-2.5 pb-3">
        <span
          className="mt-1.5 size-3 shrink-0 rounded-full"
          style={{ backgroundColor: route.color }}
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-foreground text-sm leading-tight font-bold">
            {fleet ? `${fleet.name} · ${route.name}` : route.name}
          </h2>
          <p className="text-muted-foreground mt-0.5 text-[11px] font-medium">
            CNG auto-rickshaw · {statusLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="hover:bg-muted active:scale-[0.94] -mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg transition-all"
        >
          <IoClose className="size-4" />
        </button>
      </div>

      {/* driver */}
      <div className="border-border flex items-center gap-2.5 rounded-xl border p-2.5">
        <span className="bg-ink flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-black text-white">
          {driver.name[0]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-xs font-bold">
            {driver.name}
          </p>
          <p className="text-muted-foreground text-[10px] font-medium">
            {driver.plate} · Cash + bKash
          </p>
        </div>
      </div>

      {/* route — only while actually running a trip; waiting/parked autos
          show no route info at all */}
      {carrying && (
        <div className="border-border mt-2.5 rounded-xl border p-3">
          <p className="text-muted-foreground flex items-center gap-1.5 pb-2 text-[10px] font-bold tracking-wide uppercase">
            <IoLocation className="size-3" />
            Route
          </p>
          <div className="flex items-center gap-2.5">
            <span className="bg-primary size-2.5 shrink-0 rounded-full" />
            <p className="text-foreground flex-1 text-xs font-semibold">
              {fleet ? fleet.status.fromName || route.fromName : route.fromName}
            </p>
          </div>
          <div className="border-border mx-[7px] h-2.5 border-l-2 border-dashed" />
          <div className="flex items-center gap-2.5">
            <span className="bg-ink size-2.5 shrink-0 rounded-full" />
            <p className="text-foreground flex-1 text-xs font-semibold">
              {fleet ? fleet.status.toName || route.toName : route.toName}
            </p>
          </div>
          {(distance || duration) && (
            <p className="text-muted-foreground mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold">
              {distance && (
                <span className="flex items-center gap-1">
                  <IoSpeedometer className="size-3" />
                  {distance}
                </span>
              )}
              {duration && <span>· {duration}</span>}
              {!route.approximate && (
                <span className="bg-primary/15 text-primary w-full rounded-full px-2 py-0.5 text-center text-[10px] font-bold">
                  Live road route
                </span>
              )}
            </p>
          )}
        </div>
      )}

      {/* live progress */}
      {carrying && (
        <div className="border-border mt-2.5 rounded-xl border p-3">
          <div className="flex items-center justify-between pb-1.5">
            <p className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-bold tracking-wide uppercase">
              <IoNavigate className="text-primary size-3" />
              Along the route
            </p>
            <p className="text-foreground text-[11px] font-black">{pct}%</p>
          </div>
          <div className="bg-muted h-1.5 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-[width] duration-500 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* passengers */}
      <div className="border-border mt-2.5 rounded-xl border p-3">
        <p className="text-muted-foreground flex items-center gap-1.5 pb-2 text-[10px] font-bold tracking-wide uppercase">
          <IoPeople className="size-3" />
          On board
          <span className="text-foreground ml-auto text-[10px]">
            {carrying ? passengers.length : 0} of 3 seats
          </span>
        </p>
        {fleet && fleet.status.phase === "waiting" ? (
          <p className="text-muted-foreground text-[11px]">
            Waiting for passengers at the {standName} stand.
          </p>
        ) : fleet && fleet.status.phase === "parked" ? (
          <p className="text-muted-foreground text-[11px]">
            Off duty — parked at {standName}.
          </p>
        ) : passengers.length === 0 ? (
          <p className="text-muted-foreground text-[11px]">
            Running empty — heading out to pick up.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {passengers.map((p) => (
              <li key={p.name} className="flex items-center gap-2 text-[11px]">
                <IoPerson className="text-muted-foreground size-3.5 shrink-0" />
                <span className="text-foreground font-bold">{p.name}</span>
                <span className="text-muted-foreground min-w-0 flex-1 truncate">
                  dropping at {p.dropName}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-muted-foreground mt-auto pt-3 text-center text-[10px]">
        Demo data · tap the map to close
      </p>
    </div>
  );
}

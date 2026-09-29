"use client";

import Link from "next/link";
import { IoClose, IoPersonCircleOutline } from "react-icons/io5";
import { NODES } from "@/lib/network";
import type { MapLiveDriver } from "@/lib/api";
import { useActiveRequest, useStore } from "@/components/store";
import { cn } from "@/lib/utils";

/**
 * What tapping a running driver shows. Passengers aboard appear as first
 * name + where they get off — deliberately no fares, no phones. The card is
 * also the door into hop-on joining: a passenger with a free hand and a free
 * seat sees a single "Join this ride" action.
 */
export function DriverDetailCard({
  driver,
  onClose,
  onJoin,
}: {
  driver: MapLiveDriver;
  onClose: () => void;
  onJoin: () => void;
}) {
  const { persona } = useStore();
  const activeRequest = useActiveRequest();

  const baseName = driver.baseStopId ? NODES[driver.baseStopId]?.name : null;
  const statusLine =
    driver.phase === "onboard" && driver.ride
      ? driver.ride.status === "STARTED"
        ? "On the trip"
        : driver.ride.status === "DRIVER_ARRIVED"
          ? `Waiting at ${NODES[driver.ride.stopIds[0]]?.name ?? "the pickup"}`
          : "Matching riders"
      : driver.phase === "waiting"
        ? `Waiting for passengers at ${baseName ?? "the stand"}`
        : `Offline · parked at ${baseName ?? "the stand"}`;

  const canJoin =
    persona?.role === "passenger" &&
    !activeRequest &&
    driver.online &&
    driver.ride &&
    driver.seatsTaken < driver.capacity;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-foreground text-sm font-bold tracking-tight">
          {driver.vehicleName}
          <span className="text-muted-foreground font-medium"> · {driver.driverName}</span>
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

      {/* Status + seats */}
      <div className={cn("border-border rounded-xl border p-3", driver.phase === "offline" && "opacity-75")}>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "size-2.5 shrink-0 rounded-full",
              driver.phase === "onboard" && "animate-pulse bg-blue-500",
              driver.phase === "waiting" && "animate-pulse bg-amber-500",
              driver.phase === "offline" && "bg-zinc-400",
            )}
          />
          <p className="text-foreground flex-1 text-sm font-semibold">{statusLine}</p>
        </div>
        <div className="mt-2.5 flex items-center gap-1.5">
          {Array.from({ length: driver.capacity }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-2.5 w-6 rounded-full",
                i < driver.seatsTaken ? "bg-primary" : "bg-muted",
              )}
            />
          ))}
          <span className="text-muted-foreground ml-1.5 text-[11px] font-semibold">
            {driver.capacity - driver.seatsTaken} of {driver.capacity} seats free
          </span>
        </div>
      </div>

      {/* Passengers aboard — names and get-offs only, never pricing */}
      <div className="border-border rounded-xl border p-3">
        <p className="text-muted-foreground pb-2 text-[10px] font-bold tracking-wide uppercase">
          Aboard now
        </p>
        {driver.ride && driver.ride.passengers.length > 0 ? (
          <ul className="space-y-1.5">
            {driver.ride.passengers.map((p) => (
              <li key={`${p.firstName}-${p.dropStopId}`} className="flex items-center gap-2 text-xs">
                <IoPersonCircleOutline className="text-muted-foreground size-4 shrink-0" />
                <span className="text-foreground font-semibold">{p.firstName}</span>
                <span className="text-muted-foreground min-w-0 flex-1 truncate">
                  → {NODES[p.dropStopId]?.name ?? p.dropStopId}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-xs">
            No riders yet — the first passenger sets the route.
          </p>
        )}
      </div>

      {/* The route being driven */}
      {driver.ride && driver.ride.stopIds.length > 1 && (
        <div className="border-border rounded-xl border p-3">
          <p className="text-muted-foreground pb-2 text-[10px] font-bold tracking-wide uppercase">
            This trip stops at
          </p>
          <ol className="space-y-1">
            {driver.ride.stopIds.map((id, i) => (
              <li key={`${id}-${i}`} className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground w-4 text-right text-[10px] font-bold tabular-nums">
                  {i + 1}
                </span>
                <span className="text-foreground font-medium">{NODES[id]?.name ?? id}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* The door in */}
      {canJoin ? (
        <button
          type="button"
          onClick={onJoin}
          className="bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] w-full rounded-xl py-2.5 text-sm font-bold shadow-sm transition-all"
        >
          Join this ride
        </button>
      ) : persona?.role === "passenger" && driver.online && driver.ride ? (
        <p className="text-muted-foreground text-center text-[11px]">
          {activeRequest
            ? "You are already on a ride."
            : driver.seatsTaken >= driver.capacity
              ? "Every seat is taken."
              : "This ride is not taking joiners right now."}
        </p>
      ) : !persona ? (
        <Link
          href="/login"
          className="border-border text-foreground hover:bg-muted active:scale-[0.98] flex items-center justify-center rounded-xl border py-2.5 text-xs font-bold transition-all"
        >
          Sign in to hop in
        </Link>
      ) : null}
    </div>
  );
}

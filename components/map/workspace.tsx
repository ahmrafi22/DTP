"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { IoClose, IoSearch } from "react-icons/io5";
import { Map as MapView, MapControls, useMap } from "@/components/ui/map";
import { FitAllRoutes } from "@/components/route-map";
import { FleetAuto, StationaryAuto } from "@/components/map/fleet-engine";
import { FleetClockChip } from "@/components/map/fleet-clock";
import { RidePanel } from "@/components/map/ride-panel";
import { TripRoute } from "@/components/map/trip-route";
import { OpenRideDetail, OpenRideMarkers } from "@/components/map/open-rides";
import { useTripProgress } from "@/lib/trip-progress";
import { AutoDetailCard } from "@/components/map/auto-detail";
import { AppNav, Brand } from "@/components/app-nav";
import { NODES } from "@/lib/network";
import {
  FLEET,
  STATIONARY_AUTOS,
  activeFleet,
  corridorRoute,
  dhakaClockSec,
  hashSeed,
  mulberry32,
  type BdClockAnchor,
  type FleetLiveStatus,
} from "@/lib/fleet";
import { useActiveRequest, useActiveTrip, useStore } from "@/components/store";
import type { RouteData } from "@/lib/route";

const coordOf = (stopId: string): [number, number] => [
  NODES[stopId].lng,
  NODES[stopId].lat,
];

export function MapWorkspace({ routes }: { routes: RouteData[] }) {
  // Bangladesh clock: null until mounted so SSR markup never disagrees with
  // the client about which fleet is on duty. The preview slider (demo time
  // travel) overrides it. The anchor ref holds BD seconds + the wall-clock
  // instant it was read, so engines interpolate smoothly between ticks and
  // every lifecycle position is a pure function of BD time — reloading at
  // the same second resumes the exact same progress.
  const [liveMin, setLiveMin] = useState<number | null>(null);
  const lastMinuteRef = useRef(-1);
  const clockRef = useRef<BdClockAnchor>({ bdSec: 0, unixMs: 0 });

  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const effSec = dhakaClockSecSafe();
      clockRef.current = { bdSec: effSec, unixMs: now };
      const minute = Math.floor(effSec / 60) % 1440;
      if (minute !== lastMinuteRef.current) {
        lastMinuteRef.current = minute;
        setLiveMin(minute);
      }
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, []);

  const nowMin = liveMin;

  // The BD-clock-scheduled fleet: at most MAX_CONCURRENT_AUTOS on duty, each
  // on its own real corridor for the current shift window.
  const active = useMemo(
    () => (nowMin == null ? [] : activeFleet(nowMin)),
    [nowMin],
  );

  // Always-parked autos at real stands (never move, cycle phases by clock).
  const stationaryRoutes = useMemo<RouteData[]>(
    () =>
      STATIONARY_AUTOS.map((def) => ({
        id: `stand-${def.id}`,
        name: `${def.name} · ${def.at.name}`,
        color: def.color,
        kind: "stationary" as const,
        fromName: def.at.name,
        toName: def.at.name,
        coordinates: [
          [def.at.lng, def.at.lat] as [number, number],
        ],
        distance: null,
        duration: null,
        approximate: true,
      })),
    [],
  );

  // The corridors the on-duty autos are working — the map frames these.
  const fitRoutes = useMemo(() => {
    if (nowMin == null) return stationaryRoutes;
    const seen = new Set<string>();
    const out: RouteData[] = [...stationaryRoutes];
    for (const { shift } of active) {
      const route = corridorRoute(shift.corridor, routes);
      if (route && !seen.has(route.id)) {
        seen.add(route.id);
        out.push(route);
      }
    }
    return out;
  }, [active, routes, nowMin, stationaryRoutes]);

  // Route lines: a random 2–3 of the on-duty corridors are drawn at a time.
  // The pick is seeded per 45s bucket, so it changes on a steady rhythm,
  // survives reloads, and minute-ticks never flip lines mid-view.
  const [lineIds, setLineIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const pick = () => {
      const ids = active.map((entry) => entry.auto.id);
      if (ids.length === 0) {
        setLineIds(new Set());
        return;
      }
      const bucket = Math.floor(Date.now() / 45000);
      const rand = mulberry32(hashSeed(`lines:${bucket}`));
      const shuffled = [...ids];
      for (let i = shuffled.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rand() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const count = Math.min(ids.length, 2 + (bucket % 2));
      setLineIds(new Set(shuffled.slice(0, count)));
    };
    // setState inside callbacks, not the effect body (avoid cascading renders).
    const kickoff = window.setTimeout(pick, 0);
    const timer = window.setInterval(pick, 45000);
    return () => {
      window.clearTimeout(kickoff);
      window.clearInterval(timer);
    };
  }, [active]);

  // Live status refs, one per auto (roster + stationary); the engines write
  // into them and the detail panel polls (no React state per frame).
  const statusRefs = useMemo(() => {
    const refs = new Map<string, React.RefObject<FleetLiveStatus>>();
    for (const auto of [...FLEET, ...STATIONARY_AUTOS]) {
      refs.set(auto.id, {
        current: {
          phase: "parked",
          progress: 0,
          fromName: "",
          toName: "",
          standName: "",
        },
      });
    }
    return refs;
  }, []);

  // Active ride / trip overlay data.
  const activeRequest = useActiveRequest();
  const activeTrip = useActiveTrip();
  const { state, activeRide } = useStore();

  // The vehicle only moves while the ride is STARTED. `updatedAt` is the
  // server's timestamp for the transition into that state, which is where the
  // 90-second run is measured from.
  const liveRequest =
    activeRequest ??
    state.requests.find(
      (r) => activeTrip !== null && activeTrip.requestIds.includes(r.id),
    ) ??
    null;
  const tripProgress = useTripProgress(
    (activeRequest?.status ?? liveRequest?.status) === "STARTED",
    liveRequest?.updatedAt,
  );

  const overlay = useMemo(() => {
    if (activeRequest) {
      return {
        id: `ride-${activeRequest.id}`,
        // The trip's whole route, not this rider's slice of it: one Tesla,
        // one line on the map, whoever happens to be looking.
        stopIds: activeRide?.routeStopIds?.length
          ? activeRide.routeStopIds
          : activeRequest.stopIds,
        dashed: activeRequest.status === "REQUESTED",
        progress: tripProgress,
        riders: [
          {
            id: activeRequest.id,
            pickup: coordOf(activeRequest.pickupStopId),
            drop: coordOf(activeRequest.dropStopId),
          },
        ],
      };
    }
    if (activeTrip) {
      const riders = activeTrip.requestIds
        .map((id) => state.requests.find((r) => r.id === id))
        .filter((r): r is NonNullable<typeof r> => Boolean(r));
      const primary = riders[0];
      if (!primary) return null;
      return {
        id: `trip-${activeTrip.id}`,
        stopIds: activeRide?.routeStopIds?.length
          ? activeRide.routeStopIds
          : primary.stopIds,
        dashed: false,
        progress: tripProgress,
        riders: riders.map((r) => ({
          id: r.id,
          pickup: coordOf(r.pickupStopId),
          drop: coordOf(r.dropStopId),
        })),
      };
    }
    return null;
  }, [activeRequest, activeTrip, state.requests, tripProgress]);

  // Mobile sheets.
  const [sheet, setSheet] = useState<"none" | "book" | "auto">("none");

  // Which demo auto's detail panel is open (tap the sprite to toggle).
  const [selectedAutoId, setSelectedAutoId] = useState<string | null>(null);
  const toggleAuto = (id: string) => {
    setSelectedAutoId((prev) => {
      const next = prev === id ? null : id;
      if (next) setSheet("auto");
      else setSheet((s) => (s === "auto" ? "none" : s));
      return next;
    });
  };
  const selectedEntry =
    active.find((entry) => entry.auto.id === selectedAutoId) ?? null;
  const stationaryDef =
    STATIONARY_AUTOS.find((a) => a.id === selectedAutoId) ?? null;
  const selectedRoute = selectedEntry
    ? corridorRoute(selectedEntry.shift.corridor, routes)
    : stationaryDef
      ? stationaryRoutes.find((r) => r.id === `stand-${stationaryDef.id}`) ??
        null
      : null;
  const selectedStatus = useFleetStatus(
    selectedAutoId,
    selectedRoute,
    statusRefs,
  );
  const selectedFleet = (() => {
    if (!selectedStatus) return undefined;
    if (selectedEntry) {
      return {
        name: selectedEntry.auto.name,
        driver: selectedEntry.auto.driver,
        plate: selectedEntry.auto.plate,
        status: selectedStatus,
      };
    }
    if (stationaryDef) {
      return {
        name: stationaryDef.name,
        driver: stationaryDef.driver,
        plate: stationaryDef.plate,
        status: selectedStatus,
      };
    }
    return undefined;
  })();

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MapView theme="light" center={[90.4, 23.78]} zoom={11.5}>
        <FitAllRoutes routes={fitRoutes} />
        <DismissOnMapClick onDismiss={() => setSelectedAutoId(null)} />
        <MapControls position="bottom-right" className="max-md:bottom-24" />

        {/* Other passengers' rides, clickable straight from the map. */}
        <OpenRideMarkers />

        {overlay && (
          <TripRoute
            id={overlay.id}
            stopIds={overlay.stopIds}
            dashed={overlay.dashed}
            riders={overlay.riders}
            progress={overlay.progress}
          />
        )}

        {active.map(({ auto, shift, shiftIndex }) => {
          const route = corridorRoute(shift.corridor, routes);
          if (!route) return null;
          return (
            <FleetAuto
              key={`${auto.id}-${shiftIndex}`}
              def={auto}
              shift={shift}
              shiftIndex={shiftIndex}
              route={route}
              selected={auto.id === selectedAutoId}
              showLine={lineIds.has(auto.id)}
              onSelect={toggleAuto}
              clockRef={clockRef}
              statusRef={statusRefs.get(auto.id)!}
            />
          );
        })}

        {STATIONARY_AUTOS.map((def) => (
          <StationaryAuto
            key={def.id}
            def={def}
            clockRef={clockRef}
            onSelect={toggleAuto}
            statusRef={statusRefs.get(def.id)!}
          />
        ))}
      </MapView>

      {/* Brand chip (desktop; mobile keeps just the search pill) */}
      <div className="bg-card border-border absolute top-4 left-4 z-20 hidden items-center gap-3 rounded-2xl border px-4 py-3 shadow-lg md:flex">
        <Brand />
        <p className="text-muted-foreground border-border border-l pl-3 text-[11px]">
          Share a seat. Split the fare.
        </p>
      </div>

      {/* BD clock (bottom-left) */}
      <FleetClockChip nowMin={nowMin} />

      {/* Desktop: auto detail panel (slides in from the left) */}
      <AnimatePresence>
        {selectedRoute && (
          <motion.aside
            key="auto-detail"
            initial={{ x: -340, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -340, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.12, duration: 0.45 }}
            className="bg-card border-border absolute top-20 bottom-4 left-4 z-30 hidden w-[320px] overflow-y-auto rounded-2xl border p-4 shadow-lg md:block"
          >
            <AutoDetailCard
              route={selectedRoute}
              progress={
                selectedStatus?.phase === "carrying"
                  ? selectedStatus.progress
                  : 0
              }
              fleet={selectedFleet}
              onClose={() => setSelectedAutoId(null)}
            />
          </motion.aside>
        )}
      </AnimatePresence>

      <OpenRideDetail />

      {/* Desktop: right booking sidebar */}
      <aside className="bg-card border-border absolute top-4 right-4 bottom-4 z-20 hidden w-[380px] flex-col overflow-y-auto rounded-2xl border p-4 shadow-lg md:flex">
        <RidePanel />
      </aside>

      {/* Mobile: floating search pill */}
      <div className="absolute inset-x-3 top-3 z-20 md:hidden">
        <button
          type="button"
          onClick={() => setSheet("book")}
          className="bg-card border-border text-foreground active:scale-[0.98] flex h-11 w-full items-center gap-2 rounded-xl border px-3 text-sm font-semibold shadow-md transition-all"
        >
          <IoSearch className="text-primary size-4 shrink-0" />
          {activeRequest ? "Trip in progress…" : "Where to?"}
        </button>
      </div>

      {/* Mobile: auto detail sheet */}
      <MobileSheet
        open={sheet === "auto"}
        onClose={() => setSheet("none")}
        label={selectedRoute?.name ?? "Auto details"}
      >
        {selectedRoute && (
          <AutoDetailCard
            route={selectedRoute}
            progress={
              selectedStatus?.phase === "carrying" ? selectedStatus.progress : 0
            }
            fleet={selectedFleet}
            onClose={() => setSheet("none")}
          />
        )}
      </MobileSheet>

      {/* Mobile: booking bottom sheet */}
      <MobileSheet
        open={sheet === "book"}
        onClose={() => setSheet("none")}
        label="Plan a ride"
      >
        <RidePanel />
      </MobileSheet>

      <AppNav />
    </main>
  );
}

/** BD seconds-of-day; 0 before the Intl formatter is available client-side. */
function dhakaClockSecSafe(): number {
  try {
    return dhakaClockSec();
  } catch {
    return 0;
  }
}

/**
 * Poll the engine's imperative live status so the detail panel can show the
 * auto's current lifecycle phase and trip progress. The id rides along in the
 * sample so switching autos resets instantly instead of showing stale state.
 */
function useFleetStatus(
  id: string | null,
  route: RouteData | null,
  refs: Map<string, React.RefObject<FleetLiveStatus>>,
) {
  const [sample, setSample] = useState<{
    id: string;
    status: FleetLiveStatus;
  } | null>(null);
  useEffect(() => {
    const ref = id ? refs.get(id) : undefined;
    if (!id || !route || !ref) return;
    const timer = window.setInterval(() => {
      setSample({ id, status: { ...ref.current } });
    }, 300);
    return () => window.clearInterval(timer);
  }, [id, route, refs]);
  return sample && sample.id === id ? sample.status : null;
}

/** Tapping empty map closes an open auto popup. */
function DismissOnMapClick({ onDismiss }: { onDismiss: () => void }) {
  const { map, isLoaded } = useMap();
  useEffect(() => {
    if (!map || !isLoaded) return;
    const handler = (e: { originalEvent?: { target?: unknown } }) => {
      // MapLibre also fires a map click when a marker is tapped, which would
      // close the popup the marker just opened. Ignore clicks on sprites.
      const target = e.originalEvent?.target as HTMLElement | null;
      if (target?.closest?.(".maplibregl-marker")) return;
      onDismiss();
    };
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [map, isLoaded, onDismiss]);
  return null;
}

/** Draggable bottom sheet (mobile only). Flick down to dismiss. */
function MobileSheet({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.button
          key="scrim"
          type="button"
          aria-label="Close sheet"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-40 bg-zinc-950/30 md:hidden"
        />
      )}
      {open && (
        <motion.div
          key="sheet"
          role="dialog"
          aria-label={label}
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", bounce: 0.2, duration: 0.45 }}
          drag="y"
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.6 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 120 || info.velocity.y > 500) onClose();
          }}
          className="bg-card fixed inset-x-0 top-14 bottom-0 z-50 flex flex-col rounded-t-2xl shadow-2xl md:hidden"
        >
          <div className="border-border relative flex items-center justify-between border-b px-4 py-2.5">
            <span className="bg-border absolute top-1.5 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full" />
            <p className="text-foreground text-sm font-bold">{label}</p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="hover:bg-muted active:scale-[0.94] flex size-7 items-center justify-center rounded-lg transition-all"
            >
              <IoClose className="size-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

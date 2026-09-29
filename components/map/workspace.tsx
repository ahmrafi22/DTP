"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { IoClose, IoSearch } from "react-icons/io5";
import { Map as MapView, MapControls, useMap } from "@/components/ui/map";
import { FitAllRoutes } from "@/components/route-map";
import { LiveFleet, useMapLive } from "@/components/map/live-fleet";
import { FleetClockChip } from "@/components/map/fleet-clock";
import { RidePanel } from "@/components/map/ride-panel";
import { TripRoute } from "@/components/map/trip-route";
import { DriverDetailCard } from "@/components/map/driver-detail";
import { JoinRideSheet } from "@/components/map/join-ride";
import { AppNav, Brand } from "@/components/app-nav";
import { NODES } from "@/lib/network";
import { dhakaClockSec } from "@/lib/bd-clock";
import { useActiveRequest, useActiveTrip, useStore } from "@/components/store";

const coordOf = (stopId: string): [number, number] => [
  NODES[stopId].lng,
  NODES[stopId].lat,
];

export function MapWorkspace() {
  // Bangladesh clock for the chip — cosmetic, the fleet runs on the DB.
  const [liveMin, setLiveMin] = useState<number | null>(null);
  const lastMinuteRef = useRef(-1);

  useEffect(() => {
    const tick = () => {
      const minute = Math.floor(dhakaClockSec() / 60) % 1440;
      if (minute !== lastMinuteRef.current) {
        lastMinuteRef.current = minute;
        setLiveMin(minute);
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  // The living fleet: one poll, all drivers, all running trips.
  const { data: live, dataAt, refresh: refreshLive } = useMapLive(4000);

  // Which driver's card is open, and whether the join sheet is up.
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const toggleDriver = (id: string) => {
    setSelectedDriverId((prev) => (prev === id ? null : id));
    setJoining(false);
  };
  const selectedDriver =
    live?.drivers.find((d) => d.driverId === selectedDriverId) ?? null;

  // Active ride / trip overlay data (the signed-in user's own trip).
  const activeRequest = useActiveRequest();
  const activeTrip = useActiveTrip();
  const { state, refresh } = useStore();

  const overlay = useMemo(() => {
    if (activeRequest) {
      return {
        id: `ride-${activeRequest.id}`,
        stopIds: activeRequest.stopIds,
        dashed: activeRequest.status === "REQUESTED",
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
        stopIds: primary.stopIds,
        dashed: false,
        riders: riders.map((r) => ({
          id: r.id,
          pickup: coordOf(r.pickupStopId),
          drop: coordOf(r.dropStopId),
        })),
      };
    }
    return null;
  }, [activeRequest, activeTrip, state.requests]);

  // Frame the world: every driver's base + every running trip's path.
  // The refit only fires when this set changes, never on progress ticks.
  const fitRoutes = useMemo(() => {
    const out: {
      id: string;
      coordinates: [number, number][];
    }[] = [];
    const seenTrips = new Set<string>();
    for (const d of live?.drivers ?? []) {
      const base = d.baseStopId ? NODES[d.baseStopId] : null;
      if (base) {
        out.push({
          id: `base-${d.driverId}`,
          coordinates: [[base.lng, base.lat]],
        });
      }
      if (d.ride && d.ride.stopIds.length >= 2 && !seenTrips.has(d.ride.id)) {
        seenTrips.add(d.ride.id);
        const coords = d.ride.stopIds
          .map((id) => NODES[id])
          .filter(Boolean)
          .map((s) => [s.lng, s.lat] as [number, number]);
        if (coords.length >= 2) {
          out.push({ id: `trip-${d.ride.id}`, coordinates: coords });
        }
      }
    }
    return out;
  }, [live]);

  // Mobile sheets.
  const [sheet, setSheet] = useState<"none" | "book" | "auto">("none");

  const openDriverPanel = (id: string) => {
    setSelectedDriverId(id);
    setJoining(false);
  };

  const closePanels = () => {
    setSelectedDriverId(null);
    setJoining(false);
  };

  const handleJoined = () => {
    setJoining(false);
    closePanels();
    void refresh();
    refreshLive();
  };

  return (
    <main className="relative h-dvh w-full overflow-hidden">
      <MapView theme="light" center={[90.4, 23.78]} zoom={11.5}>
        <FitAllRoutes routes={fitRoutes} />
        <DismissOnMapClick onDismiss={closePanels} />
        <MapControls position="bottom-right" className="max-md:bottom-24" />

        {overlay && (
          <TripRoute
            id={overlay.id}
            stopIds={overlay.stopIds}
            dashed={overlay.dashed}
            riders={overlay.riders}
          />
        )}

        <LiveFleet
          data={live}
          dataAt={dataAt}
          selectedDriverId={selectedDriverId}
          onSelect={openDriverPanel}
        />
      </MapView>

      {/* Brand chip (desktop; mobile keeps just the search pill) */}
      <div className="bg-card border-border absolute top-4 left-4 z-20 hidden items-center gap-3 rounded-2xl border px-4 py-3 shadow-lg md:flex">
        <Brand />
        <p className="text-muted-foreground border-border border-l pl-3 text-[11px]">
          Share a seat. Split the fare.
        </p>
      </div>

      {/* BD clock + live fleet chip (bottom-left) */}
      <FleetClockChip nowMin={liveMin} live={live} />

      {/* Desktop: driver card / join sheet (slides in from the left) */}
      <AnimatePresence>
        {selectedDriver && (
          <motion.aside
            key="driver-detail"
            initial={{ x: -340, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -340, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.12, duration: 0.45 }}
            className="bg-card border-border absolute top-20 bottom-4 left-4 z-30 hidden w-[320px] overflow-y-auto rounded-2xl border p-4 shadow-lg md:block"
          >
            {joining ? (
              <JoinRideSheet
                driver={selectedDriver}
                onClose={() => setJoining(false)}
                onJoined={handleJoined}
              />
            ) : (
              <DriverDetailCard
                driver={selectedDriver}
                onClose={closePanels}
                onJoin={() => setJoining(true)}
              />
            )}
          </motion.aside>
        )}
      </AnimatePresence>

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

      {/* Mobile: driver card / join sheet */}
      <MobileSheet
        open={Boolean(selectedDriver) && sheet === "auto"}
        onClose={() => {
          closePanels();
          setSheet("none");
        }}
        label={selectedDriver ? `${selectedDriver.vehicleName} · ${selectedDriver.driverName}` : "Auto details"}
      >
        {selectedDriver &&
          (joining ? (
            <JoinRideSheet
              driver={selectedDriver}
              onClose={() => setJoining(false)}
              onJoined={() => {
                handleJoined();
                setSheet("none");
              }}
            />
          ) : (
            <DriverDetailCard
              driver={selectedDriver}
              onClose={() => {
                closePanels();
                setSheet("none");
              }}
              onJoin={() => setJoining(true)}
            />
          ))}
      </MobileSheet>

      {/* Mobile: booking bottom sheet */}
      <MobileSheet open={sheet === "book"} onClose={() => setSheet("none")} label="Plan a ride">
        <RidePanel />
      </MobileSheet>

      <AppNav />
    </main>
  );
}

/** Tapping empty map closes an open driver card / join sheet. */
function DismissOnMapClick({ onDismiss }: { onDismiss: () => void }) {
  const { map, isLoaded } = useMap();
  useEffect(() => {
    if (!map || !isLoaded) return;
    const handler = (e: { originalEvent?: { target?: unknown } }) => {
      // MapLibre also fires a map click when a marker is tapped, which would
      // close the card the marker just opened. Ignore clicks on sprites.
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

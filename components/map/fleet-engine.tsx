"use client";

import { useEffect, useMemo, useRef } from "react";
import * as MapLibreGL from "maplibre-gl";
import { useMap } from "@/components/ui/map";
import {
  pointAtFraction,
  routeLengthKm,
  sliceAtFraction,
} from "@/lib/route";
import {
  buildShiftSegments,
  buildTripPlan,
  hashSeed,
  minutesUntilShiftEnd,
  segmentAt,
  shiftElapsedSec,
  tripFractionAt,
  type BdClockAnchor,
  type FleetAutoDef,
  type FleetLiveStatus,
  type FleetPhase,
  type FleetSegment,
  type FleetShift,
  type StationaryAutoDef,
  type TripPlan,
} from "@/lib/fleet";
import type { RouteData } from "@/lib/route";

/**
 * One demo auto living its BD-clock lifecycle: parked at the start of a
 * shift, waiting at a stand for passengers, carrying them along a real
 * corridor (stop-and-go), arriving, waiting at the other end, and so on
 * until the shift ends and it parks for good — the workspace unmounts it
 * once the roster says it is off duty.
 *
 * The lifecycle is a pure function of the Bangladesh clock (segments built
 * by lib/fleet.ts), so reloading at the same BD second resumes the exact
 * same phase and trip progress instead of starting over.
 *
 * Every visual transition fades: the sprite eases in when the shift starts,
 * lines dissolve when a trip ends or the line rotation swaps, and the sprite
 * fades out before the workspace removes it, so handovers read as flow
 * rather than popping.
 */
const MIN_TRIP_S = 480; // every trip takes at least 8 demo minutes
const FREE_SPEED_KM_PER_S = 0.06; // cap so long corridors don't fly

/** Sprite/line fade duration (ms) — matches the line-opacity transition. */
const FADE_MS = 450;
/** A shift-ending auto fades out this many BD minutes before duty ends. */
const EXIT_FADE_MIN = 0.15;

/** How much of the heading must point along +x/-x before the sprite flips. */
const FLIP_COS_THRESHOLD = 0.35;
/** Max tilt (deg) applied so the sprite leans into the road's direction. */
const MAX_TILT = 30;

const BADGE_COLORS: Record<FleetPhase, string> = {
  carrying: "#2563eb",
  waiting: "#f59e0b",
  parked: "#71717a",
};

const lineFeature = (coordinates: [number, number][]) => ({
  type: "Feature" as const,
  properties: {},
  geometry: {
    type: "LineString" as const,
    coordinates: coordinates.length >= 2 ? coordinates : [],
  },
});

/** Apply the shared badge colors + pulse for a lifecycle phase. */
function styleBadge(
  dot: HTMLSpanElement | null,
  ping: HTMLSpanElement | null,
  phase: FleetPhase,
) {
  if (dot) dot.style.backgroundColor = BADGE_COLORS[phase];
  if (ping) ping.style.display = phase === "waiting" ? "block" : "none";
}

export function FleetAuto({
  def,
  shift,
  shiftIndex,
  route,
  selected,
  showLine,
  onSelect,
  clockRef,
  statusRef,
}: {
  def: FleetAutoDef;
  shift: FleetShift;
  shiftIndex: number;
  /** Road geometry of the auto's corridor, from stand A to stand B. */
  route: RouteData;
  selected: boolean;
  /** Part of the current 2–3 line rotation; keeps the map uncluttered. */
  showLine: boolean;
  onSelect: (id: string) => void;
  /** BD clock anchor, kept current by the workspace. */
  clockRef: React.RefObject<BdClockAnchor>;
  /** Workspace-owned ref the detail panel polls for live state. */
  statusRef: React.RefObject<FleetLiveStatus>;
}) {
  const { map, isLoaded } = useMap();
  const routeKm = useMemo(
    () => routeLengthKm(route.coordinates),
    [route.coordinates],
  );
  // Paced so the whole corridor takes at least 8 minutes regardless of its
  // length: short hops crawl like a loaded CNG, long runs don't fly.
  const tripSeconds = useMemo(
    () => Math.max(MIN_TRIP_S, routeKm / FREE_SPEED_KM_PER_S),
    [routeKm],
  );
  // The deterministic shift timeline — same BD second, same state, always.
  const segments = useMemo(
    () => buildShiftSegments(def.id, shiftIndex, shift, tripSeconds),
    [def.id, shiftIndex, shift, tripSeconds],
  );

  const markerRef = useRef<MapLibreGL.Marker | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const spriteRef = useRef<HTMLImageElement | null>(null);
  const badgeDotRef = useRef<HTMLSpanElement | null>(null);
  const badgePingRef = useRef<HTMLSpanElement | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const phaseRef = useRef<FleetPhase>("parked");
  const progressRef = useRef(0);
  const coordsRef = useRef<[number, number][]>(route.coordinates);
  const facingRef = useRef<"east" | "west">("east");
  const headingVecRef = useRef<[number, number]>([1, 0]);
  const lastPosRef = useRef<[number, number] | null>(null);
  const selectedRef = useRef(selected);
  const showLineRef = useRef(showLine);
  /** Whether the covered slice may be on the map right now. */
  const coveredVisibleRef = useRef(false);
  /** Pending line-hide timers per key, so a re-show cancels the wipe. */
  const fadeTimersRef = useRef<Record<string, number>>({});
  /** Set once the shift-end fade-out has run. */
  const fadedOutRef = useRef(false);
  /** Identity of the segment currently painted on the map. */
  const segKeyRef = useRef("");
  /** Seeded stop-and-go plans + oriented geometry, cached per trip. */
  const tripPlansRef = useRef(new Map<number, TripPlan>());
  const orientedRef = useRef(new Map<number, [number, number][]>());

  const fullSourceId = `fleet-line-${def.id}`;
  const fullLayerId = `fleet-line-${def.id}-layer`;
  const coveredSourceId = `fleet-covered-${def.id}`;
  const coveredLayerId = `fleet-covered-${def.id}-layer`;

  const setPhase = (phase: FleetPhase) => {
    phaseRef.current = phase;
    statusRef.current = {
      ...statusRef.current,
      phase,
      progress: phase === "carrying" ? statusRef.current.progress : 0,
    };
    styleBadge(badgeDotRef.current, badgePingRef.current, phase);
  };

  /** Write the trip endpoints shown in the detail panel. */
  const setStatusTrip = (
    fromName: string,
    toName: string,
    standName: string,
  ) => {
    statusRef.current = {
      ...statusRef.current,
      fromName,
      toName,
      standName,
    };
  };

  const planFor = (tripIndex: number): TripPlan => {
    let plan = tripPlansRef.current.get(tripIndex);
    if (!plan) {
      plan = buildTripPlan(
        def.id,
        shiftIndex,
        tripIndex,
        tripSeconds,
        routeKm,
      );
      tripPlansRef.current.set(tripIndex, plan);
    }
    return plan;
  };

  const orientedFor = (tripIndex: number, dir: 1 | -1) => {
    let coords = orientedRef.current.get(tripIndex);
    if (!coords) {
      coords =
        dir === 1 ? route.coordinates : [...route.coordinates].reverse();
      orientedRef.current.set(tripIndex, coords);
    }
    return coords;
  };

  /** Fade a line's opacity and swap its geometry. Hides dissolve: the data is
   * wiped only after the fade, and a re-show cancels the pending wipe. */
  const paintLine = (
    key: string,
    layerId: string,
    sourceId: string,
    show: boolean,
    coords: [number, number][],
    opacity: number,
    width: number,
  ) => {
    if (!map || !map.getLayer(layerId)) return;
    const source = map.getSource(sourceId) as
      | MapLibreGL.GeoJSONSource
      | undefined;
    if (!source) return;
    const pending = fadeTimersRef.current[key];
    if (pending) {
      window.clearTimeout(pending);
      delete fadeTimersRef.current[key];
    }
    map.setPaintProperty(layerId, "line-opacity-transition", {
      duration: FADE_MS,
      delay: 0,
    });
    map.setPaintProperty(layerId, "line-width-transition", {
      duration: FADE_MS,
      delay: 0,
    });
    map.setPaintProperty(layerId, "line-opacity", show ? opacity : 0);
    map.setPaintProperty(layerId, "line-width", width);
    if (show) {
      source.setData(lineFeature(coords));
    } else {
      const timer = window.setTimeout(() => {
        delete fadeTimersRef.current[key];
        try {
          (
            map.getSource(sourceId) as MapLibreGL.GeoJSONSource | undefined
          )?.setData(lineFeature([]));
        } catch {
          // layer may be gone mid-fade
        }
      }, FADE_MS + 100);
      fadeTimersRef.current[key] = timer;
    }
  };

  /** Cancel every pending line-hide wipe (used before a layer teardown). */
  const clearAllFadeTimers = () => {
    for (const key of Object.keys(fadeTimersRef.current)) {
      window.clearTimeout(fadeTimersRef.current[key]);
      delete fadeTimersRef.current[key];
    }
  };

  /** Bring both lines in line with the current phase + line rotation. Route
   * info exists only while the auto is running an actual trip — waiting and
   * parked autos stay clean, even when selected. */
  const syncLines = () => {
    const carrying = phaseRef.current === "carrying";
    const fullShow = carrying && (showLineRef.current || selectedRef.current);
    paintLine(
      "full",
      fullLayerId,
      fullSourceId,
      fullShow,
      coordsRef.current,
      selectedRef.current ? 0.95 : 0.35,
      selectedRef.current ? 6 : 4,
    );
    const coveredShow = carrying && (showLineRef.current || selectedRef.current);
    if (coveredShow !== coveredVisibleRef.current) {
      coveredVisibleRef.current = coveredShow;
      paintLine(
        "covered",
        coveredLayerId,
        coveredSourceId,
        coveredShow,
        sliceAtFraction(coordsRef.current, progressRef.current),
        1,
        4,
      );
    }
  };

  /** Paint phase, panel status and lines for a timeline segment. */
  const applySegment = (seg: FleetSegment) => {
    const a = route.fromName;
    const b = route.toName;
    if (seg.kind === "carrying") {
      setPhase("carrying");
      setStatusTrip(
        seg.dir === 1 ? a : b,
        seg.dir === 1 ? b : a,
        seg.dir === 1 ? a : b,
      );
      coordsRef.current = orientedFor(seg.tripIndex, seg.dir);
      progressRef.current = 0; // refined on the next frame
    } else if (seg.kind === "waiting") {
      setPhase("waiting");
      // The panel shows the upcoming trip and the stand being waited at.
      setStatusTrip(
        seg.dir === 1 ? a : b,
        seg.dir === 1 ? b : a,
        seg.stand === "a" ? a : b,
      );
    } else {
      setPhase("parked");
      setStatusTrip(a, b, seg.stand === "a" ? a : b);
    }
    syncLines();
  };

  useEffect(() => {
    selectedRef.current = selected;
    showLineRef.current = showLine;
    syncLines();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, showLine, map, fullLayerId, coveredLayerId]);

  // Marker + line layers, created once the map (and route) is ready.
  useEffect(() => {
    if (!map || !isLoaded || route.coordinates.length < 2) return;

    const wrapper = document.createElement("div");
    wrapper.style.cursor = "pointer";
    // No inline `position`: MapLibre's .maplibregl-marker class positions the
    // wrapper absolutely; overriding it would make markers drift in flow. The
    // wrapper is still a containing block for the absolute badge below.
    // Fade in instead of popping: transition opacity only — transitioning
    // everything would also lag MapLibre's per-frame positioning transform.
    wrapper.style.opacity = "0";
    wrapper.style.transition = `opacity ${FADE_MS}ms ease`;
    const img = document.createElement("img");
    img.src = "/auto.png";
    img.alt = `CNG auto rickshaw ${def.name} on ${route.name}`;
    img.draggable = false;
    img.className =
      "h-9 w-auto max-w-none select-none drop-shadow-[0_3px_5px_rgba(0,0,0,0.35)]";
    // The sprite art faces left; routes generally head east.
    img.style.transform = "scaleX(-1)";
    wrapper.appendChild(img);

    // Lifecycle badge: a small dot under the sprite (blue on a trip, amber
    // waiting at a stand, gray parked), pulsing while waiting for a fare.
    const badge = document.createElement("span");
    badge.style.cssText =
      "position:absolute;right:-1px;bottom:-2px;width:10px;height:10px;";
    const ping = document.createElement("span");
    ping.className = "animate-ping";
    ping.style.cssText =
      "position:absolute;inset:0;border-radius:9999px;opacity:0.6;display:none;";
    badge.appendChild(ping);
    const dot = document.createElement("span");
    dot.style.cssText =
      "position:absolute;inset:0;border-radius:9999px;border:1.5px solid rgba(255,255,255,0.9);";
    badge.appendChild(dot);
    wrapper.appendChild(badge);
    badgeDotRef.current = dot;
    badgePingRef.current = ping;

    const marker = new MapLibreGL.Marker({ element: wrapper })
      .setLngLat(route.coordinates[0])
      .addTo(map);
    requestAnimationFrame(() => {
      wrapper.style.opacity = "1";
    });

    // Tap the auto for its detail panel. Only the MapLibre marker event is
    // used: a DOM click also reaches MapLibre and would toggle twice.
    const handleClick = () => onSelectRef.current(def.id);
    marker.on("click", handleClick);

    map.addSource(fullSourceId, {
      type: "geojson",
      data: lineFeature([]),
    });
    map.addLayer({
      id: fullLayerId,
      type: "line",
      source: fullSourceId,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": def.color,
        "line-width": 4,
        "line-opacity": 0,
      },
    });
    map.addSource(coveredSourceId, {
      type: "geojson",
      data: lineFeature([]),
    });
    map.addLayer({
      id: coveredLayerId,
      type: "line",
      source: coveredSourceId,
      layout: { "line-join": "round", "line-cap": "round" },
      paint: {
        "line-color": def.color,
        "line-width": 4,
        "line-opacity": 0,
      },
    });

    markerRef.current = marker;
    wrapperRef.current = wrapper;
    spriteRef.current = img;
    facingRef.current = "east";
    headingVecRef.current = [1, 0];
    lastPosRef.current = route.coordinates[0];

    // Jump straight to the deterministic state for this BD moment.
    const seg = segmentAt(
      segments,
      shiftElapsedSec(shift, clockRef.current?.bdSec ?? 0),
    );
    segKeyRef.current =
      seg.kind === "parked"
        ? `p:${seg.stand}`
        : `${seg.kind}:${seg.tripIndex}`;
    applySegment(seg);

    return () => {
      marker.off("click", handleClick);
      marker.remove();
      clearAllFadeTimers();
      try {
        if (map.getLayer(fullLayerId)) map.removeLayer(fullLayerId);
        if (map.getSource(fullSourceId)) map.removeSource(fullSourceId);
        if (map.getLayer(coveredLayerId)) map.removeLayer(coveredLayerId);
        if (map.getSource(coveredSourceId))
          map.removeSource(coveredSourceId);
      } catch {
        // style may be mid-reload
      }
      markerRef.current = null;
      wrapperRef.current = null;
      spriteRef.current = null;
      badgeDotRef.current = null;
      badgePingRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isLoaded, route, shift, shiftIndex, segments]);

  // Repaint loop — everything derives from the BD clock, so the rAF loop only
  // projects the current deterministic state onto the map each frame.
  useEffect(() => {
    if (route.coordinates.length < 2) return;

    const raf = { id: 0 };
    const tick = () => {
      raf.id = requestAnimationFrame(tick);
      const anchor = clockRef.current ?? { bdSec: 0, unixMs: Date.now() };
      // Interpolate between clock ticks (≤1.2 s) for smooth motion.
      const nowBd =
        anchor.bdSec +
        Math.min(1.2, Math.max(0, (Date.now() - anchor.unixMs) / 1000));
      const elapsed = shiftElapsedSec(shift, nowBd);
      const seg = segmentAt(segments, elapsed);

      const key =
        seg.kind === "parked"
          ? `p:${seg.stand}`
          : `${seg.kind}:${seg.tripIndex}`;
      if (key !== segKeyRef.current) {
        segKeyRef.current = key;
        applySegment(seg);
      }

      // Soft handover: fade the sprite away in the shift's final moments so
      // the workspace's unmount at shift end never pops it out of view.
      if (
        !fadedOutRef.current &&
        minutesUntilShiftEnd(shift, nowBd / 60) <= EXIT_FADE_MIN
      ) {
        fadedOutRef.current = true;
        if (wrapperRef.current) wrapperRef.current.style.opacity = "0";
      }

      const carrying = seg.kind === "carrying";
      let f = 0;
      let pos: [number, number];
      if (carrying) {
        f = tripFractionAt(planFor(seg.tripIndex), elapsed - seg.startSec);
        progressRef.current = f;
        coordsRef.current = orientedFor(seg.tripIndex, seg.dir);
        pos = pointAtFraction(coordsRef.current, f) ?? lastPosRef.current ?? route.coordinates[0];
      } else {
        progressRef.current = 0;
        pos =
          seg.stand === "a"
            ? route.coordinates[0]
            : route.coordinates[route.coordinates.length - 1];
      }

      const marker = markerRef.current;
      if (marker) marker.setLngLat(pos);

      // Heading, smoothed, in screen space (y down): flip the sprite only on
      // clear horizontal travel, tilt into the road's direction.
      const sprite = spriteRef.current;
      const prev = lastPosRef.current;
      lastPosRef.current = pos;
      if (carrying && prev && sprite) {
        const dLng = (pos[0] - prev[0]) * Math.cos((pos[1] * Math.PI) / 180);
        const dLat = pos[1] - prev[1];
        if (Math.hypot(dLng, dLat) > 1e-9) {
          const heading = Math.atan2(-dLat, dLng);
          headingVecRef.current = [
            headingVecRef.current[0] * 0.82 + Math.cos(heading) * 0.18,
            headingVecRef.current[1] * 0.82 + Math.sin(heading) * 0.18,
          ];
          const smooth =
            Math.atan2(headingVecRef.current[1], headingVecRef.current[0]) *
            (180 / Math.PI);

          if (
            Math.cos((smooth * Math.PI) / 180) > FLIP_COS_THRESHOLD &&
            facingRef.current !== "east"
          ) {
            facingRef.current = "east";
          } else if (
            Math.cos((smooth * Math.PI) / 180) < -FLIP_COS_THRESHOLD &&
            facingRef.current !== "west"
          ) {
            facingRef.current = "west";
          }

          let rel = smooth - (facingRef.current === "west" ? 180 : 0);
          if (rel > 180) rel -= 360;
          if (rel < -180) rel += 360;
          const tilt = Math.max(-MAX_TILT, Math.min(MAX_TILT, rel));

          sprite.style.transform =
            facingRef.current === "east"
              ? `scaleX(-1) rotate(${(-tilt).toFixed(1)}deg)`
              : `rotate(${tilt.toFixed(1)}deg)`;
        }
      }

      // Only write the covered slice while it is allowed on the map; hides
      // are owned by syncLines' fade.
      if (carrying && coveredVisibleRef.current) {
        const covered = map?.getSource(coveredSourceId) as
          | MapLibreGL.GeoJSONSource
          | undefined;
        covered?.setData(lineFeature(sliceAtFraction(coordsRef.current, f)));
      }
      statusRef.current = {
        ...statusRef.current,
        progress: carrying ? f : 0,
      };
    };

    raf.id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, tripSeconds, segments, shift, map]);

  return null;
}

/**
 * An auto that never leaves its stand: always on the map at a real spot,
 * cycling between waiting and parked phases on a seeded BD-clock schedule.
 */
export function StationaryAuto({
  def,
  clockRef,
  onSelect,
  statusRef,
}: {
  def: StationaryAutoDef;
  clockRef: React.RefObject<BdClockAnchor>;
  onSelect: (id: string) => void;
  statusRef: React.RefObject<FleetLiveStatus>;
}) {
  const { map, isLoaded } = useMap();

  const badgeDotRef = useRef<HTMLSpanElement | null>(null);
  const badgePingRef = useRef<HTMLSpanElement | null>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  /** Deterministic phase-cycle length: 5–9 minutes per bucket. */
  const cycleSec = useMemo(() => 300 + (hashSeed(def.id) % 240), [def.id]);
  const lastBucketRef = useRef(-1);

  useEffect(() => {
    if (!map || !isLoaded) return;

    const wrapper = document.createElement("div");
    wrapper.style.cursor = "pointer";
    wrapper.style.opacity = "0";
    wrapper.style.transition = `opacity ${FADE_MS}ms ease`;
    const img = document.createElement("img");
    img.src = "/auto.png";
    img.alt = `CNG auto rickshaw ${def.name} parked at ${def.at.name}`;
    img.draggable = false;
    img.className =
      "h-9 w-auto max-w-none select-none drop-shadow-[0_3px_5px_rgba(0,0,0,0.35)]";
    img.style.transform = "scaleX(-1)";
    wrapper.appendChild(img);

    const badge = document.createElement("span");
    badge.style.cssText =
      "position:absolute;right:-1px;bottom:-2px;width:10px;height:10px;";
    const ping = document.createElement("span");
    ping.className = "animate-ping";
    ping.style.cssText =
      "position:absolute;inset:0;border-radius:9999px;opacity:0.6;";
    badge.appendChild(ping);
    const dot = document.createElement("span");
    dot.style.cssText =
      "position:absolute;inset:0;border-radius:9999px;border:1.5px solid rgba(255,255,255,0.9);";
    badge.appendChild(dot);
    wrapper.appendChild(badge);
    badgeDotRef.current = dot;
    badgePingRef.current = ping;

    const marker = new MapLibreGL.Marker({ element: wrapper })
      .setLngLat([def.at.lng, def.at.lat])
      .addTo(map);
    requestAnimationFrame(() => {
      wrapper.style.opacity = "1";
    });

    const handleClick = () => onSelectRef.current(def.id);
    marker.on("click", handleClick);

    return () => {
      marker.off("click", handleClick);
      marker.remove();
      badgeDotRef.current = null;
      badgePingRef.current = null;
    };
  }, [map, isLoaded, def]);

  useEffect(() => {
    const raf = { id: 0 };
    const tick = () => {
      raf.id = requestAnimationFrame(tick);
      const bdSec = clockRef.current?.bdSec ?? 0;
      const bucket = Math.floor(bdSec / cycleSec);
      if (bucket === lastBucketRef.current) return;
      lastBucketRef.current = bucket;
      // 2 of every 3 buckets waiting for fares, 1 parked with the engine off.
      const phase: FleetPhase = bucket % 3 === 0 ? "parked" : "waiting";
      statusRef.current = {
        phase,
        progress: 0,
        fromName: def.at.name,
        toName: def.at.name,
        standName: def.at.name,
      };
      styleBadge(badgeDotRef.current, badgePingRef.current, phase);
    };
    raf.id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.id);
  }, [cycleSec, def, clockRef, statusRef]);

  return null;
}

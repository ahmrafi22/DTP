"use client";

import { useEffect, useRef } from "react";
import { useMap } from "@/components/ui/map";

/**
 * Frames the world the fleet lives in: every driver's base plus every running
 * trip's path. Refits only when the set of framed ids changes — never on
 * progress ticks, and never once the user has panned or zoomed themselves.
 */
export function FitAllRoutes({
  routes,
}: {
  routes: { id: string; coordinates: [number, number][] }[];
}) {
  const { map, isLoaded } = useMap();
  const lastFitRef = useRef<string | null>(null);
  const userMovedRef = useRef(false);

  useEffect(() => {
    if (!map || !isLoaded) return;
    // Genuine user input on the canvas — programmatic fitBounds never fires
    // these, so scheduled refits don't disable themselves.
    const canvas = map.getCanvas();
    const markMoved = () => {
      userMovedRef.current = true;
    };
    canvas.addEventListener("mousedown", markMoved);
    canvas.addEventListener("wheel", markMoved, { passive: true });
    canvas.addEventListener("touchstart", markMoved, { passive: true });
    return () => {
      canvas.removeEventListener("mousedown", markMoved);
      canvas.removeEventListener("wheel", markMoved);
      canvas.removeEventListener("touchstart", markMoved);
    };
  }, [map, isLoaded]);

  useEffect(() => {
    if (!map || !isLoaded) return;
    const points = routes.flatMap((r) => r.coordinates);
    if (points.length < 2) return;

    const signature = routes
      .map((r) => r.id)
      .sort()
      .join("|");
    if (lastFitRef.current === signature || userMovedRef.current) return;
    lastFitRef.current = signature;

    const lons = points.map((c) => c[0]);
    const lats = points.map((c) => c[1]);
    map.fitBounds(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      { padding: 70, duration: 600 },
    );
  }, [map, isLoaded, routes]);

  return null;
}


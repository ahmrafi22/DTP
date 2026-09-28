import routeDefs from "@/data/routes.json";
import { MapWorkspace } from "@/components/map/workspace";
import type { RouteData, RouteDefinition } from "@/lib/route";

// Refresh the prerendered routes hourly instead of pinning build-time data.
export const revalidate = 3600;

const OSRM_TIMEOUT_MS = 10000;

async function fetchDestination(def: Extract<RouteDefinition, { type: "destination" }>): Promise<RouteData> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${def.from.lng},${def.from.lat};${def.to.lng},${def.to.lat}` +
    `?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(OSRM_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`OSRM responded with ${res.status}`);
    const json = await res.json();
    const route = json?.routes?.[0];
    if (!route?.geometry?.coordinates?.length) {
      throw new Error("OSRM returned no route");
    }
    return {
      id: def.id,
      name: def.name,
      color: def.color,
      kind: "destination",
      fromName: def.from.name,
      toName: def.to.name,
      coordinates: route.geometry.coordinates,
      distance: route.distance ?? null,
      duration: route.duration ?? null,
      approximate: false,
    };
  } catch {
    return {
      id: def.id,
      name: def.name,
      color: def.color,
      kind: "destination",
      fromName: def.from.name,
      toName: def.to.name,
      coordinates: [
        [def.from.lng, def.from.lat],
        [def.to.lng, def.to.lat],
      ],
      distance: null,
      duration: null,
      approximate: true,
    };
  }
}

/** A roaming loop: drive through every waypoint, then repeat forever. */
async function fetchWander(def: Extract<RouteDefinition, { type: "wander" }>): Promise<RouteData> {
  const points = [...def.waypoints, def.waypoints[0]];
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${points.map((w) => `${w.lng},${w.lat}`).join(";")}` +
    `?overview=full&geometries=geojson`;

  const straightLine = points.map((w) => [w.lng, w.lat] as [number, number]);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(OSRM_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`OSRM responded with ${res.status}`);
    const json = await res.json();
    const route = json?.routes?.[0];
    if (!route?.geometry?.coordinates?.length) {
      throw new Error("OSRM returned no route");
    }
    return {
      id: def.id,
      name: def.name,
      color: def.color,
      kind: "wander",
      fromName: def.waypoints[0].name,
      toName: def.waypoints.map((w) => w.name).join(" → "),
      coordinates: route.geometry.coordinates,
      distance: route.distance ?? null,
      duration: route.duration ?? null,
      approximate: false,
    };
  } catch {
    return {
      id: def.id,
      name: def.name,
      color: def.color,
      kind: "wander",
      fromName: def.waypoints[0].name,
      toName: def.waypoints.map((w) => w.name).join(" → "),
      coordinates: straightLine,
      distance: null,
      duration: null,
      approximate: true,
    };
  }
}

/** A parked auto: snap the parking spot to the nearest road. */
async function fetchStationary(def: Extract<RouteDefinition, { type: "stationary" }>): Promise<RouteData> {
  const base = {
    id: def.id,
    name: def.name,
    color: def.color,
    kind: "stationary" as const,
    fromName: def.at.name,
    toName: def.at.name,
    distance: null,
    duration: null,
    approximate: true,
  };

  try {
    const res = await fetch(
      `https://router.project-osrm.org/nearest/v1/driving/${def.at.lng},${def.at.lat}?number=1`,
      { signal: AbortSignal.timeout(OSRM_TIMEOUT_MS) },
    );
    if (!res.ok) throw new Error(`OSRM responded with ${res.status}`);
    const json = await res.json();
    const location = json?.waypoints?.[0]?.location;
    if (!Array.isArray(location) || location.length < 2) {
      throw new Error("OSRM returned no snapped point");
    }
    return {
      ...base,
      coordinates: [[location[0], location[1]] as [number, number]],
      approximate: false,
    };
  } catch {
    return { ...base, coordinates: [[def.at.lng, def.at.lat] as [number, number]] };
  }
}

export default async function Home() {
  const routes: RouteData[] = await Promise.all(
    (routeDefs as RouteDefinition[]).map((def) => {
      if (def.type === "wander") return fetchWander(def);
      if (def.type === "stationary") return fetchStationary(def);
      return fetchDestination(def);
    }),
  );
  return <MapWorkspace routes={routes} />;
}

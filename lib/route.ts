export type RouteEndpoint = {
  name: string;
  lng: number;
  lat: number;
};

export type RouteKind = "destination" | "wander" | "stationary";

/** One entry in data/routes.json. */
export type RouteDefinition =
  | {
      id: string;
      name: string;
      color: string;
      type: "destination";
      from: RouteEndpoint;
      to: RouteEndpoint;
    }
  | {
      id: string;
      name: string;
      color: string;
      type: "wander";
      /** Waypoints of the roaming loop; the first one closes the circle. */
      waypoints: RouteEndpoint[];
    }
  | {
      id: string;
      name: string;
      color: string;
      type: "stationary";
      at: RouteEndpoint;
    };

/** A route definition with its road geometry resolved. */
export type RouteData = {
  id: string;
  name: string;
  color: string;
  kind: RouteKind;
  fromName: string;
  toName: string;
  /** [longitude, latitude] pairs along the route; a single point when parked */
  coordinates: [number, number][];
  /** Meters, when the routing service responded */
  distance: number | null;
  /** Seconds, when the routing service responded */
  duration: number | null;
  /** True when the routing service failed and this is a straight line */
  approximate: boolean;
};

/**
 * Cumulative distance from the first coordinate to each vertex, using an
 * equirectangular approximation (longitude scaled by cos of latitude) —
 * accurate enough to position a vehicle along the route.
 */
function measureRoute(coordinates: [number, number][]) {
  const cumulative = [0];
  let total = 0;
  for (let i = 1; i < coordinates.length; i += 1) {
    const [lng1, lat1] = coordinates[i - 1];
    const [lng2, lat2] = coordinates[i];
    const midLat = ((lat1 + lat2) / 2) * (Math.PI / 180);
    total += Math.hypot((lng2 - lng1) * Math.cos(midLat), lat2 - lat1);
    cumulative.push(total);
  }
  return { cumulative, total };
}

/** Approximate route length in kilometers. */
export function routeLengthKm(coordinates: [number, number][]): number {
  const { total } = measureRoute(coordinates);
  return total * 111.19; // degrees of arc → kilometers
}

/** Index of the segment containing `distance` along the measured route. */
function findSegmentIndex(cumulative: number[], distance: number) {
  let low = 0;
  let high = cumulative.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (cumulative[mid] < distance) low = mid + 1;
    else high = mid;
  }
  return Math.min(low === 0 ? 0 : low - 1, cumulative.length - 2);
}

/** The [longitude, latitude] at `fraction` (0–1) along the route, or null. */
export function pointAtFraction(
  coordinates: [number, number][],
  fraction: number,
): [number, number] | null {
  if (coordinates.length === 0) return null;
  if (coordinates.length === 1) return coordinates[0];

  const clamped = Math.min(1, Math.max(0, fraction));
  const { cumulative, total } = measureRoute(coordinates);
  if (total === 0) return coordinates[0];

  const target = total * clamped;
  const index = findSegmentIndex(cumulative, target);

  const [lng1, lat1] = coordinates[index];
  const [lng2, lat2] = coordinates[index + 1];
  const segment = cumulative[index + 1] - cumulative[index];
  const ratio = segment === 0 ? 0 : (target - cumulative[index]) / segment;
  return [lng1 + (lng2 - lng1) * ratio, lat1 + (lat2 - lat1) * ratio];
}

/**
 * The driven portion of the route: every vertex from the start up to
 * `fraction` (0–1), with the final point interpolated so the slice ends
 * exactly at the fraction rather than at the nearest vertex.
 */
export function sliceAtFraction(
  coordinates: [number, number][],
  fraction: number,
): [number, number][] {
  if (coordinates.length < 2) return [];

  const clamped = Math.min(1, Math.max(0, fraction));
  const { cumulative, total } = measureRoute(coordinates);
  if (total === 0 || clamped <= 0) return [];
  if (clamped >= 1) return coordinates;

  const target = total * clamped;
  const index = findSegmentIndex(cumulative, target);
  const point = pointAtFraction(coordinates, clamped);

  const traveled = coordinates.slice(0, index + 1);
  if (point) traveled.push(point);
  return traveled;
}

/**
 * API client for the Express backend (Dhaka Tesla Pool).
 *
 * The backend is the source of truth for sessions, rides, trips and fares —
 * this module is the single seam: every call the UI makes to the server goes
 * through here. JWT is kept in localStorage for the demo (documented
 * trade-off; httpOnly cookies would be the production choice).
 *
 * Every endpoint the backend exposes has a function here, so a new server
 * route is never silently unreachable from the UI.
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const TOKEN_KEY = "dtp-token";

export const getToken = () =>
  typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_KEY);

export const setToken = (token: string | null) => {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
};

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type Method = "GET" | "POST";

async function request<T>(
  method: Method,
  path: string,
  options: { body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const token = options.auth === false ? null : getToken();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
    });
  } catch {
    // Network-level failure: the API is down or CORS-blocked.
    throw new ApiError(0, "NETWORK", "Could not reach the server. Is the API running?");
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; details?: unknown } } | null)
      ?.error;
    throw new ApiError(
      res.status,
      err?.code ?? "UNKNOWN",
      err?.message ?? `Request failed (${res.status})`,
      err?.details,
    );
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body }),
};

// ---------- types mirroring the backend payloads ----------

export type FareLine = {
  edgeId: string;
  from: string;
  to: string;
  riders: number;
  discountPct: number;
  pricePaisa: number;
  paidPaisa: number;
};

export type Fare = {
  baseFare: number;
  distanceCharge: number;
  poolDiscount: number;
  total: number;
  lines: FareLine[];
};

export type Role = "passenger" | "driver" | "admin";

export type ApiUser = {
  id: string;
  name: string;
  phone: string;
  role: Role;
  homeStopId: string | null;
  isOnline: boolean;
  vehicle?: ApiVehicle | null;
};

export type ApiVehicle = {
  id: string;
  driverId: string;
  name: string;
  capacity: number;
};

export type RideStatus =
  | "REQUESTED"
  | "MATCHED"
  | "DRIVER_ARRIVED"
  | "STARTED"
  | "COMPLETED"
  | "CANCELLED";

export type ApiRequest = {
  id: string;
  passengerId: string;
  rideId: string | null;
  pickupStopId: string;
  dropStopId: string;
  routeId: string | null;
  legIds: string[];
  stopIds: string[];
  seats: number;
  status: RideStatus;
  rating: number | null;
  cancelReason: string | null;
  fare: Fare;
  createdAt: string;
  updatedAt: string;
  /** Only present in the driver's own views. */
  passengerName?: string;
};

/** One line in a ride's audit trail (GET /rides/:id/events, /driver/history). */
export type ApiRideEvent = {
  event: string;
  actorId: string | null;
  at: string;
  meta: Record<string, unknown> | null;
};

export type ApiRide = {
  id: string;
  vehicleId: string;
  status: RideStatus;
  seatsTaken: number;
  capacity: number;
  createdAt: string;
  updatedAt: string;
  /** Present on trips from GET /driver/history. */
  events?: ApiRideEvent[];
  /** Present on the active trip inside GET /driver/state. */
  requests?: ApiRequest[];
};

export type ApiCoRider = {
  id: string;
  firstName: string;
  dropStopId: string;
  status: RideStatus;
};

export type ApiActivePassenger = {
  request: ApiRequest;
  trip?: ApiRide | null;
  vehicle?: { id: string; name: string; capacity: number; driverName: string } | null;
  coRiders?: ApiCoRider[];
} | null;

export type ApiPoolGroup = {
  requestIds: string[];
  seats: number;
  fits: boolean;
  requests: ApiRequest[];
};

export type ApiDriverState = {
  online: boolean;
  vehicle: { id: string; name: string; capacity: number };
  activeTrip: (ApiRide & { requests: ApiRequest[] }) | null;
  pendingGroups: ApiPoolGroup[];
  earnings: { totalPaisa: number; completedTrips: number };
};

export type ApiStop = { id: string; name: string; zone: string; lat: number; lng: number };

export type ApiLeg = {
  id: string;
  from: string;
  to: string;
  km: number;
  durationMin: number;
  pricePaisa: number;
};

export type ApiRoute = { id: string; name: string; corridor: string; stopIds: string[] };

export type ApiNetwork = { stops: ApiStop[]; legs: ApiLeg[]; routes: ApiRoute[] };

/** One priced corridor option returned by POST /fare/estimate. */
export type ApiFareOption = {
  routeId: string | null;
  title: string;
  sub: string;
  legIds: string[];
  stopIds: string[];
  fare: Fare;
};

export type ApiAdminRide = ApiRide & {
  vehicleName: string;
  driverName: string;
  requests: ApiRequest[];
};

// ---------- health ----------

export async function checkHealth() {
  return api.get<{ ok: boolean; service: string; time: string; db?: string }>("/health");
}

// ---------- auth ----------

export async function login(phone: string, password: string) {
  return api.post<{ token: string; user: ApiUser }>("/auth/login", { phone, password });
}

export async function register(body: {
  name: string;
  phone: string;
  password: string;
  role: "passenger" | "driver";
  homeStopId?: string | null;
  vehicleName?: string;
  vehicleCapacity?: number;
}) {
  return api.post<{ token: string; user: ApiUser }>("/auth/register", body);
}

export async function fetchMe() {
  return api.get<{ user: ApiUser }>("/me");
}

// ---------- network + fares ----------

/** The authoritative stop/leg/corridor graph, for pickers and the map. */
export async function fetchNetwork() {
  return api.get<ApiNetwork>("/network");
}

/**
 * Fare estimate for a pickup/drop pair. Omit `routeId` to get every direct
 * corridor option plus a shortest-path fallback — this is the number the
 * passenger sees before confirming, priced by the server.
 */
export async function estimateFare(body: {
  pickupStopId: string;
  dropStopId: string;
  routeId?: string | null;
}) {
  return api.post<{ options: ApiFareOption[] }>("/fare/estimate", body);
}

// ---------- passenger ----------

export async function requestRide(body: {
  pickupStopId: string;
  dropStopId: string;
  routeId?: string | null;
  seats?: number;
  idempotencyKey?: string | null;
}) {
  return api.post<{ request: ApiRequest; replayed: boolean }>("/rides/request", body);
}

export async function fetchMyActive() {
  return api.get<ApiActivePassenger>("/me/active");
}

export async function fetchMyHistory() {
  return api.get<{ requests: ApiRequest[] }>("/me/history");
}

/** One request — the passenger themself, or the driver running the ride. */
export async function fetchRideRequest(id: string) {
  return api.get<{ request: ApiRequest }>(`/rides/${id}`);
}

export async function cancelRide(id: string, reason?: string | null) {
  return api.post<{ request: ApiRequest }>(`/rides/${id}/cancel`, { reason: reason ?? null });
}

export async function rateRide(id: string, rating: number) {
  return api.post<{ request: ApiRequest }>(`/rides/${id}/rate`, { rating });
}

// ---------- driver ----------

export async function fetchDriverState() {
  return api.get<ApiDriverState>("/driver/state");
}

export async function fetchDriverHistory() {
  return api.get<{ trips: ApiRide[] }>("/driver/history");
}

/** Pending poolable groups, without the rest of the driver state payload. */
export async function fetchDriverRequests() {
  return api.get<{ groups: ApiPoolGroup[] }>("/driver/requests");
}

export async function setDriverOnline(online: boolean) {
  return api.post<{ online: boolean }>("/driver/online", { online });
}

export async function acceptRequests(requestIds: string[]) {
  return api.post<{ ride: ApiRide; requests: ApiRequest[] }>("/rides/accept", { requestIds });
}

/** Add a pending request to a running trip — the mid-trip joiner (PRD §5). */
export async function joinRide(rideId: string, requestId: string) {
  return api.post<{ ride: ApiRide; request: ApiRequest }>(`/rides/${rideId}/join`, { requestId });
}

export type TripAction = "arrived" | "start" | "complete";

export async function advanceRide(rideId: string, action: TripAction) {
  return api.post<{ ride: ApiRide }>(`/rides/${rideId}/${action}`);
}

/** The audit trail for a ride. */
export async function fetchRideEvents(rideId: string) {
  return api.get<{ events: ApiRideEvent[] }>(`/rides/${rideId}/events`);
}

// ---------- admin ----------

export async function fetchAdminRides() {
  return api.get<{ rides: ApiAdminRide[] }>("/admin/rides");
}

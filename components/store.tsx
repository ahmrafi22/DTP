"use client";

/**
 * Client store backed by the Express/Postgres backend (lib/api.ts).
 *
 * The server is the source of truth for sessions, rides, trips and fares;
 * this store keeps a mirror for rendering and polls the polling endpoints
 * (GET /me/active, GET /driver/state) every few seconds so every client sees
 * lifecycle changes without sockets.
 *
 * The legacy `dispatch` shim is kept so UI call sites read the same as
 * before — each action now maps to an API call and a refresh, not local
 * mutation. The predefined cast below only powers demo logins and display
 * lookups; real accounts live in the database.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  acceptRequests as apiAcceptRequests,
  admitRider as apiAdmitRider,
  advanceRide as apiAdvanceRide,
  cancelRide as apiCancelRide,
  fetchAdminRides,
  fetchDriverHistory,
  fetchDriverState,
  fetchMe,
  fetchMyActive,
  fetchMyHistory,
  fetchNetwork,
  getToken,
  login as apiLogin,
  rateRide as apiRateRide,
  register as apiRegister,
  requestRide as apiRequestRide,
  setDriverOnline as apiSetDriverOnline,
  setToken,
  type ApiActivePassenger,
  type ApiAdminRide,
  type ApiDriverState,
  type ApiNetwork,
  type ApiRequest,
  type ApiRide,
  type ApiRideEvent,
  type ApiUser,
} from "@/lib/api";
import {
  getEdge,
  legsBetween,
  priceLegs,
  type Fare,
  type FareLine,
} from "@/lib/network";

export type { Fare, FareLine };

// ---------- domain types (mirror the API payloads) ----------

export type Role = "passenger" | "driver" | "admin";

export type Persona = {
  id: string;
  name: string;
  role: Role;
  phone: string;
  homeStopId: string;
  /** Habitual destination — the booking form prefills it. */
  usualDropStopId: string | null;
};

export type Vehicle = {
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

/** Cancellable from REQUESTED through DRIVER_ARRIVED (PRD §4). */
export const isCancellable = (status: RideStatus) =>
  status === "REQUESTED" ||
  status === "MATCHED" ||
  status === "DRIVER_ARRIVED";

export const isActive = (status: RideStatus) =>
  status === "REQUESTED" ||
  status === "MATCHED" ||
  status === "DRIVER_ARRIVED" ||
  status === "STARTED";

export type RideRequest = {
  id: string;
  passengerId: string;
  pickupStopId: string;
  dropStopId: string;
  routeId: string | null;
  legIds: string[];
  stopIds: string[];
  status: RideStatus;
  tripId: string | null;
  fare: Fare;
  createdAt: string;
  updatedAt: string;
  rating?: number;
  cancelReason?: string;
  /** First name from the server (works for non-cast users too). */
  passengerName?: string;
};

export type TripEvent = {
  event: string;
  at: string;
  actorId: string | null;
  meta: Record<string, unknown> | null;
};

export type Trip = {
  id: string;
  vehicleId: string;
  status: RideStatus;
  requestIds: string[];
  seatsTaken: number;
  capacity: number;
  events: TripEvent[];
};

export type DtpState = {
  sessionPersonaId: string | null;
  onlineDriverIds: string[];
  requests: RideRequest[];
  trips: Trip[];
};

// ---------- demo cast (seeded accounts on the backend) ----------

export const PERSONAS: Persona[] = [
  { id: "nusrat", name: "Nusrat", role: "passenger", phone: "+880 171 0001001", homeStopId: "banani", usualDropStopId: "mohakhali" },
  { id: "rafiq", name: "Rafiq", role: "passenger", phone: "+880 171 0001002", homeStopId: "banani", usualDropStopId: "gulshan1" },
  { id: "shirin", name: "Shirin", role: "passenger", phone: "+880 171 0001003", homeStopId: "gulshan1", usualDropStopId: "banani" },
  { id: "jashim", name: "Jashim", role: "driver", phone: "+880 181 0002001", homeStopId: "mirpur10", usualDropStopId: null },
  { id: "kabir", name: "Kabir", role: "driver", phone: "+880 181 0002002", homeStopId: "uttara_hb", usualDropStopId: null },
];

export const VEHICLES: Vehicle[] = [
  { id: "bullet", driverId: "jashim", name: "Bullet", capacity: 3 },
  { id: "rocket", driverId: "kabir", name: "Rocket", capacity: 3 },
];

export const DEMO_PASSWORD = "demo1234";

export const personaById = (id: string | null) =>
  PERSONAS.find((p) => p.id === id) ?? null;

export const vehicleByDriver = (driverId: string) =>
  VEHICLES.find((v) => v.driverId === driverId) ?? null;

export const STATUS_LABEL: Record<RideStatus, string> = {
  REQUESTED: "Finding a driver",
  MATCHED: "Driver on the way",
  DRIVER_ARRIVED: "Driver arrived",
  STARTED: "On the trip",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const REQUEST_STAGES: RideStatus[] = [
  "REQUESTED",
  "MATCHED",
  "DRIVER_ARRIVED",
  "STARTED",
  "COMPLETED",
];

// ---------- fare + grouping helpers (instant display; the API re-prices) ----------

/** Solo fare for a set of legs (what the passenger sees before pooling). */
export function estimateFare(legIds: string[]): Fare {
  const legs = legIds.map((id) => getEdge(...(id.split("~") as [string, string]))!);
  return priceLegs(legs);
}

/** Greedy grouping: pending requests that share a leg ride the same Tesla. */
export function groupPoolable(requests: RideRequest[]): RideRequest[][] {
  const groups: RideRequest[][] = [];
  for (const req of requests) {
    const group = groups.find((g) =>
      g.some((m) => m.legIds.some((id) => req.legIds.includes(id))),
    );
    if (group) group.push(req);
    else groups.push([req]);
  }
  return groups;
}

export { legsBetween };

// ---------- server → store adapters ----------

const toRideRequest = (r: ApiRequest): RideRequest => ({
  ...r,
  status: r.status as RideStatus,
  tripId: r.rideId,
  rating: r.rating ?? undefined,
  cancelReason: r.cancelReason ?? undefined,
});

/** Adapt a raw API request for display components. */
export const adaptRequest = toRideRequest;

const toTripEvents = (events: ApiRideEvent[] | undefined): TripEvent[] =>
  (events ?? []).map((e) => ({
    event: e.event,
    at: e.at,
    actorId: e.actorId,
    meta: e.meta ?? null,
  }));

const toTrip = (ride: ApiRide, requestIds: string[], events?: ApiRideEvent[]): Trip => ({
  id: ride.id,
  vehicleId: ride.vehicleId,
  status: ride.status as RideStatus,
  requestIds,
  seatsTaken: ride.seatsTaken,
  capacity: ride.capacity,
  // GET /driver/history carries the audit trail; the polling endpoints do not,
  // so it is threaded through rather than re-derived from the client.
  events: toTripEvents(events ?? ride.events),
});

const upsertById = <T extends { id: string }>(current: T[], incoming: T[]): T[] => {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()];
};

// ---------- context ----------

type DtpStore = {
  state: DtpState;
  /** Server session user (null when browsing as guest). */
  me: ApiUser | null;
  persona: Persona | null;
  vehicle: Vehicle | null;
  dispatch: React.Dispatch<DtpAction>;
  login: (phone: string, password: string) => Promise<void>;
  register: (body: {
    name: string;
    phone: string;
    password: string;
    role: "passenger" | "driver";
    homeStopId?: string | null;
    vehicleName?: string;
    vehicleCapacity?: number;
  }) => Promise<void>;
  signOut: () => void;
  resetDemo: () => void;
  refresh: () => Promise<void>;
  /** Raw polling payload for the signed-in passenger's current ride. */
  activeRide: ApiActivePassenger;
  driverState: ApiDriverState | null;
  /** Read-only admin view of every active ride (GET /admin/rides). */
  adminRides: ApiAdminRide[];
  /** The authoritative stop/leg/corridor graph (GET /network). */
  network: ApiNetwork | null;
  busy: boolean;
  error: string | null;
};

const StoreContext = createContext<DtpStore | null>(null);

const EMPTY_STATE: DtpState = {
  sessionPersonaId: null,
  onlineDriverIds: [],
  requests: [],
  trips: [],
};

const POLL_MS = 2500;

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DtpState>(EMPTY_STATE);
  const [me, setMe] = useState<ApiUser | null>(null);
  const [activeRide, setActiveRide] = useState<ApiActivePassenger>(null);
  const [driverState, setDriverState] = useState<ApiDriverState | null>(null);
  const [adminRides, setAdminRides] = useState<ApiAdminRide[]>([]);
  const [network, setNetwork] = useState<ApiNetwork | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meRef = useRef(me);
  meRef.current = me;
  const busyRef = useRef(false);

  // ---------- refreshers ----------

  const refreshPassenger = useCallback(async () => {
    const [active, history] = await Promise.all([fetchMyActive(), fetchMyHistory()]);
    setActiveRide(active);
    const requests: RideRequest[] = [...history.requests.map(toRideRequest)];
    const trips: Trip[] = [];
    if (active) {
      requests.push(toRideRequest(active.request));
      const coRiders = active.coRiders ?? [];
      // Pseudo-requests for co-riders (privacy-safe fields) so overlays and
      // the tracking card can render them without extra calls.
      for (const co of coRiders) {
        requests.push({
          id: co.id,
          passengerId: "",
          pickupStopId: co.dropStopId,
          dropStopId: co.dropStopId,
          routeId: null,
          legIds: [],
          stopIds: [],
          status: co.status as RideStatus,
          tripId: active.trip?.id ?? null,
          fare: { baseFare: 0, distanceCharge: 0, poolDiscount: 0, total: 0, lines: [] },
          createdAt: "",
          updatedAt: "",
        });
      }
      if (active.trip) {
        trips.push(
          toTrip(active.trip, [active.request.id, ...coRiders.map((c) => c.id)]),
        );
      }
    }
    setState((s) => ({
      ...s,
      requests: upsertById(s.requests, requests),
      trips: upsertById(s.trips, trips),
    }));
  }, []);

  const refreshDriver = useCallback(async () => {
    const [ds, history] = await Promise.all([fetchDriverState(), fetchDriverHistory()]);
    setDriverState(ds);
    const requests: RideRequest[] = [
      ...ds.pendingGroups.flatMap((g) => g.requests),
      ...(ds.activeTrip?.requests ?? []),
    ].map(toRideRequest);
    const trips: Trip[] = [];
    if (ds.activeTrip) {
      trips.push(
        toTrip(
          ds.activeTrip,
          ds.activeTrip.requests.map((r) => r.id),
        ),
      );
    }
    for (const t of history.trips) {
      const members = t.requests ?? [];
      trips.push(toTrip(t, members.map((r) => r.id), t.events));
      requests.push(...members.map(toRideRequest));
    }
    setState((s) => ({
      ...s,
      onlineDriverIds: ds.online ? [meRef.current?.id ?? ""] : [],
      requests: upsertById(s.requests, requests),
      trips: upsertById(s.trips, trips),
    }));
  }, []);

  const refreshAdmin = useCallback(async () => {
    const { rides } = await fetchAdminRides();
    setAdminRides(rides);
  }, []);

  const refresh = useCallback(async () => {
    const user = meRef.current;
    if (!user) return;
    if (user.role === "driver") await refreshDriver();
    else if (user.role === "passenger") await refreshPassenger();
    else if (user.role === "admin") await refreshAdmin();
  }, [refreshAdmin, refreshDriver, refreshPassenger]);

  // ---------- auth ----------

  const signOut = useCallback(() => {
    setToken(null);
    setMe(null);
    setActiveRide(null);
    setDriverState(null);
    setAdminRides([]);
    setState(EMPTY_STATE);
  }, []);

  // Bootstrap: restore a session from a stored token, and load the road graph
  // once — it is public and never changes during a session.
  useEffect(() => {
    fetchNetwork().then(setNetwork).catch(() => {
      // The stop picker falls back to the bundled graph, so this is not fatal.
    });
    if (!getToken()) return;
    fetchMe()
      .then(({ user }) => setMe(user))
      .catch(() => setToken(null));
  }, []);

  // ---------- polling (the "realtime" for this MVP) ----------

  useEffect(() => {
    if (!me || me.role === "admin") return;
    let stopped = false;
    const isDriver = me.role === "driver";

    const poll = async () => {
      if (stopped || busyRef.current || document.hidden) return;
      try {
        if (isDriver) await refreshDriver();
        else await refreshPassenger();
      } catch (err) {
        // Expired/invalid token ends the session cleanly.
        if (err instanceof Error && "status" in err && (err as { status?: number }).status === 401) {
          signOut();
        }
      }
    };

    poll();
    const timer = window.setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [me?.id, me?.role, refreshDriver, refreshPassenger, signOut]);

  // ---------- actions ----------

  /**
   * Shared wrapper for every mutation: flips `busy`, surfaces the server's
   * error message, and **rethrows** so callers that need to branch on failure
   * (the login form) can. Swallowing the error here is what previously made
   * a failed sign-in look like a success.
   */
  const run = useCallback(async (fn: () => Promise<void>): Promise<void> => {
    setBusy(true);
    busyRef.current = true;
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      throw err;
    } finally {
      setBusy(false);
      busyRef.current = false;
    }
  }, []);

  const login = useCallback(
    (phone: string, password: string) =>
      run(async () => {
        const { token, user } = await apiLogin(phone, password);
        setToken(token);
        setMe(user);
        setState((s) => ({ ...s, sessionPersonaId: user.id }));
      }),
    [run],
  );

  const register = useCallback(
    (body: Parameters<DtpStore["register"]>[0]) =>
      run(async () => {
        const { token, user } = await apiRegister(body);
        setToken(token);
        setMe(user);
        setState((s) => ({ ...s, sessionPersonaId: user.id }));
      }),
    [run],
  );

  const resetDemo = useCallback(() => {
    // The server owns the data now; "reset" just ends the local session.
    signOut();
  }, [signOut]);

  const dispatch = useCallback(
    (action: DtpAction) => {
      // `run` rethrows; dispatch is fire-and-forget, so swallow here. The
      // message is already in `state.error` for the UI to render.
      void run(async () => {
        switch (action.type) {
          case "SIGN_IN": {
            // Legacy persona-id sign-in → seeded demo credentials.
            const persona = personaById(action.personaId);
            if (persona) await apiLogin(persona.phone, DEMO_PASSWORD).then(({ token, user }) => {
              setToken(token);
              setMe(user);
            });
            break;
          }
          case "SIGN_OUT":
            signOut();
            break;
          case "TOGGLE_ONLINE": {
            const online = state.onlineDriverIds.includes(action.driverId);
            await apiSetDriverOnline(!online);
            await refreshDriver();
            break;
          }
          case "REQUEST_RIDE": {
            await apiRequestRide({
              pickupStopId: action.pickupStopId,
              dropStopId: action.dropStopId,
              routeId: action.routeId,
              seats: action.seats,
              // Stable per attempt so a double-tap replays instead of
              // creating a second request server-side.
              idempotencyKey: action.idempotencyKey,
            });
            await refreshPassenger();
            break;
          }
          case "CANCEL_RIDE":
            await apiCancelRide(action.requestId, action.reason ?? null);
            await refreshPassenger();
            break;
          case "ACCEPT_REQUESTS":
            await apiAcceptRequests(action.requestIds);
            await refreshDriver();
            break;
          case "JOIN_RIDER":
            // Driver admits a pre-booked rider into the running trip.
            await apiAdmitRider(action.rideId, action.requestId);
            await refreshDriver();
            break;
          case "ADVANCE_TRIP": {
            const verb = {
              DRIVER_ARRIVED: "arrived",
              STARTED: "start",
              COMPLETED: "complete",
            }[action.event] as "arrived" | "start" | "complete";
            await apiAdvanceRide(action.tripId, verb);
            await refreshDriver();
            break;
          }
          case "RATE_RIDE":
            await apiRateRide(action.requestId, action.rating);
            await refreshPassenger();
            break;
        }
      }).catch(() => {
        // Already surfaced via `error`; nothing further to do here.
      });
    },
    [run, signOut, refreshDriver, refreshPassenger, state.onlineDriverIds],
  );

  // ---------- derived ----------

  const value = useMemo<DtpStore>(() => {
    // `role` is carried through verbatim now: coercing an admin to
    // "passenger" hid the admin console behind a permanently empty shell.
    const persona: Persona | null = me
      ? {
          id: me.id,
          name: me.name,
          role: me.role,
          phone: me.phone,
          homeStopId: me.homeStopId ?? "banani",
          usualDropStopId: me.usualDropStopId,
        }
      : null;
    const vehicle =
      me?.role === "driver" && me.vehicle
        ? {
            id: me.vehicle.id,
            driverId: me.vehicle.driverId,
            name: me.vehicle.name,
            capacity: me.vehicle.capacity,
          }
        : null;
    return {
      state: { ...state, sessionPersonaId: me?.id ?? null },
      me,
      persona,
      vehicle,
      dispatch,
      login,
      register,
      signOut,
      resetDemo,
      refresh,
      activeRide,
      driverState,
      adminRides,
      network,
      busy,
      error,
    };
  }, [state, me, dispatch, login, register, signOut, resetDemo, refresh, activeRide, driverState, adminRides, network, busy, error]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used within StoreProvider");
  return store;
}

/** This passenger's active request, if any. */
export function useActiveRequest() {
  const { state, persona } = useStore();
  if (persona?.role !== "passenger") return null;
  return (
    state.requests.find(
      (r) => r.passengerId === persona.id && isActive(r.status),
    ) ?? null
  );
}

/** The signed-in driver's active trip, if any. */
export function useActiveTrip() {
  const { state, vehicle } = useStore();
  if (!vehicle) return null;
  return state.trips.find((t) => t.vehicleId === vehicle.id && isActive(t.status)) ?? null;
}

// ---------- action union (each maps to exactly one endpoint) ----------

export type DtpAction =
  | { type: "SIGN_IN"; personaId: string }
  | { type: "SIGN_OUT" }
  | { type: "TOGGLE_ONLINE"; driverId: string }
  | {
      type: "REQUEST_RIDE"; // POST /rides/request
      pickupStopId: string;
      dropStopId: string;
      routeId: string | null;
      seats?: number;
      /** Stable across double-taps so the server replays instead of duplicating. */
      idempotencyKey: string;
    }
  | { type: "CANCEL_RIDE"; requestId: string; reason?: string | null } // POST /rides/:id/cancel
  | { type: "ACCEPT_REQUESTS"; requestIds: string[] } // POST /rides/accept
  | { type: "JOIN_RIDER"; rideId: string; requestId: string } // POST /rides/:id/join
  | {
      type: "ADVANCE_TRIP"; // POST /rides/:id/{arrived,start,complete}
      tripId: string;
      event: "DRIVER_ARRIVED" | "STARTED" | "COMPLETED";
    }
  | { type: "RATE_RIDE"; requestId: string; rating: number }; // POST /rides/:id/rate

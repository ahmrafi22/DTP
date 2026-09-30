"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  IoArrowForward,
  IoCarSportOutline,
  IoCash,
  IoChevronDown,
  IoPeople,
  IoMapOutline,
  IoPower,
  IoStar,
} from "react-icons/io5";
import {
  STATUS_LABEL,
  groupPoolable,
  isActive,
  personaById,
  adaptRequest,
  useActiveRequest,
  useActiveTrip,
  useStore,
  type RideRequest,
  type RideStatus,
} from "@/components/store";
import { FareLines, RatingRow, StatusStepper } from "@/components/map/ride-panel";
import { AppNav, SiteHeader } from "@/components/app-nav";
import { DotsPulse, GooeyBalls, Spinner } from "@/components/loaders";
import { NODES, formatTaka } from "@/lib/network";
import { useTripProgress } from "@/lib/trip-progress";
import { fetchRideEvents, type ApiRideEvent } from "@/lib/api";
import { cn } from "@/lib/utils";

const spring = { type: "spring" as const, bounce: 0, duration: 0.35 };
const stopName = (id: string) => NODES[id]?.name ?? id;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export default function ActivityPage() {
  const { persona } = useStore();

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 pb-32 md:pb-24">
        <h1 className="text-foreground text-xl font-black tracking-tight">Activity</h1>

        {!persona ? (
          <GuestCard />
        ) : persona.role === "driver" ? (
          <DriverConsole />
        ) : (
          <PassengerActivity />
        )}
      </main>
      <AppNav />
    </div>
  );
}

function GuestCard() {
  return (
    <div className="bg-card border-border mt-6 flex flex-col items-center gap-3 rounded-2xl border p-8 text-center shadow-sm">
      <Spinner className="text-primary size-6" />
      <p className="text-muted-foreground text-sm">
        Pick a persona to see rides and trips here.
      </p>
      <Link
        href="/login"
        className="bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97] inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold transition-all"
      >
        Choose persona <IoArrowForward />
      </Link>
    </div>
  );
}

function StatusChip({ status }: { status: RideRequest["status"] }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-bold",
        status === "COMPLETED" && "bg-primary/15 text-primary",
        status === "CANCELLED" && "bg-destructive/10 text-destructive",
        isActive(status) && "bg-warn/20 text-foreground",
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

// ---------- passenger ----------

function PassengerActivity() {
  const { state, persona } = useStore();
  const activeRequest = useActiveRequest();
  const history = useMemo(
    () =>
      state.requests
        .filter((r) => r.passengerId === persona?.id && !isActive(r.status))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [state.requests, persona],
  );

  return (
    <div className="mt-4 space-y-3">
      {activeRequest && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
          <div className="bg-card border-primary rounded-2xl border-2 p-4 shadow-sm">
            <div className="flex items-center justify-between pb-3">
              <p className="text-foreground text-sm font-bold">Ride in progress</p>
              <StatusChip status={activeRequest.status} />
            </div>
            <StatusStepper status={activeRequest.status} />
            <p className="text-muted-foreground pt-3 text-xs">
              {stopName(activeRequest.pickupStopId)} → {stopName(activeRequest.dropStopId)}
            </p>
            <Link
              href="/"
              className="bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] mt-3 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-bold transition-all"
            >
              Track on the map <IoArrowForward className="size-3.5" />
            </Link>
          </div>
        </motion.div>
      )}

      <h2 className="text-foreground pt-2 text-sm font-bold">Past rides</h2>
      {history.length === 0 ? (
        <EmptyState text="No rides yet — book your first pooled seat on the map." />
      ) : (
        <ul className="space-y-2">
          <AnimatePresence initial={false}>
            {history.map((request) => (
              <motion.li
                key={request.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={spring}
              >
                <HistoryCard request={request} />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

function HistoryCard({ request }: { request: RideRequest }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-card border-border rounded-2xl border p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 text-left"
      >
        <span className="bg-secondary text-secondary-foreground flex size-10 shrink-0 flex-col items-center justify-center rounded-xl text-[10px] font-bold leading-tight">
          {fmtDate(request.createdAt).split(" ")[0]}
          <span className="text-[9px] font-semibold">{fmtDate(request.createdAt).split(" ")[1]}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-foreground block truncate text-sm font-bold">
            {stopName(request.pickupStopId)} → {stopName(request.dropStopId)}
          </span>
          <span className="text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <StatusChip status={request.status} />
            {request.waitAndSave && request.fare.waitSaveDiscount > 0 && (
              <span className="text-emerald-600 font-bold">
                Wait &amp; save −{formatTaka(request.fare.waitSaveDiscount)}
              </span>
            )}
            {request.fare.poolDiscount > 0 && (
              <span className="bg-primary/15 text-primary rounded-full px-2 py-0.5 text-[10px] font-bold">
                Pooled −{formatTaka(request.fare.poolDiscount)}
              </span>
            )}
            {request.paymentMethod === "WALLET" && (
              <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-bold">
                {request.settled ? "Paid from TeslaPay" : "TeslaPay pending"}
              </span>
            )}
          </span>
        </span>
        <span className="shrink-0 text-right">
          <span className="text-foreground block text-sm font-black">{formatTaka(request.fare.total)}</span>
          <IoChevronDown className={cn("text-muted-foreground ml-auto size-3.5 transition-transform", open && "rotate-180")} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={spring} className="overflow-hidden">
            <div className="border-border mt-3 space-y-2 border-t pt-3">
              <FareLines request={request} />
              {request.status === "COMPLETED" && <RatingRow request={request} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------- driver ----------

function DriverConsole() {
  const { state, persona, vehicle, dispatch, error } = useStore();
  const activeTrip = useActiveTrip();
  const online = persona ? state.onlineDriverIds.includes(persona.id) : false;

  // How far the trip has run, on the same 90-second budget the map animation
  // uses, so the console and the map agree on when the ride is over.
  const tripProgress = useTripProgress(
    activeTrip?.status === "STARTED",
    activeTrip?.updatedAt,
  );

  // Reaching the final destination ends the trip on its own — nobody has to
  // press "Complete". Guarded so it fires once per ride and never fights the
  // driver if they are already transitioning manually.
  const autoCompletedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeTrip || activeTrip.status !== "STARTED") return;
    if (tripProgress < 1) return;
    if (autoCompletedRef.current === activeTrip.id) return;
    autoCompletedRef.current = activeTrip.id;
    void dispatch({ type: "ADVANCE_TRIP", tripId: activeTrip.id, event: "COMPLETED" });
    // `activeTrip` itself is a dependency: the ref guard above makes this
    // idempotent, so re-running on each poll costs nothing.
  }, [activeTrip, tripProgress, dispatch]);

  const pendingGroups = useMemo(
    () => groupPoolable(state.requests.filter((r) => r.status === "REQUESTED")),
    [state.requests],
  );

  const completedTrips = useMemo(
    () => state.trips.filter((t) => t.vehicleId === vehicle?.id && t.status === "COMPLETED"),
    [state.trips, vehicle],
  );
  const earnings = completedTrips.reduce((sum, trip) => {
    for (const id of trip.requestIds) {
      const req = state.requests.find((r) => r.id === id);
      if (req) sum += req.fare.total;
    }
    return sum;
  }, 0);

  if (!persona || !vehicle) {
    return (
      <p className="text-muted-foreground mt-4 rounded-xl bg-muted p-4 text-center text-xs">
        This account has no vehicle registered, so there is no trip to run.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-4">
      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
          {error}
        </p>
      )}
      {/* Online + vehicle */}
      <div className="bg-card border-border flex items-center gap-3 rounded-2xl border p-4 shadow-sm">
        <span className="bg-ink flex size-11 shrink-0 items-center justify-center rounded-full text-white">
          <IoCarSportOutline className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-foreground text-sm font-bold">
            {persona.name} · {vehicle.name}
          </p>
          <p className="text-muted-foreground text-xs">{vehicle.capacity} seats · TeslaPay + cash</p>
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: "TOGGLE_ONLINE", driverId: persona.id })}
          aria-pressed={online}
          className={cn(
            "active:scale-[0.97] inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-all",
            online ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent",
          )}
        >
          <IoPower className="size-3.5" />
          {online ? "Online" : "Offline"}
        </button>
      </div>

      {/* Active trip */}
      {activeTrip ? (
        <ActiveTripCard trip={activeTrip} />
      ) : (
        <div className="bg-card border-border flex items-center gap-3 rounded-2xl border p-4 shadow-sm">
          {online ? (
            <>
              <DotsPulse className="text-primary size-6 shrink-0" />
              <p className="text-muted-foreground text-xs leading-relaxed">
                Waiting for ride requests… Passengers book from the map.
              </p>
            </>
          ) : (
            <>
              <GooeyBalls className="text-muted-foreground size-6 shrink-0" />
              <p className="text-muted-foreground text-xs leading-relaxed">
                You&apos;re offline. Go online to start accepting shared rides.
              </p>
            </>
          )}
        </div>
      )}

      {/* Pending requests (poolable groups) */}
      {!activeTrip && pendingGroups.length > 0 && (
        <div>
          <h2 className="text-foreground pb-2 text-sm font-bold">
            Incoming {pendingGroups.length > 1 ? "requests" : "request"}
          </h2>
          <ul className="space-y-2">
            {pendingGroups.map((group, i) => (
              <motion.li key={group.map((g) => g.id).join("-")} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.05 }}>
                <PendingGroupCard group={group} disabled={!online} />
              </motion.li>
            ))}
          </ul>
        </div>
      )}

      {/* Earnings */}
      <div className="bg-card border-border rounded-2xl border p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IoCash className="text-primary size-5" />
            <p className="text-foreground text-sm font-bold">Earned so far</p>
          </div>
          <p className="text-foreground text-lg font-black tracking-tight">{formatTaka(earnings)}</p>
        </div>
        <p className="text-muted-foreground pt-1 text-[11px]">
          Across {completedTrips.length} completed {completedTrips.length === 1 ? "trip" : "trips"} — pooled fares included.
        </p>
      </div>

      {/* Trip history */}
      {completedTrips.length > 0 && (
        <div>
          <h2 className="text-foreground pb-2 text-sm font-bold">Past trips</h2>
          <ul className="space-y-2">
            {completedTrips.map((trip) => {
              const rated = trip.requestIds
                .map((id) => state.requests.find((r) => r.id === id))
                .filter((r): r is NonNullable<typeof r> => typeof r?.rating === "number");
              const avgRating = rated.length
                ? (
                    rated.reduce((sum, r) => sum + (r.rating ?? 0), 0) / rated.length
                  ).toFixed(1)
                : "—";
              return (
              <li key={trip.id} className="bg-card border-border rounded-2xl border p-4 shadow-sm">
                <div className="flex items-center justify-between pb-2">
                  <p className="text-muted-foreground text-xs font-semibold">
                    {trip.events.length > 0
                      ? `${fmtDate(trip.events[trip.events.length - 1].at)} · `
                      : ""}
                    {trip.seatsTaken} of {trip.capacity} seats filled
                    {rated.length > 0 && ` · ★ ${avgRating}`}
                  </p>
                  <StatusChip status={trip.status} />
                </div>
                <TripRiders trip={trip} />
                <TripTimeline tripId={trip.id} />
              </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * The ride's audit trail from GET /rides/:id/events — the same rows the
 * server writes on every transition, so "what happened and who did it" is
 * answerable after the fact (PRD §4).
 */
function TripTimeline({ tripId }: { tripId: string }) {
  const [events, setEvents] = useState<ApiRideEvent[] | null>(null);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = async () => {
    setOpen((o) => !o);
    if (events || failed) return;
    try {
      const res = await fetchRideEvents(tripId);
      setEvents(res.events);
    } catch {
      setFailed(true);
    }
  };

  return (
    <div className="border-border mt-3 border-t pt-2">
      <button
        type="button"
        onClick={() => void load()}
        className="text-muted-foreground hover:text-foreground text-[11px] font-semibold transition-colors"
      >
        {open ? "Hide trip history" : "Show trip history"}
      </button>
      {open && (
        <ol className="mt-2 space-y-1">
          {!events && !failed && (
            <li className="text-muted-foreground text-[11px]">Loading…</li>
          )}
          {failed && (
            <li className="text-destructive text-[11px]">Could not load the trip history.</li>
          )}
          {events?.map((e, i) => (
            <li key={`${e.at}-${i}`} className="text-muted-foreground flex justify-between text-[11px]">
              <span className="font-semibold">{e.event}</span>
              <span>{fmtDate(e.at)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * One rider's row on the active trip: their own lifecycle track and their own
 * action. Two riders render two of these, three render three — nothing about
 * the trip is collapsed into a single shared control.
 */
function RiderRow({
  rider,
  ride,
}: {
  rider: RideRequest;
  ride: { id: string; capacity: number; seatsTaken: number; status: RideStatus };
}) {
  const { dispatch, pendingAction } = useStore();

  const firstName =
    rider.passengerName?.split(" ")[0] ?? personaById(rider.passengerId)?.name.split(" ")[0] ?? "Rider";

  // Each rider advances independently: the driver picks people up at different
  // points, so rider two still has "arrived" and "start" to be marked after
  // rider one has been dropped off. Every step goes through the per-rider
  // endpoint, which is legal in any order the rider has not yet passed.
  const action = (() => {
    switch (rider.status) {
      case "MATCHED":
        return {
          key: `rider:${rider.id}`,
          label: `Mark arrived with ${firstName}`,
          run: () => dispatch({ type: "RIDER_ADVANCE", rideId: ride.id, requestId: rider.id }),
        };
      case "DRIVER_ARRIVED":
        return {
          key: `rider:${rider.id}`,
          label: `Start with ${firstName}`,
          run: () => dispatch({ type: "RIDER_ADVANCE", rideId: ride.id, requestId: rider.id }),
        };
      case "STARTED":
        return {
          key: `rider:${rider.id}`,
          label: `Drop off at ${stopName(rider.dropStopId)}`,
          run: () => dispatch({ type: "RIDER_ADVANCE", rideId: ride.id, requestId: rider.id }),
        };
      default:
        return null;
    }
  })();

  const busy = action !== null && pendingAction === action.key;

  return (
    <div className="border-border bg-muted/40 rounded-xl border px-2.5 py-2">
      <div className="flex items-center justify-between pb-1.5">
        <span className="text-foreground truncate text-xs font-bold">{firstName}</span>
        <span className="text-muted-foreground shrink-0 text-[10px]">
          {stopName(rider.pickupStopId)} → {stopName(rider.dropStopId)}
        </span>
      </div>
      <StatusStepper status={rider.status} />
      {action && (
        <button
          type="button"
          disabled={busy}
          onClick={action.run}
          className="border-border text-muted-foreground hover:bg-muted hover:text-foreground mt-1.5 flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border text-[11px] font-bold transition-all disabled:opacity-60"
        >
          {busy && <DotsPulse className="size-3 shrink-0" />}
          <span className="truncate">{busy ? "Working…" : action.label}</span>
        </button>
      )}
    </div>
  );
}

function TripRiders({ trip }: { trip: { requestIds: string[] } }) {
  const { state } = useStore();
  return (
    <ul className="space-y-1.5">
      {trip.requestIds.map((id) => {
        const req = state.requests.find((r) => r.id === id);
        if (!req) return null;
        // Server-provided first name, falling back to the seeded cast lookup.
        const firstName = req.passengerName?.split(" ")[0] ?? personaById(req.passengerId)?.name.split(" ")[0];
        return (
          <li key={id} className="flex items-center gap-2 text-xs">
            <IoPeople className="text-muted-foreground size-3.5 shrink-0" />
            <span className="text-foreground font-semibold">{firstName}</span>
            <span className="text-muted-foreground min-w-0 flex-1 truncate">
              {stopName(req.pickupStopId)} → {stopName(req.dropStopId)}
            </span>
            {typeof req.rating === "number" && (
              <span
                className="text-primary flex shrink-0 items-center gap-0.5 font-bold"
                title={`Rated ${req.rating} of 5`}
              >
                <IoStar className="size-3" />
                {req.rating}
              </span>
            )}
            <span className="text-muted-foreground shrink-0 text-[10px] font-semibold">
              {req.paymentMethod === "WALLET"
                ? req.settled
                  ? "paid"
                  : "TeslaPay"
                : "cash"}
            </span>
            <span className="text-foreground shrink-0 font-bold">{formatTaka(req.fare.total)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function PendingGroupCard({ group, disabled }: { group: RideRequest[]; disabled: boolean }) {
  const { pendingAction } = useStore();
  const accepting =
    pendingAction === `accept:${group.map((g) => g.id).join(",")}`;
  const { vehicle, dispatch } = useStore();
  if (!vehicle) return null;
  const fits = group.length <= vehicle.capacity;

  return (
    <div className="bg-card border-border rounded-2xl border p-4 shadow-sm">
      <div className="flex items-center justify-between pb-2">
        <p className="text-foreground text-xs font-bold">
          {group.length === 1 ? "Single rider" : `Poolable group · ${group.length} riders`}
        </p>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-bold",
            fits ? "bg-secondary text-secondary-foreground" : "bg-destructive/10 text-destructive",
          )}
        >
          {group.length} of {vehicle.capacity} seats
        </span>
      </div>
      <TripRiders trip={{ requestIds: group.map((g) => g.id) }} />
      <button
        type="button"
        disabled={disabled || !fits || accepting}
        onClick={() => dispatch({ type: "ACCEPT_REQUESTS", requestIds: group.map((g) => g.id) })}
        className="bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition-all disabled:pointer-events-none disabled:opacity-50"
      >
        {accepting && <DotsPulse className="size-3.5" />}
        {accepting
          ? "Accepting…"
          : fits
            ? `Accept ${group.length === 1 ? "ride" : "pool"}`
            : "Not enough seats"}
      </button>
      {disabled && (
        <p className="text-muted-foreground pt-1.5 text-center text-[10px]">
          Go online to accept.
        </p>
      )}
    </div>
  );
}

function ActiveTripCard({ trip }: { trip: NonNullable<ReturnType<typeof useActiveTrip>> }) {
  const { persona, dispatch, state, driverState, pendingAction } = useStore();
  // Only this trip's own transition spins, not the whole console.
  const advancing = pendingAction?.startsWith(`advance:${trip.id}:`) ?? false;

  // A mid-trip joiner must share at least one leg with a rider already on
  // board; the server rejects the rest, so the client filters first to keep
  // the button from offering a doomed request.
  const joinCandidates = useMemo(() => {
    const onBoard = new Set(trip.requestIds);
    const onBoardLegs = new Set(
      state.requests.filter((r) => onBoard.has(r.id)).flatMap((r) => r.legIds),
    );
    return state.requests.filter(
      (r) =>
        r.status === "REQUESTED" && r.legIds.some((id) => onBoardLegs.has(id)),
    );
  }, [state.requests, trip.requestIds]);

  // Each rider on board, in boarding order, so their individual lifecycle can
  // be rendered rather than one stepper standing in for the whole trip.
  // Read riders from the authoritative driver payload, not the merged mirror:
  // `state.requests` is an accumulator that can lag or miss a member, and an
  // empty list here silently collapsed every row into a single trip stepper.
  const riders = useMemo<readonly RideRequest[]>(() => {
    const live = driverState?.activeTrip?.requests;
    if (live && live.length > 0) return live.map(adaptRequest);
    return trip.requestIds
      .map((id) => state.requests.find((r) => r.id === id))
      .filter((r): r is NonNullable<typeof r> => Boolean(r));
  }, [driverState?.activeTrip?.requests, state.requests, trip.requestIds]);

  if (!persona) return null;

  const action =
    trip.status === "MATCHED"
      ? ({ label: "I've arrived", event: "DRIVER_ARRIVED" } as const)
      : trip.status === "DRIVER_ARRIVED"
        ? ({ label: "Start trip", event: "STARTED" } as const)
        : trip.status === "STARTED"
          ? ({ label: "Complete trip", event: "COMPLETED" } as const)
          : null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={spring}>
      <div className="border-primary bg-card rounded-2xl border-2 p-4 shadow-sm">
        <div className="flex items-center justify-between pb-3">
          <p className="text-foreground text-sm font-bold">Current trip</p>
          <StatusChip status={trip.status} />
        </div>
        {/* One lifecycle row per rider, each tracking *that rider's* status.
            Two riders show it twice, three show it three times — and a rider
            who hopped on mid-trip is genuinely further along than one who
            boarded at the start, which a single shared stepper hid. */}
        <div className="space-y-2">
          {riders.map((rider) => (
            <RiderRow key={rider.id} rider={rider} ride={trip} />
          ))}
          {/* Never collapse silently: if the rider list cannot be resolved,
              say so rather than showing one bare stepper that looks like a
              single-rider trip. */}
          {riders.length === 0 && (
            <div className="border-border bg-muted/40 rounded-xl border px-2.5 py-2">
              <p className="text-muted-foreground pb-1.5 text-[11px] font-semibold">
                {trip.requestIds.length} rider(s) on this trip
              </p>
              <StatusStepper status={trip.status} />
            </div>
          )}
        </div>
        <p className="text-muted-foreground mt-2 text-center text-[11px] font-semibold">
          {trip.seatsTaken} of {trip.capacity} seats filled
        </p>
        <div className="border-border mt-3 border-t pt-3">
          <TripRiders trip={trip} />
        </div>
        {trip.seatsTaken < trip.capacity && joinCandidates.length > 0 && (
          <div className="border-border mt-3 border-t pt-3">
            <p className="text-muted-foreground pb-2 text-[11px] font-semibold">
              Seat still free — add a rider whose route overlaps
            </p>
            <ul className="space-y-1.5">
              {joinCandidates.map((c) => (
                <li
                  key={c.id}
                  className="bg-card border-border flex items-center gap-2 rounded-xl border p-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground truncate text-xs font-bold">
                      {c.passengerName ?? "Rider"}
                    </p>
                    <p className="text-muted-foreground truncate text-[10px]">
                      {stopName(c.pickupStopId)} → {stopName(c.dropStopId)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      dispatch({ type: "JOIN_RIDER", rideId: trip.id, requestId: c.id })
                    }
                    className="border-border text-foreground hover:bg-muted shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold transition-all"
                  >
                    Add
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {action && (
            <button
              type="button"
              disabled={advancing}
              onClick={() => dispatch({ type: "ADVANCE_TRIP", tripId: trip.id, event: action.event })}
              className="bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] flex h-11 w-full items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold transition-all disabled:opacity-70"
            >
              {advancing && <DotsPulse className="size-3.5 shrink-0" />}
              <span className="truncate">{advancing ? "Working…" : action.label}</span>
            </button>
          )}
          <Link
            href="/"
            className={cn(
              "border-border text-foreground hover:bg-muted active:scale-[0.98] flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-bold transition-all",
              !action && "col-span-2",
            )}
          >
            <IoMapOutline className="size-3.5 shrink-0" />
            <span className="truncate">Show on map</span>
          </Link>
        </div>
        {trip.status === "STARTED" && (
          <p className="text-muted-foreground pt-2 text-center text-[10px]">
            Trip under way — passengers can no longer cancel.
          </p>
        )}
        {/* Demo shortcut: jump the trip to COMPLETED without waiting out the
            full 90 seconds. The server still enforces the real transition
            (STARTED -> COMPLETED), so this is not a bypass. */}
        {trip.status === "STARTED" && (
          <button
            type="button"
            onClick={() => dispatch({ type: "ADVANCE_TRIP", tripId: trip.id, event: "COMPLETED" })}
            className="border-border text-muted-foreground hover:bg-muted hover:text-foreground mt-2 w-full rounded-xl border py-2 text-[11px] font-bold transition-all"
          >
            Skip to end of ride 
          </button>
        )}
      </div>
    </motion.div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="bg-card border-border text-muted-foreground rounded-2xl border border-dashed p-8 text-center text-xs">
      {text}
    </div>
  );
}

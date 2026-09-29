"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import {
  IoArrowForward,
  IoCarSportOutline,
  IoChevronBack,
  IoClose,
  IoPersonCircleOutline,
  IoPower,
  IoSearch,
  IoStar,
  IoStarOutline,
  IoSwapVertical,
} from "react-icons/io5";
import { NODES, formatTaka } from "@/lib/network";
import {
  REQUEST_STAGES,
  STATUS_LABEL,
  VEHICLES,
  adaptRequest,
  useActiveRequest,
  isActive,
  isCancellable,
  personaById,
  useStore,
  type RideRequest,
} from "@/components/store";
import { estimateFare, requestRide, type ApiCoRider } from "@/lib/api";
import { DotsPulse, PulseRing } from "@/components/loaders";
import { cn } from "@/lib/utils";

const stopName = (id: string) => NODES[id]?.name ?? id;

const spring = { type: "spring" as const, bounce: 0, duration: 0.35 };

type RideOption = {
  id: string;
  routeId: string | null;
  title: string;
  sub: string;
  legIds: string[];
  stopIds: string[];
  /** Priced by the server (POST /fare/estimate), not re-derived in the client. */
  totalPaisa: number;
};

// ---------- top-level role switch ----------

export function RidePanel() {
  const { persona, activeRide, error } = useStore();
  const activeRequest = useActiveRequest();
  // Keep tracking a just-finished ride for a few minutes so the rating and
  // per-leg breakdown stay visible (the server keeps it in /me/active).
  const tracked =
    activeRequest ??
    (activeRide && (activeRide.request.status === "COMPLETED" || activeRide.request.status === "CANCELLED")
      ? adaptRequest(activeRide.request)
      : null);

  if (!persona) return <GuestCard />;
  if (persona.role === "driver") return <DriverQuickCard />;
  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        {tracked ? (
          <motion.div key="tracking" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={spring}>
            <TrackingCard request={tracked} />
          </motion.div>
        ) : (
          <motion.div key="booking" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={spring}>
            <BookingFlow />
          </motion.div>
        )}
      </AnimatePresence>
      {error && (
        <p className="text-destructive bg-destructive/10 mt-2 rounded-lg px-3 py-2 text-center text-xs font-semibold">
          {error}
        </p>
      )}
    </>
  );
}

// ---------- guest ----------

function GuestCard() {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <IoPersonCircleOutline className="text-muted-foreground size-12" />
      <div>
        <h2 className="text-foreground text-sm font-bold tracking-tight">Pick a demo persona</h2>
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          Sign in as a passenger or driver to book and run shared rides.
        </p>
      </div>
      <Link
        href="/login"
        className="bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97] mt-1 inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold transition-all"
      >
        Choose persona <IoArrowForward />
      </Link>
    </div>
  );
}

// ---------- driver quick card ----------

function DriverQuickCard() {
  const { persona, vehicle, state, dispatch } = useStore();
  if (!persona || !vehicle) return null;
  const online = state.onlineDriverIds.includes(persona.id);
  const activeTrip = state.trips.find((t) => t.vehicleId === vehicle.id && isActive(t.status));
  return (
    <div className="space-y-3 py-1">
      <div className="border-border bg-secondary flex items-center gap-3 rounded-xl border p-3">
        <span className="bg-ink flex size-10 shrink-0 items-center justify-center rounded-full text-white">
          <IoCarSportOutline className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-foreground truncate text-sm font-bold">{persona.name}</p>
          <p className="text-muted-foreground text-xs">
            {vehicle.name} · {vehicle.capacity} seats
          </p>
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: "TOGGLE_ONLINE", driverId: persona.id })}
          aria-pressed={online}
          className={cn(
            "active:scale-[0.97] inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-all",
            online ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent",
          )}
        >
          <IoPower className="size-3.5" />
          {online ? "Online" : "Offline"}
        </button>
      </div>
      <Link
        href="/activity"
        className="bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97] flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition-all"
      >
        {activeTrip ? "Open trip console" : "Driver console"} <IoArrowForward />
      </Link>
      <p className="text-muted-foreground text-center text-[11px]">
        {activeTrip
          ? STATUS_LABEL[activeTrip.status]
          : online
            ? "You're visible to passengers."
            : "Go online to accept shared rides."}
      </p>
      {activeTrip && (
        <p className="text-muted-foreground flex items-center justify-center gap-2 text-[11px]">
          <PulseRing className="text-primary size-3.5" /> Trip is live
        </p>
      )}
    </div>
  );
}

// ---------- passenger booking flow ----------

function BookingFlow() {
  const { persona, dispatch, error } = useStore();
  const [planning, setPlanning] = useState(false);
  const [pickup, setPickup] = useState<string | null>(null);
  const [drop, setDrop] = useState<string | null>(null);

  // The fare the passenger sees before confirming comes from the server
  // (POST /fare/estimate), so it cannot drift from what is actually charged.
  const [options, setOptions] = useState<RideOption[]>([]);
  const [pricing, setPricing] = useState(false);

  useEffect(() => {
    if (!pickup || !drop || pickup === drop) {
      setOptions([]);
      return;
    }
    let cancelled = false;
    setPricing(true);
    estimateFare({ pickupStopId: pickup, dropStopId: drop })
      .then(({ options: serverOptions }) => {
        if (cancelled) return;
        setOptions(
          serverOptions.map((o, i) => ({
            id: o.routeId ?? `__path-${i}`,
            routeId: o.routeId,
            title: o.title,
            sub: o.sub,
            legIds: o.legIds,
            stopIds: o.stopIds,
            totalPaisa: o.fare.total,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setPricing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pickup, drop]);

  if (!persona) return null;

  const startPlanning = () => {
    setPickup(persona.homeStopId);
    // Habitual commute: the destination they ride to every day, pre-filled.
    setDrop(persona.usualDropStopId);
    setPlanning(true);
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {planning ? (
        <motion.div key="plan" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }} transition={spring}>
          <div className="flex items-center gap-2 pb-3">
            <button
              type="button"
              onClick={() => setPlanning(false)}
              aria-label="Back"
              className="hover:bg-muted active:scale-[0.94] flex size-8 items-center justify-center rounded-lg transition-all"
            >
              <IoChevronBack className="size-4" />
            </button>
            <h2 className="text-foreground text-sm font-bold tracking-tight">Plan your pool</h2>
          </div>
          <div className="border-border bg-card relative rounded-xl border shadow-sm">
            <StopField label="Pickup" value={pickup} onPick={setPickup} />
            {/* Real dashed connector between the two rows (the old empty div
                had zero height and negative margins, so the fields collided). */}
            <div className="border-border relative mx-[15px] h-3 border-l-2 border-dashed" />
            <StopField label="Destination" value={drop} onPick={setDrop} />
            <button
              type="button"
              aria-label="Swap pickup and destination"
              onClick={() => {
                setPickup(drop);
                setDrop(pickup);
              }}
              className="border-border bg-card hover:bg-muted active:scale-[0.94] absolute top-1/2 right-3 z-10 flex size-7 -translate-y-1/2 items-center justify-center rounded-full border shadow-sm transition-all"
            >
              <IoSwapVertical className="size-3.5" />
            </button>
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {pickup && drop && pickup !== drop && pricing ? (
              <motion.p key="pricing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-muted-foreground mt-3 text-center text-xs">
                Pricing your route…
              </motion.p>
            ) : pickup && drop && pickup !== drop && options.length > 0 ? (
              <motion.div key="options" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={spring} className="pt-3">
                <RouteOptions
                  options={options}
                  error={error}
                  onConfirm={async (opt, meta) => {
                    try {
                      await requestRide({
                        pickupStopId: pickup,
                        dropStopId: drop,
                        routeId: opt.routeId,
                        seats: meta.seats,
                        idempotencyKey: meta.idempotencyKey,
                      });
                      return true;
                    } catch {
                      return false;
                    }
                  }}
                />
              </motion.div>
            ) : pickup && drop && pickup !== drop && options.length === 0 ? (
              <motion.p key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-muted-foreground bg-muted mt-3 rounded-lg p-3 text-xs">
                No route connects these stops in the demo graph. Try another pair.
              </motion.p>
            ) : null}
          </AnimatePresence>
        </motion.div>
      ) : (
        <motion.div key="idle" initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={spring} className="flex flex-col items-center gap-3 py-8 text-center">
          <h2 className="text-foreground text-xl font-black tracking-tight">Where to?</h2>
          <p className="text-muted-foreground max-w-56 text-xs leading-relaxed">
            Share a seat on a 3-seat Tesla and pay only for the legs you ride.
          </p>
          <button
            type="button"
            onClick={startPlanning}
            className="bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97] mt-2 inline-flex w-full items-center gap-2 rounded-xl px-4 py-3.5 text-sm font-bold shadow-sm transition-all"
          >
            <IoSearch className="size-4" />
            Plan a ride from {stopName(persona.homeStopId)}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Searchable stop selector (55 demo stops — native select is unusable). */
function StopField({
  label,
  value,
  onPick,
}: {
  label: string;
  value: string | null;
  onPick: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = Object.values(NODES);
    if (!q) return list.slice(0, 8);
    return list.filter((n) => n.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query]);

  return (
    <div className="relative">
      {/* Row inside the unified from/to card — the border lives on the wrapper. */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span
          className={cn(
            "size-2.5 shrink-0 rounded-full",
            label === "Pickup" ? "bg-primary" : "bg-ink",
          )}
        />
        <input
          className="text-foreground placeholder:text-muted-foreground w-full bg-transparent text-sm font-semibold outline-none"
          placeholder={label === "Pickup" ? "Pickup stop" : "Where to?"}
          value={open ? query : value ? stopName(value) : ""}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onBlur={() => setOpen(false)}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={label}
        />
        {value && !open && (
          <button
            type="button"
            aria-label="Clear"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(null)}
            className="text-muted-foreground hover:text-foreground"
          >
            <IoClose className="size-3.5" />
          </button>
        )}
      </div>
      {open && (
        <ul className="border-border bg-card absolute inset-x-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border py-1 shadow-lg">
          {matches.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(n.id);
                  setOpen(false);
                }}
                className="hover:bg-secondary active:bg-secondary flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium transition-colors"
              >
                <span className={cn("size-2 rounded-full", label === "Pickup" ? "bg-primary" : "bg-ink")} />
                {n.name}
              </button>
            </li>
          ))}
          {matches.length === 0 && (
            <li className="text-muted-foreground px-3 py-2 text-xs">No stops match “{query}”.</li>
          )}
        </ul>
      )}
    </div>
  );
}

function RouteOptions({
  options,
  onConfirm,
  error,
}: {
  options: RideOption[];
  onConfirm: (option: RideOption, meta: { seats: number; idempotencyKey: string }) => Promise<boolean>;
  error: string | null;
}) {
  const [selected, setSelected] = useState(options[0]?.id);
  const [requesting, setRequesting] = useState(false);
  const [seats, setSeats] = useState(1);
  // One key per form session: a double-tap replays the same request on the
  // server instead of creating two.
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `tap-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  const active = options.find((o) => o.id === selected) ?? options[0];

  return (
    <div>
      <ul className="space-y-1.5">
        {options.map((opt) => (
          <li key={opt.id}>
            <button
              type="button"
              onClick={() => setSelected(opt.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all active:scale-[0.99]",
                opt.id === active?.id
                  ? "border-primary bg-secondary"
                  : "border-border bg-card hover:bg-muted",
              )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg",
                  opt.id === active?.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                <IoCarSportOutline className="size-4.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-foreground block truncate text-sm font-bold">{opt.title}</span>
                <span className="text-muted-foreground block truncate text-[11px]">{opt.sub}</span>
              </span>
              <span className="text-foreground shrink-0 text-sm font-black">{formatTaka(opt.totalPaisa)}</span>
            </button>
          </li>
        ))}
      </ul>
      {active && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-3 py-2">
            <span className="text-muted-foreground text-xs">Seats needed</span>
            <div className="flex gap-1">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setSeats(n)}
                  aria-pressed={seats === n}
                  className={cn(
                    "size-7 rounded-lg text-xs font-bold transition-all active:scale-[0.95]",
                    seats === n
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-secondary",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            disabled={requesting}
            onClick={async () => {
              setRequesting(true);
              // Reset on failure — a stuck "Requesting…" hides the reason.
              const ok = await onConfirm(active, { seats, idempotencyKey });
              if (!ok) setRequesting(false);
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold shadow-sm transition-all disabled:opacity-70"
          >
            {requesting ? (
              <>
                <span className="size-4 text-primary-foreground">
                  <DotsPulse className="size-4" />
                </span>
                Requesting…
              </>
            ) : (
              <>
                Request a pool seat <IoArrowForward className="size-4" />
              </>
            )}
          </button>
          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-center text-[11px] font-medium text-destructive">
              {error}
            </p>
          )}
          <p className="text-muted-foreground text-center text-[11px] leading-relaxed">
            Estimated solo fare. Fare drops 20–30% when legs are shared.
          </p>
        </div>
      )}
    </div>
  );
}

// ---------- tracking ----------

export function StatusStepper({ status }: { status: RideRequest["status"] }) {
  if (status === "CANCELLED")
    return (
      <p className="text-destructive bg-destructive/10 rounded-lg px-3 py-2 text-center text-xs font-bold">
        Ride cancelled
      </p>
    );
  const stageIndex = REQUEST_STAGES.indexOf(status);
  return (
    <ol className="flex items-start">
      {REQUEST_STAGES.map((stage, i) => {
        const done = i < stageIndex;
        const current = i === stageIndex;
        return (
          <li key={stage} className="relative flex flex-1 flex-col items-center gap-1.5">
            {i > 0 && (
              <span className={cn("absolute top-[7px] right-1/2 h-0.5 w-full", done || current ? "bg-primary" : "bg-border")} />
            )}
            <span
              className={cn(
                "relative z-10 size-3.5 rounded-full border-2 transition-colors",
                current
                  ? "animate-pulse border-primary bg-primary"
                  : done
                    ? "border-primary bg-primary"
                    : "border-border bg-card",
              )}
            />
            <span className={cn("text-center text-[9px] leading-tight font-semibold", current ? "text-foreground" : "text-muted-foreground")}>
              {STATUS_LABEL[stage]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function TrackingCard({ request }: { request: RideRequest }) {
  const { state, dispatch, activeRide } = useStore();
  const [confirmCancel, setConfirmCancel] = useState(false);
  // Driver/vehicle/co-riders come straight from the server payload — the API
  // only exposes first names and destinations for co-riders (PRD §5).
  const trip = state.trips.find((t) => t.id === request.tripId) ?? null;
  const vehicle: { name: string; capacity: number; driverId?: string } | null =
    activeRide?.vehicle
      ? { name: activeRide.vehicle.name, capacity: activeRide.vehicle.capacity }
      : trip
        ? VEHICLES.find((v) => v.id === trip.vehicleId) ?? null
        : null;
  const driver = activeRide?.vehicle
    ? { name: activeRide.vehicle.driverName }
    : vehicle
      ? personaById(vehicle.driverId ?? null)
      : null;
  const coRiders: ApiCoRider[] = activeRide?.coRiders ?? [];

  return (
    <div className="space-y-3 py-1">
      <div className="flex items-center justify-between">
        <h2 className="text-foreground text-sm font-bold tracking-tight">Your ride</h2>
        <span className="bg-secondary text-secondary-foreground rounded-full px-2.5 py-1 text-[10px] font-bold">
          {request.routeId ?? "Multi-corridor"}
        </span>
      </div>

      <div className="border-border rounded-xl border p-3">
        <StatusStepper status={request.status} />
        {request.status === "REQUESTED" && (
          <p className="text-muted-foreground flex items-center justify-center gap-2 pt-3 text-[11px]">
            <DotsPulse className="text-primary size-3.5" /> Matching you with a nearby Tesla…
          </p>
        )}
      </div>

      <div className="border-border space-y-0 rounded-xl border p-3">
        <div className="flex items-center gap-2.5 pb-2">
          <span className="bg-primary mt-0.5 size-2.5 shrink-0 rounded-full" />
          <p className="text-foreground flex-1 text-sm font-semibold">{stopName(request.pickupStopId)}</p>
        </div>
        <div className="border-border ml-[7px] h-3 border-l-2 border-dashed" />
        <div className="flex items-center gap-2.5 pt-2">
          <span className="bg-ink mt-0.5 size-2.5 shrink-0 rounded-full" />
          <p className="text-foreground flex-1 text-sm font-semibold">{stopName(request.dropStopId)}</p>
        </div>
      </div>

      {driver && vehicle && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={spring} className="border-border flex items-center gap-3 rounded-xl border p-3">
          <span className="bg-ink flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-black text-white">
            {driver.name[0]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-foreground truncate text-sm font-bold">
              {driver.name} · {vehicle.name}
            </p>
            <p className="text-muted-foreground text-[11px]">
              {vehicle.capacity} seats · Dhaka Tesla
            </p>
          </div>
        </motion.div>
      )}

      {coRiders.length > 0 && (
        <div className="border-border rounded-xl border p-3">
          <p className="text-muted-foreground pb-2 text-[10px] font-bold tracking-wide uppercase">
            Sharing with
          </p>
          <ul className="space-y-1.5">
            {coRiders.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-xs">
                <IoPersonCircleOutline className="text-muted-foreground size-4" />
                <span className="text-foreground font-semibold">{r.firstName}</span>
                <span className="text-muted-foreground truncate">→ {stopName(r.dropStopId)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-border bg-secondary rounded-xl border p-3">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-xs font-semibold">
            {request.status === "REQUESTED" ? "Estimated fare" : "Your fare"}
          </p>
          <p className="text-foreground text-lg font-black tracking-tight">{formatTaka(request.fare.total)}</p>
        </div>
        {request.fare.poolDiscount > 0 && (
          <p className="text-foreground mt-1 text-[11px] font-semibold">
            Pool discount applied: −{formatTaka(request.fare.poolDiscount)}
          </p>
        )}
        {request.status === "COMPLETED" && <FareLines request={request} />}
      </div>

      {isCancellable(request.status) && (
        <button
          type="button"
          onClick={() => {
            if (confirmCancel) dispatch({ type: "CANCEL_RIDE", requestId: request.id });
            else setConfirmCancel(true);
          }}
          onBlur={() => setConfirmCancel(false)}
          className={cn(
            "active:scale-[0.98] w-full rounded-xl border py-2.5 text-xs font-bold transition-all",
            confirmCancel
              ? "border-destructive bg-destructive text-white"
              : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {confirmCancel ? "Tap again to confirm cancellation" : "Cancel ride"}
        </button>
      )}

      {request.status === "COMPLETED" && <RatingRow request={request} />}
    </div>
  );
}

export function FareLines({ request }: { request: RideRequest }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-primary flex items-center gap-1 text-[11px] font-bold"
      >
        {open ? "Hide" : "Show"} per-leg breakdown
        <IoSwapVertical className={cn("size-3 transition-transform", open && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring}
            className="overflow-hidden"
          >
            <div className="space-y-1 pt-2">
              {request.fare.lines.map((line) => (
                <div key={line.edgeId} className="text-muted-foreground flex justify-between text-[11px]">
                  <span className="truncate">
                    {stopName(line.from)} → {stopName(line.to)}
                    {line.riders > 1 && <span className="text-foreground font-semibold"> · {line.riders} riders −{line.discountPct}%</span>}
                  </span>
                  <span className="text-foreground shrink-0 font-semibold">{formatTaka(line.paidPaisa)}</span>
                </div>
              ))}
              <div className="text-muted-foreground flex justify-between border-t pt-1 text-[11px]">
                <span>Base fare</span>
                <span className="text-foreground font-semibold">{formatTaka(request.fare.baseFare)}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function RatingRow({ request }: { request: RideRequest }) {
  const { dispatch } = useStore();
  return (
    <div className="border-border flex items-center justify-center gap-1 rounded-xl border p-3">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
          onClick={() => dispatch({ type: "RATE_RIDE", requestId: request.id, rating: star })}
          className="active:scale-[0.85] transition-transform"
        >
          {(request.rating ?? 0) >= star ? (
            <IoStar className="text-warn size-6" />
          ) : (
            <IoStarOutline className="text-muted-foreground size-6" />
          )}
        </button>
      ))}
    </div>
  );
}

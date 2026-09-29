"use client";

import { useEffect } from "react";
import Link from "next/link";
import { IoArrowBack } from "react-icons/io5";
import { useStore } from "@/components/store";
import { formatTaka } from "@/lib/network";
import { Brand } from "@/components/app-nav";

/**
 * Read-only operations view (GET /admin/rides): every active ride, its seat
 * count and its riders. There is no write path here by design.
 */
export default function AdminPage() {
  const { me, persona, adminRides, refresh, error, busy } = useStore();

  useEffect(() => {
    if (me?.role === "admin") void refresh();
  }, [me?.role, refresh]);

  if (!persona) {
    return (
      <Frame>
        <Empty>Sign in as the demo admin to see the operations view.</Empty>
      </Frame>
    );
  }

  if (persona.role !== "admin") {
    return (
      <Frame>
        <Empty>
          This view is for the <code>admin</code> role. You are signed in as{" "}
          <strong>{persona.role}</strong>.
        </Empty>
      </Frame>
    );
  }

  return (
    <Frame>
      <div className="flex items-center justify-between pb-4">
        <h1 className="text-foreground text-xl font-black tracking-tight">Operations</h1>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={busy}
          className="border-border text-muted-foreground hover:bg-muted rounded-lg border px-3 py-1.5 text-xs font-bold transition-all disabled:opacity-50"
        >
          {busy ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-3 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive"
        >
          {error}
        </p>
      )}

      {adminRides.length === 0 ? (
        <Empty>No active rides. Nothing to supervise right now.</Empty>
      ) : (
        <ul className="space-y-2">
          {adminRides.map((ride) => {
            const total = ride.requests.reduce((sum, r) => sum + r.fare.total, 0);
            return (
              <li key={ride.id} className="bg-card border-border rounded-2xl border p-4 shadow-sm">
                <div className="flex items-center justify-between pb-1">
                  <p className="text-foreground text-sm font-bold">
                    {ride.vehicleName} · {ride.driverName}
                  </p>
                  <span className="bg-secondary text-primary rounded-full px-2 py-0.5 text-[10px] font-bold">
                    {ride.status}
                  </span>
                </div>
                <p className="text-muted-foreground pb-2 text-xs">
                  {ride.seatsTaken} of {ride.capacity} seats · {formatTaka(total)} collected
                </p>
                <ul className="space-y-1">
                  {ride.requests.map((r) => (
                    <li
                      key={r.id}
                      className="text-muted-foreground flex items-center justify-between text-[11px]"
                    >
                      <span className="truncate">{r.passengerName ?? "Rider"}</span>
                      <span className="shrink-0 font-semibold">{formatTaka(r.fare.total)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background min-h-dvh px-4 py-8">
      <div className="mx-auto w-full max-w-2xl">
        <Brand />
        <div className="pt-6">{children}</div>
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground mt-6 inline-flex items-center gap-1.5 text-xs font-semibold"
        >
          <IoArrowBack className="size-3.5" />
          Back to the map
        </Link>
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground rounded-2xl bg-muted p-6 text-center text-sm">{children}</p>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { IoArrowBack, IoRefresh, IoTrash } from "react-icons/io5";
import { useStore } from "@/components/store";
import { Brand } from "@/components/app-nav";
import { resetJourneys, type ApiResetResult } from "@/lib/api";

/**
 * Demo control: clear every rider and driver journey while the map stays.
 *
 * Wipes rides, requests, fares, the event log and the wallet ledger; keeps the
 * stops, legs, corridors, accounts and vehicles, so the session survives and
 * logins keep working. Requires the `admin` role.
 */
export default function ResetPage() {
  const { persona, refresh } = useStore();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ApiResetResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await resetJourneys();
      setResult(res);
      setArmed(false);
      // Pull the fresh (empty) state so every open screen updates at once.
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-background min-h-dvh px-4 py-8">
      <div className="mx-auto w-full max-w-xl">
        <Brand />

        <h1 className="text-foreground mt-6 text-xl font-black tracking-tight">
          Reset demo journeys
        </h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          Clears every passenger and driver journey — rides, requests, fares,
          trip events and wallet balances. The map itself is untouched: all
          stops, legs and corridors stay exactly as they are, and your accounts
          stay signed in.
        </p>

        <div className="bg-card border-border mt-5 rounded-2xl border p-4 shadow-sm">
          <p className="text-muted-foreground pb-2 text-xs font-bold tracking-wide uppercase">
            Cleared
          </p>
          <ul className="text-muted-foreground space-y-1 text-xs">
            {["Rides", "Ride requests and fares", "Ride event log", "Wallet balances and ledger"].map(
              (item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="bg-destructive/70 size-1.5 shrink-0 rounded-full" />
                  {item}
                </li>
              ),
            )}
          </ul>

          <p className="text-muted-foreground pt-4 pb-2 text-xs font-bold tracking-wide uppercase">
            Kept
          </p>
          <ul className="text-muted-foreground space-y-1 text-xs">
            {["Map stops and road legs", "Corridors and routes", "User accounts", "Driver vehicles"].map(
              (item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="bg-emerald-500 size-1.5 shrink-0 rounded-full" />
                  {item}
                </li>
              ),
            )}
          </ul>
        </div>

        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive"
          >
            {error}
          </p>
        )}

        {result && (
          <div className="mt-4 rounded-xl bg-secondary px-3 py-2 text-xs">
            <p className="text-foreground font-bold">Reset complete</p>
            <p className="text-muted-foreground mt-0.5">
              Emptied {result.cleared.length} table
              {result.cleared.length === 1 ? "" : "s"} · kept{" "}
              {result.preserved.length}
              {result.skipped.length > 0 && (
                <> · not in this schema: {result.skipped.join(", ")}</>
              )}
            </p>
          </div>
        )}

        <div className="mt-5 flex gap-2">
          {!armed ? (
            <button
              type="button"
              onClick={() => setArmed(true)}
              className="border-border text-foreground hover:bg-muted flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-all disabled:pointer-events-none disabled:opacity-50"
            >
              <IoTrash className="size-4" />
              Reset journeys
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setArmed(false)}
                className="border-border text-muted-foreground hover:bg-muted rounded-xl border px-4 py-2.5 text-sm font-bold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void run()}
                disabled={busy}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all disabled:opacity-60"
              >
                <IoRefresh className={busy ? "size-4 animate-spin" : "size-4"} />
                {busy ? "Resetting…" : "Yes, clear everything"}
              </button>
            </>
          )}
        </div>

        <p className="text-muted-foreground mt-2 text-center text-[11px]">
          Any signed-in user can reset the shared demo data — you are{" "}
          <strong>{persona?.role ?? "a guest"}</strong>.
        </p>

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
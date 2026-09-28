"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { IoArrowForward, IoInformationCircle, IoPower } from "react-icons/io5";
import { PERSONAS, useStore } from "@/components/store";
import { AppNav, SiteHeader } from "@/components/app-nav";
import { Spinner } from "@/components/loaders";
import { NODES, POOL_DISCOUNT_PCT } from "@/lib/network";
import { cn } from "@/lib/utils";

export default function AccountPage() {
  const { persona, dispatch, resetDemo } = useStore();
  const router = useRouter();

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6 pb-32 md:pb-24">
        <h1 className="text-foreground text-xl font-black tracking-tight">Account</h1>

        {!persona ? (
          <div className="bg-card border-border flex flex-col items-center gap-3 rounded-2xl border p-8 text-center shadow-sm">
            <Spinner className="text-primary size-6" />
            <p className="text-muted-foreground text-sm">
              You&apos;re browsing as a guest. Pick a persona to ride or drive.
            </p>
            <Link
              href="/login"
              className="bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97] inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold transition-all"
            >
              Choose persona <IoArrowForward />
            </Link>
          </div>
        ) : (
          <>
            {/* Current persona */}
            <motion.section
              key={persona.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", bounce: 0, duration: 0.35 }}
              className="bg-card border-border flex items-center gap-3 rounded-2xl border p-4 shadow-sm"
            >
              <span
                className={cn(
                  "flex size-14 shrink-0 items-center justify-center rounded-full text-xl font-black",
                  persona.role === "driver"
                    ? "bg-ink text-white"
                    : "bg-primary text-primary-foreground",
                )}
              >
                {persona.name[0]}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-foreground text-base font-bold">{persona.name}</p>
                <p className="text-muted-foreground text-xs">
                  {persona.role === "driver" ? "Driver" : "Passenger"} · {persona.phone}
                </p>
                <p className="text-muted-foreground text-xs">
                  Home zone: {NODES[persona.homeStopId]?.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => dispatch({ type: "SIGN_OUT" })}
                className="border-border text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.97] inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-all"
              >
                <IoPower className="size-3.5" />
                Sign out
              </button>
            </motion.section>
          </>
        )}

        {/* Switch persona */}
        <section className="bg-card border-border rounded-2xl border p-4 shadow-sm">
          <h2 className="text-foreground pb-2 text-sm font-bold">Switch demo persona</h2>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {PERSONAS.filter((p) => p.id !== persona?.id).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => dispatch({ type: "SIGN_IN", personaId: p.id })}
                  className="border-border hover:bg-secondary/50 active:scale-[0.99] flex w-full items-center gap-2.5 rounded-xl border p-2.5 text-left transition-all"
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-black",
                      p.role === "driver" ? "bg-ink text-white" : "bg-primary text-primary-foreground",
                    )}
                  >
                    {p.name[0]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-foreground block text-xs font-bold">{p.name}</span>
                    <span className="text-muted-foreground block text-[11px]">
                      {p.role === "driver" ? "Driver" : "Passenger"}
                    </span>
                  </span>
                  <IoArrowForward className="text-muted-foreground size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Fare model */}
        <section className="bg-card border-border rounded-2xl border p-4 shadow-sm">
          <h2 className="text-foreground flex items-center gap-1.5 pb-2 text-sm font-bold">
            <IoInformationCircle className="text-primary size-4" />
            How fares work
          </h2>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Every route is split into legs between stops. You pay the base fare
            plus only the legs you ride — and each leg shared with other riders
            gets a discount. Money is stored as integer paisa.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {Object.entries(POOL_DISCOUNT_PCT).map(([riders, pct]) => (
              <div
                key={riders}
                className="bg-secondary text-secondary-foreground rounded-xl p-2.5 text-center"
              >
                <p className="text-foreground text-sm font-black">
                  {pct === 0 ? "—" : `−${pct}%`}
                </p>
                <p className="text-muted-foreground text-[10px] font-semibold">
                  {riders} {Number(riders) === 1 ? "rider" : "riders"} on a leg
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Demo controls */}
        <section className="bg-card border-border rounded-2xl border p-4 shadow-sm">
          <h2 className="text-foreground pb-1 text-sm font-bold">Demo data</h2>
          <p className="text-muted-foreground pb-3 text-xs">
            Rides, trips and fares live on the server (Express + PostgreSQL).
            Resetting signs you out; <code className="text-foreground">npm run seed</code> in
            the backend restores the seeded history.
          </p>
          <button
            type="button"
            onClick={() => {
              resetDemo();
              router.push("/");
            }}
            className="border-destructive text-destructive hover:bg-destructive active:scale-[0.98] w-full rounded-xl border py-2.5 text-xs font-bold transition-all hover:text-white"
          >
            Sign out & clear local session
          </button>
        </section>
      </main>
      <AppNav />
    </div>
  );
}

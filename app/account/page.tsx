"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { IoArrowForward, IoPower } from "react-icons/io5";
import { PERSONAS, useStore } from "@/components/store";
import { AppNav, SiteHeader } from "@/components/app-nav";
import { Spinner } from "@/components/loaders";
import { WalletCard } from "@/components/wallet-card";
import { NODES } from "@/lib/network";
import { cn } from "@/lib/utils";

/**
 * The signed-in user's own account: profile, wallet, and a way out. Persona
 * switching lives here too because this is a demo, but the fare explainer and
 * the data blurb deliberately do not — they are reference material, not
 * something you want in front of someone who just wants their balance.
 */
export default function AccountPage() {
  const { persona, dispatch, resetDemo, vehicle } = useStore();
  const router = useRouter();

  if (!persona) {
    return (
      <div className="bg-background flex min-h-dvh flex-col">
        <SiteHeader />
        <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6 pb-32 md:pb-24">
          <h1 className="text-foreground text-xl font-black tracking-tight">Account</h1>
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
        </main>
        <AppNav />
      </div>
    );
  }

  return (
    <div className="bg-background flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-6 pb-32 md:pb-24">
        <h1 className="text-foreground text-xl font-black tracking-tight">Account</h1>

        {/* Profile */}
        <motion.section
          key={persona.id}
          initial={{ y: 10 }}
          animate={{ y: 0 }}
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
              {vehicle && ` · ${vehicle.name} (${vehicle.capacity} seats)`}
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

        {/* Wallet */}
        <WalletCard />

        {/* Switch persona */}
        <section className="bg-card border-border rounded-2xl border p-4 shadow-sm">
          <h2 className="text-foreground pb-2 text-sm font-bold">Switch demo persona</h2>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {PERSONAS.filter((p) => p.id !== persona.id).map((p) => (
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

        <section className="bg-card border-border rounded-2xl border p-4 shadow-sm">
          <h2 className="text-foreground pb-1 text-sm font-bold">Demo data</h2>
          <p className="text-muted-foreground pb-3 text-xs">
            Rides, trips and fares live on the server. Admin can wipe journeys
            from <code className="text-foreground">/reset</code> without
            disturbing the map.
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
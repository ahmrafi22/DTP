"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { IoArrowForward, IoCarSportOutline, IoLockClosedOutline, IoPerson, IoPersonOutline } from "react-icons/io5";
import { PERSONAS, useStore, type Persona } from "@/components/store";
import { Brand } from "@/components/app-nav";
import { cn } from "@/lib/utils";

const spring = { type: "spring" as const, bounce: 0, duration: 0.4 };

export default function LoginPage() {
  const { login, busy, error } = useStore();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const signInPersona = (persona: Persona) => {
    // One-tap demo login: the seeded cast all share the demo password.
    void login(persona.phone, "demo1234").then(() => router.push("/"));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    void login(phone, password)
      .then(() => router.push("/"))
      .catch(() => setFormError("Could not sign in — check the phone and password."));
  };

  return (
    <div className="bg-background flex min-h-dvh flex-col items-center px-4 py-10 pb-32 md:py-16">
      <Brand />
      <h1 className="text-foreground mt-8 text-center text-2xl font-black tracking-tight">
        Who&apos;s riding today?
      </h1>
      <p className="text-muted-foreground mt-2 max-w-sm text-center text-sm leading-relaxed">
        Sign in to book and run shared rides. One shared Tesla, fares split by
        the legs you ride.
      </p>

      <form
        onSubmit={submit}
        className="bg-card border-border mt-8 grid w-full max-w-sm gap-2 rounded-2xl border p-4 shadow-sm"
      >
        <label className="text-muted-foreground text-[11px] font-bold tracking-wide uppercase">
          Phone
        </label>
        <div className="border-border focus-within:border-primary flex items-center gap-2 rounded-xl border px-3 py-2.5">
          <IoPersonOutline className="text-muted-foreground size-4 shrink-0" />
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+880 171 0001001"
            autoComplete="tel"
            className="text-foreground placeholder:text-muted-foreground w-full bg-transparent text-sm font-semibold outline-none"
          />
        </div>
        <label className="text-muted-foreground mt-1 text-[11px] font-bold tracking-wide uppercase">
          Password
        </label>
        <div className="border-border focus-within:border-primary flex items-center gap-2 rounded-xl border px-3 py-2.5">
          <IoLockClosedOutline className="text-muted-foreground size-4 shrink-0" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            className="text-foreground placeholder:text-muted-foreground w-full bg-transparent text-sm font-semibold outline-none"
          />
        </div>
        {(formError ?? error) && (
          <p className="text-destructive pt-1 text-xs font-semibold">{formError ?? error}</p>
        )}
        <button
          type="submit"
          disabled={busy || !phone || !password}
          className="bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] mt-2 inline-flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold transition-all disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="text-muted-foreground mt-8 text-center text-[11px] font-bold tracking-wide uppercase">
        Or tap a demo persona — password demo1234
      </p>
      <div className="mt-3 grid w-full max-w-3xl gap-3 sm:grid-cols-2">
        {PERSONAS.map((persona, i) => (
          <motion.button
            key={persona.id}
            type="button"
            onClick={() => signInPersona(persona)}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: i * 0.05 }}
            whileTap={{ scale: 0.98 }}
            className="bg-card border-border hover:border-primary hover:bg-secondary/50 flex items-center gap-3 rounded-2xl border p-4 text-left shadow-sm transition-colors"
          >
            <PersonaAvatar persona={persona} />
            <span className="min-w-0 flex-1">
              <span className="text-foreground block text-sm font-bold">
                {persona.name}
              </span>
              <span className="text-muted-foreground block text-xs">
                {persona.role === "driver" ? "Driver · Dhaka Tesla" : "Passenger"}
                {" · "}
                {persona.phone}
              </span>
            </span>
            <IoArrowForward className="text-muted-foreground size-4 shrink-0" />
          </motion.button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => router.push("/")}
        className="text-muted-foreground hover:text-foreground mt-6 text-xs font-semibold transition-colors"
      >
        Continue as guest — browse the live map
      </button>
    </div>
  );
}

export function PersonaAvatar({ persona }: { persona: Persona }) {
  return (
    <span
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-full text-base font-black",
        persona.role === "driver"
          ? "bg-ink text-white"
          : "bg-primary text-primary-foreground",
      )}
    >
      {persona.role === "driver" ? (
        <IoCarSportOutline className="size-5" />
      ) : (
        <IoPerson className="size-5" />
      )}
    </span>
  );
}

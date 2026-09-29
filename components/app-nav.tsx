"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { IoMap, IoPerson, IoShieldCheckmark, IoTime } from "react-icons/io5";
import { useStore } from "@/components/store";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: typeof IoMap; role?: "admin" };

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Map", icon: IoMap },
  { href: "/activity", label: "Activity", icon: IoTime },
  { href: "/account", label: "Account", icon: IoPerson },
  // Operations view — only meaningful for the admin role.
  { href: "/admin", label: "Ops", icon: IoShieldCheckmark, role: "admin" as const },
];

function isActivePath(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Brand wordmark. */
export function Brand() {
  return (
    <span className="flex items-center gap-2">
      <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-lg text-sm font-black">
        T
      </span>
      <span className="text-foreground text-sm font-bold tracking-tight">
        Dhaka Tesla Pool
      </span>
    </span>
  );
}

export function PersonaChip() {
  const { persona } = useStore();
  return (
    <Link
      href="/account"
      className="bg-secondary text-secondary-foreground hover:bg-accent flex items-center gap-1.5 rounded-full py-1 pr-3 pl-1 text-xs font-semibold transition-colors"
    >
      <span
        className={cn(
          "flex size-6 items-center justify-center rounded-full text-[10px] font-bold",
          persona?.role === "driver"
            ? "bg-ink text-white"
            : "bg-primary text-primary-foreground",
        )}
      >
        {persona ? persona.name[0] : "?"}
      </span>
      {persona ? persona.name : "Guest"}
    </Link>
  );
}

/**
 * Floating rounded bottom navbar, shared by every page and viewport.
 * The active item's background slides between items (motion layoutId).
 * Small on desktop, roomier with labels on mobile.
 */
export function AppNav() {
  const pathname = usePathname();
  const { persona } = useStore();

  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-[calc(0.875rem+env(safe-area-inset-bottom))] left-1/2 z-40 -translate-x-1/2"
    >
      <div className="border-border bg-card shadow-zinc-950/10 flex items-center gap-0.5 rounded-full border p-1.5 shadow-lg md:gap-1 md:p-1">
        {NAV_ITEMS.filter((item) => !item.role || item.role === persona?.role).map((item) => {
          const active = isActivePath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex items-center gap-1.5 rounded-full px-4 py-2 transition-colors md:px-3.5 md:py-1.5",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-active-pill"
                  className="bg-secondary absolute inset-0 rounded-full"
                  transition={{ type: "spring", bounce: 0.18, duration: 0.45 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <item.icon
                  className={cn("size-5 md:size-4", active && "text-primary")}
                />
                <span
                  className={cn(
                    "text-[11px] font-bold md:text-xs",
                    active && "text-primary",
                  )}
                >
                  {item.label}
                </span>
              </span>
              {item.href === "/activity" && persona?.role === "driver" && (
                <DriverBadge />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Little green dot when the signed-in driver has pending work. */
function DriverBadge() {
  const { state, persona } = useStore();
  const pending = state.requests.filter((r) => r.status === "REQUESTED").length;
  const online = persona ? state.onlineDriverIds.includes(persona.id) : false;
  if (!online || pending === 0) return null;
  return (
    <span className="bg-primary absolute top-1 right-1 size-2 animate-pulse rounded-full" />
  );
}

/** Slim header for non-map pages: brand + persona only (nav lives below). */
export function SiteHeader() {
  return (
    <header className="bg-background/95 border-border sticky top-0 z-30 border-b">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <Link href="/" className="transition-transform active:scale-[0.98]">
          <Brand />
        </Link>
        <PersonaChip />
      </div>
    </header>
  );
}

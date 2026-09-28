import { DotsPulse } from "@/components/loaders";

/** Route-level loading state so a slow first paint is not a blank screen. */
export default function Loading() {
  return (
    <div className="bg-background flex min-h-dvh flex-col items-center justify-center gap-3">
      <DotsPulse className="text-primary size-7" />
      <p className="text-muted-foreground text-xs font-semibold">Loading Dhaka Tesla Pool…</p>
    </div>
  );
}

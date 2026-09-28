"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary. Without this a render-time throw leaves a blank
 * page with no way back.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="bg-background flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-foreground text-lg font-black">Something broke</h1>
      <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
        {error.message || "An unexpected error stopped this page from rendering."}
      </p>
      <button
        type="button"
        onClick={reset}
        className="bg-primary text-primary-foreground rounded-xl px-4 py-2.5 text-sm font-bold transition-all active:scale-[0.98]"
      >
        Try again
      </button>
    </div>
  );
}

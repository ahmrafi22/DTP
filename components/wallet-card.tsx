"use client";

import { useState } from "react";
import { IoAddCircleOutline, IoWalletOutline } from "react-icons/io5";
import { useStore } from "@/components/store";
import { TOPUP_TAKA } from "@/lib/api";
import { formatTaka } from "@/lib/network";

/**
 * TeslaPay wallet card: the balance, a one-tap ৳100 top-up, and the most
 * recent ledger entries.
 *
 * The button adds money immediately with no confirmation step. This is a
 * simulated wallet holding no real value, so a confirm dialog on "add ৳100"
 * would only be friction — and the server writes an immutable ledger row for
 * every press, so the balance is always reconcilable afterwards.
 */
export function WalletCard() {
  const { wallet, topUp, busy, error } = useStore();
  const [adding, setAdding] = useState(false);

  const balance = wallet?.balancePaisa ?? 0;

  const onAdd = async () => {
    setAdding(true);
    try {
      await topUp();
    } finally {
      setAdding(false);
    }
  };

  return (
    <section className="bg-card border-border rounded-2xl border p-4 shadow-sm">
      <div className="flex items-center gap-2 pb-3">
        <IoWalletOutline className="text-primary size-4" />
        <h2 className="text-foreground text-sm font-bold">TeslaPay wallet</h2>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
            Balance
          </p>
          <p className="text-foreground text-2xl font-black tabular-nums">
            {formatTaka(balance)}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void onAdd()}
          disabled={busy || adding}
          className="bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97] inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all disabled:pointer-events-none disabled:opacity-60"
        >
          <IoAddCircleOutline className="size-4" />
          {adding || busy ? "Adding…" : `Add ${TOPUP_TAKA} BDT`}
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-destructive/10 px-2.5 py-1.5 text-[11px] font-semibold text-destructive"
        >
          {error}
        </p>
      )}

      <p className="text-muted-foreground mt-3 text-[11px] leading-relaxed">
        Simulated wallet for the demo — no real money. Every top-up is written
        to an append-only ledger.
      </p>
    </section>
  );
}
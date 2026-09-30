/**
 * The clock every trip animation is measured against.
 *
 * The auto's position has to be identical in every browser session, so it
 * cannot be derived from `Date.now()` alone: two machines with clocks a few
 * seconds apart would draw the same ride in different places. This measures
 * the offset between the server clock and this machine's clock once, and hands
 * out a `serverNow()` that every consumer uses instead of `Date.now()`.
 *
 * Combined with the server's immutable `rides.started_at`, that makes the
 * position a pure function of one shared instant and one shared clock — so two
 * browsers open at the same moment show the auto in the same place.
 *
 * Before the first measurement (and if it fails) the offset is 0, which
 * degrades to plain local time rather than breaking the animation.
 */

let offsetMs = 0;

/** Re-anchor against the server. Safe to call often; cheap. */
export function setServerOffset(serverTime: string | number | Date | null | undefined): void {
  if (serverTime == null) return;
  const serverMs =
    typeof serverTime === "number"
      ? serverTime
      : typeof serverTime === "string"
        ? Date.parse(serverTime)
        : serverTime.getTime();
  if (!Number.isFinite(serverMs)) return;
  offsetMs = serverMs - Date.now();
}

/** Current offset in ms; exposed for tests and diagnostics. */
export const serverOffset = (): number => offsetMs;

/** The server's notion of now, as epoch milliseconds. */
export const serverNow = (): number => Date.now() + offsetMs;
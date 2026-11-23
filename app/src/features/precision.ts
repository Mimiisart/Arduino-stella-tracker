/**
 * Precision Find (UWB) state for the Precision screen.
 *
 * The firmware side is ready (StellaUWB's Nearby Interaction accessory service).
 * The phone side needs a native Expo module wrapping Apple's NearbyInteraction
 * framework (NISession + accessory configuration over the Nordic UART service),
 * which is not built yet. Until it is, this reports `unavailable` with the
 * reason, and the screen shows its fallback view.
 */
export type PrecisionState =
  | { kind: 'unavailable'; reason: 'not-built' | 'no-uwb' | 'not-connected' }
  | { kind: 'searching' }
  | { kind: 'ranging'; metres: number; bearingDeg: number | null };

export function usePrecision(connected: boolean): PrecisionState {
  if (!connected) return { kind: 'unavailable', reason: 'not-connected' };
  return { kind: 'unavailable', reason: 'not-built' };
}

/** "Ahead", "Ahead, a little to your left", "Behind you"… from a bearing in degrees (0 = ahead). */
export function describeBearing(deg: number | null): string {
  if (deg == null) return 'Move around slowly to find the direction';
  const d = ((deg % 360) + 540) % 360 - 180; // -180..180, negative = left
  const a = Math.abs(d);
  if (a <= 12) return 'Straight ahead';
  const side = d < 0 ? 'left' : 'right';
  if (a <= 35) return `Ahead, a little to your ${side}`;
  if (a <= 110) return `To your ${side}`;
  return 'Behind you';
}

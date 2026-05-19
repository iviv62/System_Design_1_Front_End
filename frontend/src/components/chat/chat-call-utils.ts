/**
 * Pure utility helpers for the active-call component family.
 * No Lit dependency — safe to unit-test without instantiating any element.
 */

const AVATAR_COLORS = ["#f59e0b", "#3b82f6", "#a855f7", "#ec4899", "#10b981", "#ef4444"];

/**
 * Returns the first two characters of `name` uppercased, or "?" when empty.
 */
export function getInitials(name: string): string {
  return name ? name.substring(0, 2).toUpperCase() : "?";
}

/**
 * Deterministically maps a username to one of the avatar palette colours.
 * Uses a simple djb2-style hash so the same name always returns the same colour.
 */
export function getColorForUser(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

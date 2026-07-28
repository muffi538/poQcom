import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

// scrypt via Node's built-in crypto — no external hashing library needed.
// Stored as "saltHex:hashHex" so verifyPassword is self-contained (no
// separate salt column/config to keep in sync).
const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const hashBuffer = Buffer.from(hash, "hex");
  const candidate = scryptSync(password, salt, KEY_LENGTH);
  // Different lengths would make timingSafeEqual throw rather than
  // return false, so guard it explicitly before comparing.
  if (candidate.length !== hashBuffer.length) return false;
  return timingSafeEqual(new Uint8Array(candidate), new Uint8Array(hashBuffer));
}

// Minimum length + character-class variety — a pragmatic strength rule
// (not just "6 characters") without demanding a specific special
// character set that tends to just push people toward "Passw0rd!".
// Returns an error message, or null when the password is strong enough.
export function validatePasswordStrength(password: string): string | null {
  if (password.length < 10) return "Password must be at least 10 characters.";
  if (password.length > 128) return "Password must be at most 128 characters.";
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((re) => re.test(password)).length;
  if (classes < 3) {
    return "Password must include at least 3 of: lowercase, uppercase, numbers, symbols.";
  }
  return null;
}

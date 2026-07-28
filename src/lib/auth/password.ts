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

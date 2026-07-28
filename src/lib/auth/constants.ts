// Split out from session.ts so proxy.ts (Edge runtime) can import just
// the cookie name without pulling in next/headers, which only works in
// Server Components/Actions, not proxy.ts.
export const SESSION_COOKIE = "session";

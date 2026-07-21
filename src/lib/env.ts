/**
 * Environment variable accessors.
 *
 * Read-once helpers that fail fast when a required env var is missing —
 * replacing the `process.env.X!` pattern (which lies to TypeScript and
 * blows up at runtime with a cryptic `undefined` later).
 *
 * `NEXT_PUBLIC_*` vars are bundled into the client at build time and
 * must be set before `next build`. Server-only vars (anything without
 * the `NEXT_PUBLIC_` prefix) are read at request time.
 */

function readEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export function requireEnv(name: string): string {
  return readEnv(name);
}

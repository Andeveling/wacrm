import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

// Singleton instance — one client shared across the whole browser session.
// Creating multiple clients causes auth-lock contention ("Lock was released
// because another request stole it") and intermittent fetch failures.
let browserClient: SupabaseClient | undefined;

export function createClient() {
  if (browserClient) return browserClient;

  // NEXT_PUBLIC_* vars must be accessed as literal `process.env.X` — the
  // bundler inlines them at build time and can't follow requireEnv(name).
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) throw new Error('Missing required environment variable: NEXT_PUBLIC_SUPABASE_URL');
  if (!anonKey) throw new Error('Missing required environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY');

  browserClient = createBrowserClient(url, anonKey);

  return browserClient;
}

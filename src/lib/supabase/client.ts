"use client";

import { createBrowserClient } from "@supabase/ssr";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const isConfigured =
  SUPABASE_URL.startsWith("http") && SUPABASE_ANON_KEY.length > 0;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: ReturnType<typeof createBrowserClient<any>> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createClient(): ReturnType<typeof createBrowserClient<any>> {
  if (_client) return _client;

  _client = createBrowserClient(
    isConfigured ? SUPABASE_URL : "https://placeholder.supabase.co",
    isConfigured ? SUPABASE_ANON_KEY : "placeholder-key"
  );

  return _client;
}

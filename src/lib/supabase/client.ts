"use client";

import { createBrowserClient } from "@supabase/ssr";
import { assertSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "./env";

let client: ReturnType<typeof createBrowserClient> | undefined;

/** Клиент Supabase для браузера (anon key + сессия пользователя). */
export function getSupabaseBrowserClient() {
  assertSupabaseConfigured();
  client ??= createBrowserClient(supabaseUrl, supabaseAnonKey);
  return client;
}

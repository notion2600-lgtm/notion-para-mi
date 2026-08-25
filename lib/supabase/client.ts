import { createBrowserClient } from "@supabase/ssr";

import { getSupabaseEnv } from "@/lib/env";

export function createClient() {
  const env = getSupabaseEnv();

  if (!env) {
    throw new Error("Faltan las variables públicas de Supabase.");
  }

  return createBrowserClient(env.url, env.anonKey);
}

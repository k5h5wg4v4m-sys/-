import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { assertSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "./env";

/** Клиент Supabase для серверных компонентов и server actions (от имени пользователя, с RLS). */
export async function getSupabaseServerClient() {
  assertSupabaseConfigured();
  const store = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Вызов из Server Component: куки обновит middleware.
        }
      },
    },
  });
}

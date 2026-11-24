import "server-only";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "./supabase/env";
import { getSupabaseServerClient } from "./supabase/server";

export type CurrentUser = {
  id: string;
  phone: string | null;
  balance: number;
  role: "admin" | "moderator" | null;
};

/** Текущий пользователь по сессии из cookies (данные из базы, с RLS). null — не вошёл. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: staff }] = await Promise.all([
    supabase.from("profiles").select("phone, balance").eq("id", user.id).maybeSingle(),
    supabase.from("admins").select("role").eq("user_id", user.id).maybeSingle(),
  ]);

  return {
    id: user.id,
    phone: (profile?.phone as string | null) ?? user.phone ?? null,
    balance: Number(profile?.balance ?? 0),
    role: (staff?.role as CurrentUser["role"]) ?? null,
  };
}

/** Безопасный внутренний путь для возврата после входа. */
export function safeNext(next: unknown, fallback = "/profile"): string {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

/** Для защищённых страниц: без входа — на /login с возвратом. */
export async function requireUser(returnTo: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}

/** Только role = admin (moderator не допускается к деньгам). Права всё равно проверяет база. */
export async function requireAdmin(returnTo: string): Promise<CurrentUser> {
  const user = await requireUser(returnTo);
  if (user.role !== "admin") redirect("/profile");
  return user;
}

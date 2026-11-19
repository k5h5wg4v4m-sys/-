import "server-only";
import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "./supabase/server";
import { isSupabaseConfigured } from "./supabase/env";

export type Profile = {
  id: string;
  phone: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  birth_year: number | null;
  gender: "male" | "female" | null;
  avatar_path: string | null;
  status: "active" | "blocked";
  created_at: string;
};

export type Session = { user: User; profile: Profile | null };

/** Текущий пользователь и его профиль (один запрос на рендер). null — гость. */
export const getSession = cache(async (): Promise<Session | null> => {
  if (!isSupabaseConfigured) return null;
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, phone, email, first_name, last_name, middle_name, birth_year, gender, avatar_path, status, created_at")
    .eq("id", data.user.id)
    .maybeSingle<Profile>();

  return { user: data.user, profile: profile ?? null };
});

/** Пароль задаётся после подтверждения номера; флаг ставит форма /set-password. */
export function hasPassword(user: User) {
  return user.user_metadata?.password_set === true;
}

export function isProfileComplete(profile: Profile | null) {
  return Boolean(profile?.first_name && profile.last_name && profile.birth_year && profile.gender);
}

/** Куда отправить вошедшего пользователя, если регистрация не закончена. */
export function onboardingStep(session: Session): "/set-password" | "/onboarding" | null {
  if (!hasPassword(session.user)) return "/set-password";
  if (!isProfileComplete(session.profile)) return "/onboarding";
  return null;
}

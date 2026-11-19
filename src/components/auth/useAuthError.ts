"use client";

import { useTranslations } from "next-intl";
import { getAuthErrorKey } from "@/lib/auth-errors";
import { getDbErrorCode } from "@/lib/db-errors";

/** Понятный текст ошибки Supabase Auth на текущем языке. */
export function useAuthErrorText() {
  const t = useTranslations("authErrors");
  return (error: unknown) => t(getAuthErrorKey(error));
}

/** Понятный текст ошибки SQL-функции/RLS на текущем языке. */
export function useDbErrorText() {
  const t = useTranslations("dbErrors");
  return (error: unknown) => t(getDbErrorCode(error));
}

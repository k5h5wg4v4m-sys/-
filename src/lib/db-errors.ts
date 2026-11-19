/** Коды ошибок, которые возвращают SQL-функции базы. Переводы: messages/*.json -> dbErrors. */
export const DB_ERROR_CODES = [
  "insufficient_funds",
  "account_blocked",
  "profile_incomplete",
  "bad_days",
  "bad_title",
  "bad_phone",
  "bad_region",
  "bad_price",
  "bad_images",
  "bad_image",
  "bad_status",
  "not_found",
  "forbidden",
  "reason_required",
  "already_reviewed",
  "listing_not_available",
  "own_listing",
  "proof_required",
  "bad_amount",
  "bad_method",
] as const;

export type DbErrorCode = (typeof DB_ERROR_CODES)[number];

// Длинные коды проверяем раньше коротких (bad_images раньше bad_image).
const BY_LENGTH = [...DB_ERROR_CODES].sort((a, b) => b.length - a.length);

/** Достаёт код из ошибки supabase.rpc (message/details/hint). "unknown", если кода нет. */
export function getDbErrorCode(error: unknown): DbErrorCode | "unknown" {
  if (!error) return "unknown";
  const parts: string[] = [];
  if (typeof error === "string") parts.push(error);
  else if (typeof error === "object") {
    for (const key of ["message", "details", "hint", "code"] as const) {
      const v = (error as Record<string, unknown>)[key];
      if (typeof v === "string") parts.push(v);
    }
  }
  const text = parts.join(" ");
  for (const code of BY_LENGTH) {
    if (new RegExp(`(^|[^a-z_])${code}([^a-z_]|$)`).test(text)) return code;
  }
  return "unknown";
}

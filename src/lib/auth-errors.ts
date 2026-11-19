/** Ошибки Supabase Auth -> ключи перевода authErrors.* (messages/*.json). */
export const AUTH_ERROR_KEYS = [
  "invalid_credentials",
  "invalid_code",
  "code_expired",
  "rate_limit",
  "sms_failed",
  "sms_disabled",
  "user_not_found",
  "weak_password",
  "same_password",
  "session_expired",
  "network",
  "not_configured",
  "unknown",
] as const;

export type AuthErrorKey = (typeof AUTH_ERROR_KEYS)[number];

const BY_CODE: Record<string, AuthErrorKey> = {
  invalid_credentials: "invalid_credentials",
  otp_expired: "code_expired",
  over_sms_send_rate_limit: "rate_limit",
  over_request_rate_limit: "rate_limit",
  sms_send_failed: "sms_failed",
  phone_provider_disabled: "sms_disabled",
  otp_disabled: "user_not_found", // shouldCreateUser: false и номера нет
  signup_disabled: "sms_disabled",
  user_not_found: "user_not_found",
  weak_password: "weak_password",
  same_password: "same_password",
  session_not_found: "session_expired",
  session_expired: "session_expired",
  refresh_token_not_found: "session_expired",
  validation_failed: "invalid_code",
};

export function getAuthErrorKey(error: unknown): AuthErrorKey {
  if (!error) return "unknown";
  if (error instanceof Error && error.message === "supabase_not_configured") return "not_configured";
  const e = error as { code?: unknown; message?: unknown; status?: unknown; name?: unknown };
  if (typeof e.code === "string" && BY_CODE[e.code]) return BY_CODE[e.code];

  const msg = typeof e.message === "string" ? e.message.toLowerCase() : "";
  if (e.name === "AuthRetryableFetchError" || msg.includes("failed to fetch") || msg.includes("network")) return "network";
  if (msg.includes("invalid login credentials")) return "invalid_credentials";
  if (msg.includes("token has expired") || msg.includes("is invalid")) return "code_expired";
  if (msg.includes("rate limit") || e.status === 429) return "rate_limit";
  if (msg.includes("signups not allowed")) return "user_not_found";
  return "unknown";
}

export type PaymentMethod = {
  id: string;
  code: string;
  name: string;
  recipient_name: string | null;
  account_number: string | null;
  instructions_ru: string | null;
  instructions_ky: string | null;
  qr_path: string | null;
  is_enabled: boolean;
  sort_order: number;
};

export const PAYMENT_METHOD_FIELDS =
  "id, code, name, recipient_name, account_number, instructions_ru, instructions_ky, qr_path, is_enabled, sort_order";

/** Границы суммы заявки — те же, что проверяет public.create_topup_request (только для подсказок). */
export const TOPUP_MIN = 1;
export const TOPUP_MAX = 1_000_000;

export function instructionsFor(m: Pick<PaymentMethod, "instructions_ru" | "instructions_ky">, locale: string) {
  return (locale === "ky" ? m.instructions_ky || m.instructions_ru : m.instructions_ru || m.instructions_ky) ?? null;
}

/** Текст для кнопки «Скопировать реквизиты». */
export function requisitesText(m: Pick<PaymentMethod, "name" | "recipient_name" | "account_number">) {
  return [m.name, m.recipient_name, m.account_number].filter(Boolean).join("\n");
}

/** Только цифры: "1 200" -> 1200. null, если пусто. */
export function parseAmount(input: string): number | null {
  const digits = input.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}

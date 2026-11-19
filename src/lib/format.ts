export const TIME_ZONE = "Asia/Bishkek";

/** 1200 -> "1 200" (разделитель тысяч — пробел). Только для отображения. */
export function formatNumber(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded < 0 ? "-" : "";
  return sign + String(Math.abs(rounded)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** 1200 -> "1 200 сом". `currency` берётся из словаря (common.currency). */
export function formatPrice(value: number, currency: string): string {
  return `${formatNumber(value)} ${currency}`;
}

/** Дата/время в часовом поясе Бишкека. */
export function formatDateTime(
  value: string | number | Date,
  locale: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" },
): string {
  return new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, ...options }).format(new Date(value));
}

export function formatDate(value: string | number | Date, locale: string): string {
  return formatDateTime(value, locale, { day: "numeric", month: "long", year: "numeric" });
}

/**
 * Приводит ввод пользователя к формату Supabase Auth: "996XXXXXXXXX" (без плюса).
 * Принимает "+996 555 12 34 56", "996555123456", "0555123456", "555123456".
 * Возвращает null, если номер не кыргызстанский (+996 и 9 цифр).
 */
export function normalizeKgPhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits.length === 9) digits = "996" + digits;
  return /^996\d{9}$/.test(digits) ? digits : null;
}

/** "996555123456" -> "+996 555 123 456" */
export function formatKgPhone(stored: string): string {
  const n = normalizeKgPhone(stored);
  if (!n) return stored;
  return `+996 ${n.slice(3, 6)} ${n.slice(6, 9)} ${n.slice(9)}`;
}

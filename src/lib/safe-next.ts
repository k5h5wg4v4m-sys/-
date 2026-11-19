/** Безопасный адрес возврата после входа: только внутренний путь. */
export function safeNext(next: string | string[] | undefined, fallback = "/") {
  const v = Array.isArray(next) ? next[0] : next;
  if (!v || !v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return fallback;
  return v;
}

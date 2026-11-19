/**
 * Правила пароля TABYLGA (SPEC.md, раздел 2). Проверка в браузере — для подсказок;
 * минимальные требования дублируются в настройках Supabase Auth (см. supabase/AUTH.md).
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72; // предел bcrypt в Supabase Auth

export type PasswordRule = "length" | "upper" | "lower" | "digit" | "special";
export type PasswordProblem = "latinOnly" | "noSpaces" | "tooLong";
export type PasswordStrength = "weak" | "medium" | "strong";

export const PASSWORD_RULES: PasswordRule[] = ["length", "upper", "lower", "digit", "special"];

const TESTS: Record<PasswordRule, (p: string) => boolean> = {
  length: (p) => p.length >= PASSWORD_MIN_LENGTH,
  upper: (p) => /[A-Z]/.test(p),
  lower: (p) => /[a-z]/.test(p),
  digit: (p) => /[0-9]/.test(p),
  // Спецсимвол — любой видимый ASCII-символ, кроме букв и цифр.
  special: (p) => /[!-/:-@[-`{-~]/.test(p),
};

export function checkPassword(password: string) {
  const passed = PASSWORD_RULES.filter((r) => TESTS[r](password));
  const problems: PasswordProblem[] = [];
  if (/\s/.test(password)) problems.push("noSpaces");
  // Разрешены только видимые латинские символы ASCII (0x21–0x7E).
  if (/[^\s!-~]/.test(password)) problems.push("latinOnly");
  if (password.length > PASSWORD_MAX_LENGTH) problems.push("tooLong");

  let strength: PasswordStrength = "weak";
  if (problems.length === 0 && passed.length === PASSWORD_RULES.length) strength = "strong";
  else if (problems.length === 0 && passed.length >= 3 && TESTS.length(password)) strength = "medium";

  return {
    passed: new Set(passed),
    problems,
    strength,
    valid: problems.length === 0 && passed.length === PASSWORD_RULES.length,
  };
}

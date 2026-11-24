// Создание (или смена пароля) разрешённого аккаунта в Supabase Auth.
// Регистрация в приложении закрыта, поэтому аккаунт создаётся этим скриптом один раз.
//
//   node --env-file=.env.local scripts/create-account.mjs +996700700700
//
// Нужны в .env.local: NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY (секретный ключ,
// только на вашем компьютере, не в git и не в Vercel-переменных с префиксом NEXT_PUBLIC_).
// Пароль спрашивается в терминале и нигде не сохраняется. Номер должен быть в signup_allowlist
// (миграция 007), иначе база откажет с ошибкой signup_closed.
import { createInterface } from "node:readline/promises";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Заполните NEXT_PUBLIC_SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env.local");
  process.exit(1);
}

let digits = (process.argv[2] ?? "").replace(/\D/g, "");
if (digits.length === 9) digits = "996" + digits;
if (!/^996\d{9}$/.test(digits)) {
  console.error("Укажите номер: +996 и 9 цифр, например +996700700700");
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = await rl.question("Пароль (минимум 8 символов): ");
rl.close();
if (password.length < 8) {
  console.error("Пароль слишком короткий");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } }).auth.admin;

// Ищем существующий аккаунт с этим номером.
let existing = null;
for (let page = 1; !existing; page++) {
  const { data, error } = await admin.listUsers({ page, perPage: 200 });
  if (error) throw error;
  existing = data.users.find((u) => u.phone === digits) ?? null;
  if (data.users.length < 200) break;
}

const { error } = existing
  ? await admin.updateUserById(existing.id, { password })
  : await admin.createUser({ phone: digits, password, phone_confirm: true });
if (error) {
  console.error("Ошибка:", error.message);
  process.exit(1);
}
console.log(existing ? "Пароль обновлён для +" + digits : "Аккаунт создан: +" + digits);

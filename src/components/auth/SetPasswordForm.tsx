"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { checkPassword, PASSWORD_MAX_LENGTH } from "@/lib/password";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { FormError } from "./AuthCard";
import { PasswordInput } from "./PasswordInput";
import { PasswordStrength } from "./PasswordStrength";
import { useAuthErrorText } from "./useAuthError";

/** Пароль вводится дважды; сохраняется в Supabase Auth (bcrypt). */
export function SetPasswordForm({ mode, next }: { mode: "register" | "reset"; next: string }) {
  const t = useTranslations("auth");
  const errorText = useAuthErrorText();
  const toast = useToast();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const check = checkPassword(password);
  const mismatch = confirm.length > 0 && confirm !== password;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (!check.valid) {
      setError(t("passwordWeak"));
      return;
    }
    if (password !== confirm) {
      setError(t("passwordMismatch"));
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password, data: { password_set: true } });
      if (error) throw error;
      if (mode === "reset") toast(t("passwordSaved"));
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(errorText(err));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field label={t("newPassword")} htmlFor="password">
        <PasswordInput
          id="password"
          autoComplete="new-password"
          autoFocus
          maxLength={PASSWORD_MAX_LENGTH + 1}
          placeholder="Tabylga@2026"
          invalid={touched && !check.valid}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <PasswordStrength password={password} />
      <Field label={t("confirmPassword")} htmlFor="confirm" error={mismatch ? t("passwordMismatch") : undefined}>
        <PasswordInput
          id="confirm"
          autoComplete="new-password"
          maxLength={PASSWORD_MAX_LENGTH + 1}
          invalid={mismatch}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </Field>
      <FormError text={error} />
      <Button type="submit" size="lg" loading={loading} disabled={!check.valid || password !== confirm}>
        {t("savePassword")}
      </Button>
    </form>
  );
}

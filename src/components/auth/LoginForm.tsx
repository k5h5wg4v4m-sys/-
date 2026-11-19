"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Input";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { FormError } from "./AuthCard";
import { PasswordInput } from "./PasswordInput";
import { PhoneInput } from "./PhoneInput";
import { useAuthErrorText } from "./useAuthError";

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations("auth");
  const errorText = useAuthErrorText();
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (phone.length !== 9) {
      setPhoneError(true);
      return;
    }
    if (!password) {
      setError(t("passwordRequired"));
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ phone: `+996${phone}`, password });
      if (error) throw error;
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(errorText(err));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field label={t("phone")} htmlFor="phone" error={phoneError ? t("phoneInvalid") : undefined}>
        <PhoneInput
          id="phone"
          value={phone}
          autoFocus
          invalid={phoneError}
          onChange={(v) => {
            setPhone(v);
            setPhoneError(false);
          }}
        />
      </Field>
      <Field label={t("passwordLabel")} htmlFor="password">
        <PasswordInput
          id="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <div className="-mt-1 flex justify-end">
        <Link href="/forgot" className="text-sm font-semibold text-primary hover:text-primary-strong">
          {t("forgotLink")}
        </Link>
      </div>
      <FormError text={error} />
      <Button type="submit" size="lg" loading={loading}>
        {t("loginSubmit")}
      </Button>
    </form>
  );
}

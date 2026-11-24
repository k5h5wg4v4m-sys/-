"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Lock, Phone } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { normalizeKgPhone } from "@/lib/format";

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [phone, setPhone] = useState("+996 ");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState<string>();
  const [error, setError] = useState<string>();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    const normalized = normalizeKgPhone(phone);
    if (!normalized) {
      setPhoneError(t("badPhone"));
      return;
    }
    setPhoneError(undefined);
    if (!password) {
      setError(t("passwordRequired"));
      return;
    }

    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithPassword({ phone: normalized, password });
      if (authError) {
        const status = (authError as { status?: number }).status;
        setError(status === 400 || status === 422 ? t("invalid") : status === 429 ? t("tooMany") : t("failed"));
        setLoading(false);
        return;
      }
      router.replace(next);
      router.refresh();
    } catch {
      setError(t("failed"));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Field label={t("phone")} htmlFor="phone" error={phoneError} required>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          icon={<Phone className="size-5" />}
          invalid={Boolean(phoneError)}
          placeholder="+996 700 000 000"
        />
      </Field>
      <Field label={t("password")} htmlFor="password" required>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          icon={<Lock className="size-5" />}
        />
      </Field>
      {error && (
        <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" loading={loading} className="mt-1">
        {t("submit")}
      </Button>
      <p className="text-center text-sm text-muted">{t("closedNote")}</p>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { FormError } from "./AuthCard";
import { useDbErrorText } from "./useAuthError";

type Gender = "male" | "female";
type Values = { firstName: string; lastName: string; middleName: string; birthYear: string; gender: Gender | "" };
type Errors = Partial<Record<keyof Values, string>>;

const NAME_MAX = 50;
const MIN_YEAR = 1900;

export function OnboardingForm({ userId, initial, next }: { userId: string; initial: Values; next: string }) {
  const t = useTranslations("auth.profile");
  const dbErrorText = useDbErrorText();
  const router = useRouter();
  const [v, setV] = useState<Values>(initial);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const maxYear = new Date().getFullYear();

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setV((s) => ({ ...s, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  function validate(): Errors {
    const e: Errors = {};
    const name = (s: string, required: boolean) => {
      const x = s.trim();
      if (!x) return required ? t("required") : undefined;
      if (x.length > NAME_MAX) return t("tooLong", { max: NAME_MAX });
      return undefined;
    };
    e.firstName = name(v.firstName, true);
    e.lastName = name(v.lastName, true);
    e.middleName = name(v.middleName, false);
    const year = Number(v.birthYear);
    if (!v.birthYear) e.birthYear = t("required");
    else if (!Number.isInteger(year) || year < MIN_YEAR || year > maxYear) e.birthYear = t("yearRange", { min: MIN_YEAR, max: maxYear });
    if (!v.gender) e.gender = t("genderRequired");
    return Object.fromEntries(Object.entries(e).filter(([, x]) => x)) as Errors;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;

    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: v.firstName.trim(),
        last_name: v.lastName.trim(),
        middle_name: v.middleName.trim() || null,
        birth_year: Number(v.birthYear),
        gender: v.gender,
      })
      .eq("id", userId);
    if (error) {
      setError(dbErrorText(error));
      setLoading(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("firstName")} required htmlFor="firstName" error={errors.firstName}>
          <Input id="firstName" autoComplete="given-name" autoFocus maxLength={NAME_MAX} invalid={!!errors.firstName}
            value={v.firstName} onChange={(e) => set("firstName", e.target.value)} />
        </Field>
        <Field label={t("lastName")} required htmlFor="lastName" error={errors.lastName}>
          <Input id="lastName" autoComplete="family-name" maxLength={NAME_MAX} invalid={!!errors.lastName}
            value={v.lastName} onChange={(e) => set("lastName", e.target.value)} />
        </Field>
      </div>
      <Field label={t("middleName")} htmlFor="middleName" hint={t("optional")} error={errors.middleName}>
        <Input id="middleName" autoComplete="additional-name" maxLength={NAME_MAX} invalid={!!errors.middleName}
          value={v.middleName} onChange={(e) => set("middleName", e.target.value)} />
      </Field>
      <Field label={t("birthYear")} required htmlFor="birthYear" error={errors.birthYear}>
        <Input id="birthYear" inputMode="numeric" autoComplete="bday-year" placeholder="1995" maxLength={4}
          invalid={!!errors.birthYear} value={v.birthYear}
          onChange={(e) => set("birthYear", e.target.value.replace(/\D/g, "").slice(0, 4))} />
      </Field>
      <Field label={t("gender")} required error={errors.gender}>
        <div>
          <Segmented<Gender>
            label={t("gender")}
            value={v.gender || undefined}
            onChange={(g) => set("gender", g)}
            options={[
              { value: "male", label: t("male") },
              { value: "female", label: t("female") },
            ]}
          />
        </div>
      </Field>
      <FormError text={error} />
      <Button type="submit" size="lg" loading={loading} className="mt-2">
        {t("submit")}
      </Button>
    </form>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { setLocale } from "@/app/actions/locale";
import { locales, type Locale } from "@/i18n/config";
import { Segmented } from "@/components/ui/Segmented";

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Segmented<Locale>
      label={t("profile.language")}
      value={locale}
      disabled={pending}
      options={locales.map((l) => ({ value: l, label: t(`languages.${l}`) }))}
      onChange={(next) =>
        startTransition(async () => {
          await setLocale(next);
          router.refresh();
        })
      }
    />
  );
}

"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Segmented } from "@/components/ui/Segmented";

type Theme = "light" | "dark" | "system";
const noop = () => () => {};

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("profile");
  // Тема известна только в браузере: до гидратации ничего не выделяем.
  const mounted = useSyncExternalStore(noop, () => true, () => false);

  return (
    <Segmented<Theme>
      label={t("theme")}
      value={mounted ? (theme as Theme) : undefined}
      onChange={setTheme}
      options={[
        { value: "light", label: t("themeLight") },
        { value: "dark", label: t("themeDark") },
        { value: "system", label: t("themeSystem") },
      ]}
    />
  );
}

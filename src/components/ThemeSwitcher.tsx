"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";
import { Segmented } from "@/components/ui/Segmented";
import { useToast } from "@/components/ui/Toast";

type Theme = "light" | "dark";
const noop = () => () => {};

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("profile");
  const toast = useToast();
  // Тема известна только в браузере: до гидратации ничего не выделяем.
  const mounted = useSyncExternalStore(noop, () => true, () => false);

  return (
    <Segmented<Theme>
      label={t("theme")}
      value={mounted ? (theme as Theme) : undefined}
      onChange={(v) => {
        setTheme(v);
        toast(t("themeChanged"));
      }}
      options={[
        { value: "light", label: t("themeLight"), icon: <Sun className="size-4" /> },
        { value: "dark", label: t("themeDark"), icon: <Moon className="size-4" /> },
      ]}
    />
  );
}

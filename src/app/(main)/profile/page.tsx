import { getTranslations } from "next-intl/server";
import { CircleCheck, CircleAlert, UserRound } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function ProfilePage() {
  const t = await getTranslations("profile");
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageHeader title={t("title")} />

      <Card as="section" className="flex items-center gap-4 p-5">
        <div className="flex size-[72px] shrink-0 items-center justify-center rounded-full border-4 border-bg bg-primary-soft text-primary shadow-md">
          <UserRound className="size-9" strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          <p className="text-xl font-extrabold">{t("guest")}</p>
          <p className="mt-0.5 text-sm text-muted">{t("guestText")}</p>
        </div>
      </Card>

      <Card as="section" className="p-5">
        <h2 className="mb-5 text-xs font-bold tracking-widest text-muted uppercase">{t("settings")}</h2>
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-semibold">{t("theme")}</p>
            <ThemeSwitcher />
          </div>
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-semibold">{t("language")}</p>
            <LanguageSwitcher />
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-border pt-5 text-sm">
            <span className="text-muted">{t("backend")}</span>
            {isSupabaseConfigured ? (
              <span className="flex items-center gap-1.5 font-semibold text-primary">
                <CircleCheck className="size-4" /> {t("backendOk")}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 font-semibold text-danger">
                <CircleAlert className="size-4" /> {t("backendMissing")}
              </span>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

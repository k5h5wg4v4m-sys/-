import { getTranslations } from "next-intl/server";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function ProfilePage() {
  const t = await getTranslations("profile");
  return (
    <>
      <PageHeader title={t("title")} />
      <section className="animate-fade-up rounded-3xl border border-border bg-surface p-5 shadow-soft sm:p-6">
        <h2 className="mb-5 text-sm font-semibold tracking-wide text-muted uppercase">{t("settings")}</h2>
        <div className="flex flex-col gap-6">
          <div>
            <p className="mb-2 font-medium">{t("language")}</p>
            <LanguageSwitcher />
          </div>
          <div>
            <p className="mb-2 font-medium">{t("theme")}</p>
            <ThemeSwitcher />
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-border pt-5 text-sm">
            <span className="text-muted">{t("backend")}</span>
            {isSupabaseConfigured ? (
              <span className="flex items-center gap-1.5 font-medium text-primary">
                <CheckCircle2 className="size-4" /> {t("backendOk")}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-right font-medium text-danger">
                <AlertCircle className="size-4 shrink-0" /> {t("backendMissing")}
              </span>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

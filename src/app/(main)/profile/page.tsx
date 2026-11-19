import { getLocale, getTranslations } from "next-intl/server";
import { CircleCheck, CircleAlert, UserRound } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { getSession } from "@/lib/auth";
import { formatDate, formatKgPhone } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function ProfilePage() {
  const t = await getTranslations("profile");
  const ta = await getTranslations("auth");
  const locale = await getLocale();
  const session = await getSession();
  const p = session?.profile ?? null;

  const rows = p
    ? [
        { label: t("lastName"), value: p.last_name },
        { label: t("firstName"), value: p.first_name },
        { label: t("middleName"), value: p.middle_name },
        { label: t("birthYear"), value: p.birth_year ? String(p.birth_year) : null },
        { label: t("gender"), value: p.gender ? t(`genders.${p.gender}`) : null },
        { label: t("phone"), value: p.phone ? formatKgPhone(p.phone) : null },
        { label: t("registeredAt"), value: formatDate(p.created_at, locale) },
      ]
    : [];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageHeader title={t("title")} />

      <Card as="section" className="flex items-center gap-4 p-5">
        <div
          aria-hidden
          className="flex size-[72px] shrink-0 items-center justify-center rounded-full border-4 border-bg bg-primary-soft text-primary shadow-md"
        >
          <UserRound className="size-9" strokeWidth={1.8} />
        </div>
        <div className="min-w-0">
          {p ? (
            <>
              <p className="truncate text-xl font-extrabold">
                {[p.first_name, p.last_name].filter(Boolean).join(" ")}
              </p>
              {p.phone && <p className="mt-0.5 text-sm text-muted">{formatKgPhone(p.phone)}</p>}
            </>
          ) : (
            <>
              <p className="text-xl font-extrabold">{t("guest")}</p>
              <p className="mt-0.5 text-sm text-muted">{t("guestText")}</p>
            </>
          )}
        </div>
      </Card>

      {!session && (
        <div className="grid grid-cols-2 gap-3">
          <ButtonLink href="/login" size="lg">{ta("loginLink")}</ButtonLink>
          <ButtonLink href="/register" size="lg" variant="secondary">{ta("registerLink")}</ButtonLink>
        </div>
      )}

      {p && (
        <Card as="section" className="p-5">
          <h2 className="mb-3 text-xs font-bold tracking-widest text-muted uppercase">{t("personal")}</h2>
          <dl className="divide-y divide-border">
            {rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-4 py-3 text-[15px]">
                <dt className="text-muted">{r.label}</dt>
                <dd className="text-right font-semibold">{r.value ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

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

      {session && <LogoutButton />}
    </div>
  );
}

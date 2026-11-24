import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight, CircleAlert, CircleCheck, LogIn, ShieldCheck, UserRound, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { getCurrentUser } from "@/lib/auth";
import { formatKgPhone, formatPrice } from "@/lib/format";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function ProfilePage() {
  const t = await getTranslations("profile");
  const tc = await getTranslations("common");
  const user = await getCurrentUser();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageHeader title={t("title")} />

      <Card as="section" className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="flex size-[72px] shrink-0 items-center justify-center rounded-full border-4 border-bg bg-primary-soft text-primary shadow-md">
            <UserRound className="size-9" strokeWidth={1.8} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xl font-extrabold">{user?.phone ? formatKgPhone(user.phone) : t("guest")}</p>
            <p className="mt-0.5 text-sm text-muted">
              {user ? (user.role === "admin" ? t("roleAdmin") : t("roleUser")) : t("guestText")}
            </p>
          </div>
        </div>
        {!user && isSupabaseConfigured && (
          <ButtonLink href="/login" className="w-full sm:w-auto">
            <LogIn className="size-4" /> {t("login")}
          </ButtonLink>
        )}
      </Card>

      {user && (
        <Card as="section" className="flex flex-col gap-4 border-primary/25 bg-primary-soft p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">{t("balance")}</p>
            <p className="mt-1 text-3xl font-extrabold">{formatPrice(user.balance, tc("currency"))}</p>
          </div>
          <ButtonLink href="/balance" className="w-full sm:w-auto">
            <Wallet className="size-4" /> {t("topup")}
          </ButtonLink>
        </Card>
      )}

      {user && (
        <Card as="section" className="overflow-hidden">
          <ProfileLink href="/balance" icon={<Wallet className="size-5" />} label={t("balanceHistory")} />
          {user.role === "admin" && (
            <ProfileLink href="/admin" icon={<ShieldCheck className="size-5" />} label={t("admin")} />
          )}
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

      {user && <LogoutButton />}
    </div>
  );
}

function ProfileLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 border-b border-border px-5 py-4 font-semibold last:border-b-0 hover:bg-bg active:bg-bg"
    >
      <span className="flex size-10 items-center justify-center rounded-2xl bg-primary-soft text-primary">{icon}</span>
      <span className="flex-1">{label}</span>
      <ChevronRight className="size-5 text-muted" />
    </Link>
  );
}

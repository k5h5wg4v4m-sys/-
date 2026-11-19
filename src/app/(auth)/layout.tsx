import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

/** Экраны входа и регистрации: без нижнего меню, по центру экрана. */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("common");
  return (
    <div className="pt-safe flex min-h-dvh flex-col bg-card">
      <header className="mx-auto flex w-full max-w-md items-center justify-between px-4 pt-4">
        <Logo />
        <Link
          href="/"
          aria-label={t("close")}
          className="flex size-11 items-center justify-center rounded-2xl text-muted hover:bg-bg hover:text-text active:scale-95"
        >
          <X className="size-6" />
        </Link>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-6 pb-10">{children}</main>
      <footer className="flex justify-center px-4 pb-[max(24px,env(safe-area-inset-bottom))]">
        <LanguageSwitcher />
      </footer>
    </div>
  );
}

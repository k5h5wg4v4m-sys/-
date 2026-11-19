import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Bell, ChevronRight } from "lucide-react";
import { LogoMark } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { EmptyBoxIllustration } from "@/components/ui/Illustrations";
import { LinkTabs } from "@/components/ui/Tabs";
import { SearchForm } from "@/components/layout/SearchForm";
import { CategoryStrip } from "@/components/layout/Categories";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const active = tab === "new" ? "new" : "recommended";
  const t = await getTranslations("home");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 lg:hidden" aria-label="TABYLGA">
          <LogoMark />
          <span className="text-[19px] font-extrabold tracking-[0.08em]">TABYLGA</span>
        </Link>
        <h1 className="hidden text-3xl font-extrabold tracking-tight lg:block">{t("title")}</h1>
        <Link
          href="/notifications"
          aria-label={t("notifications")}
          className="flex size-11 items-center justify-center rounded-2xl border border-border bg-card text-text hover:border-primary/40 active:scale-95"
        >
          <Bell className="size-[22px]" strokeWidth={1.9} />
        </Link>
      </header>

      <SearchForm />

      <section aria-labelledby="cats" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="cats" className="text-lg font-bold">{t("categories")}</h2>
          <Link href="/categories" className="flex items-center gap-0.5 text-sm font-semibold text-primary hover:text-primary-strong">
            {t("allCategories")} <ChevronRight className="size-4" />
          </Link>
        </div>
        <CategoryStrip />
      </section>

      <section className="flex flex-col gap-4">
        <LinkTabs
          label={t("tabsLabel")}
          active={active}
          items={[
            { key: "recommended", href: "/", label: t("tabRecommended") },
            { key: "new", href: "/?tab=new", label: t("tabNew") },
          ]}
        />
        <EmptyState illustration={<EmptyBoxIllustration />} title={t("emptyTitle")} text={t("emptyText")}>
          <ButtonLink href="/new" size="lg">+ {t("emptyAction")}</ButtonLink>
        </EmptyState>
      </section>
    </div>
  );
}

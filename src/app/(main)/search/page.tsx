import { getTranslations } from "next-intl/server";
import { SearchX } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SearchForm } from "@/components/layout/SearchForm";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const query = (q ?? "").trim().slice(0, 100);
  const t = await getTranslations("search");
  return (
    <>
      <PageHeader title={t("title")} backHref="/" />
      <SearchForm defaultValue={query} autoFocus={!query} />
      {query ? (
        <>
          <p className="mt-5 text-sm font-medium text-muted">{t("resultsFor", { q: query })}</p>
          <EmptyState icon={SearchX} title={t("emptyTitle")} text={t("emptyText")} />
        </>
      ) : (
        <p className="mt-4 text-sm text-muted">{t("hint")}</p>
      )}
    </>
  );
}

import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { findCategory } from "@/lib/categories";

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const category = findCategory(slug);
  if (!category) notFound();
  const t = await getTranslations();
  return (
    <>
      <PageHeader title={t(`categories.${category.slug}`)} backHref="/categories" />
      <EmptyState icon={category.icon} title={t("categoryPage.emptyTitle")} text={t("categoryPage.emptyText")} />
    </>
  );
}

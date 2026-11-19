import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/PageHeader";
import { CategoryGrid } from "@/components/layout/Categories";

export default async function CategoriesPage() {
  const t = await getTranslations("home");
  return (
    <>
      <PageHeader title={t("categories")} backHref="/" />
      <CategoryGrid />
    </>
  );
}

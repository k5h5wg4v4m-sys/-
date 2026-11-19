import { getTranslations } from "next-intl/server";
import { LayoutGrid } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function HomePage() {
  const t = await getTranslations("home");
  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <EmptyState icon={LayoutGrid} title={t("emptyTitle")} text={t("emptyText")} />
    </>
  );
}

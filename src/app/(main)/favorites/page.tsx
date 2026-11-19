import { getTranslations } from "next-intl/server";
import { Heart } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function FavoritesPage() {
  const t = await getTranslations("favorites");
  return (
    <>
      <PageHeader title={t("title")} />
      <EmptyState icon={Heart} title={t("emptyTitle")} text={t("emptyText")} />
    </>
  );
}

import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { EmptyFavoritesIllustration } from "@/components/ui/Illustrations";

export default async function FavoritesPage() {
  const t = await getTranslations("favorites");
  return (
    <>
      <PageHeader title={t("title")} />
      <EmptyState illustration={<EmptyFavoritesIllustration />} title={t("emptyTitle")} text={t("emptyText")}>
        <ButtonLink href="/" size="lg">{t("emptyAction")}</ButtonLink>
      </EmptyState>
    </>
  );
}

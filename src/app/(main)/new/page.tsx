import { getTranslations } from "next-intl/server";
import { SquarePen } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function PostPage() {
  const t = await getTranslations("post");
  return (
    <>
      <PageHeader title={t("title")} />
      <EmptyState icon={SquarePen} title={t("emptyTitle")} text={t("emptyText")} />
    </>
  );
}

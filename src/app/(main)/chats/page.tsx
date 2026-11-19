import { getTranslations } from "next-intl/server";
import { MessageCircle } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";

export default async function ChatsPage() {
  const t = await getTranslations("chats");
  return (
    <>
      <PageHeader title={t("title")} />
      <EmptyState icon={MessageCircle} title={t("emptyTitle")} text={t("emptyText")} />
    </>
  );
}

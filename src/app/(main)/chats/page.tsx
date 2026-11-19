import { getTranslations } from "next-intl/server";
import { MessagesSquare } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function ChatsPage() {
  const t = await getTranslations("chats");
  return (
    <>
      <PageHeader title={t("title")} />
      <EmptyState icon={MessagesSquare} title={t("emptyTitle")} text={t("emptyText")} />
    </>
  );
}

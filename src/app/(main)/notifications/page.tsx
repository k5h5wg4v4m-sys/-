import { getTranslations } from "next-intl/server";
import { BellOff } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function NotificationsPage() {
  const t = await getTranslations("notifications");
  return (
    <>
      <PageHeader title={t("title")} backHref="/" />
      <EmptyState icon={BellOff} title={t("emptyTitle")} text={t("emptyText")} />
    </>
  );
}

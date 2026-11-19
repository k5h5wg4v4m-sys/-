import { getTranslations } from "next-intl/server";
import { SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function NotFound() {
  const t = await getTranslations();
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg items-center px-4">
      <EmptyState icon={SearchX} title={t("errors.notFoundTitle")} text={t("errors.notFoundText")} className="w-full">
        <ButtonLink href="/">{t("common.goHome")}</ButtonLink>
      </EmptyState>
    </main>
  );
}

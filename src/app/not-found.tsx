import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function NotFound() {
  const t = await getTranslations();
  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <EmptyState icon={SearchX} title={t("errors.notFoundTitle")} text={t("errors.notFoundText")}>
        <Link
          href="/"
          className="rounded-xl bg-primary px-5 py-2.5 font-medium text-on-primary transition-colors hover:bg-primary-hover"
        >
          {t("common.goHome")}
        </Link>
      </EmptyState>
    </main>
  );
}

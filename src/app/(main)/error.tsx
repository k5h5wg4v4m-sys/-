"use client";

import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations();
  return (
    <EmptyState icon={TriangleAlert} title={t("errors.title")} text={t("errors.text")}>
      <button
        type="button"
        onClick={reset}
        className="rounded-xl bg-primary px-5 py-2.5 font-medium text-on-primary transition-colors hover:bg-primary-hover"
      >
        {t("common.retry")}
      </button>
    </EmptyState>
  );
}

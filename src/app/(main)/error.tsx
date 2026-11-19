"use client";

import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations();
  return (
    <EmptyState icon={TriangleAlert} title={t("errors.title")} text={t("errors.text")}>
      <Button onClick={reset}>{t("common.retry")}</Button>
    </EmptyState>
  );
}

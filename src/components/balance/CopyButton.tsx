"use client";

import { useTranslations } from "next-intl";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function CopyButton({ text, label }: { text: string; label?: string }) {
  const t = useTranslations("balance");
  const toast = useToast();

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast(t("copied"));
    } catch {
      toast(t("copyFailed"), "error");
    }
  }

  return (
    <Button type="button" variant="soft" size="sm" onClick={copy}>
      <Copy className="size-4" /> {label ?? t("copy")}
    </Button>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Textarea } from "@/components/ui/Input";
import { ConfirmModal, Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { getDbErrorCode } from "@/lib/db-errors";
import { formatPrice } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function TopupReviewActions({ id, amount }: { id: string; amount: number }) {
  const t = useTranslations("admin");
  const te = useTranslations("dbErrors");
  const tc = useTranslations("common");
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function review(approve: boolean) {
    if (!approve && !reason.trim()) {
      setReasonError(te("reason_required"));
      return;
    }
    setLoading(true);
    const { error } = await getSupabaseBrowserClient().rpc("review_topup", {
      p_request_id: id,
      p_approve: approve,
      p_reason: approve ? null : reason.trim(),
    });
    setLoading(false);
    if (error) {
      toast(te(getDbErrorCode(error)), "error");
      if (getDbErrorCode(error) === "already_reviewed") router.refresh();
      return;
    }
    setMode(null);
    toast(approve ? t("approved") : t("rejected"));
    router.refresh();
  }

  return (
    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
      <Button onClick={() => setMode("approve")}>
        <Check className="size-4" /> {t("approve")}
      </Button>
      <Button variant="secondary" onClick={() => setMode("reject")} className="text-danger">
        <X className="size-4" /> {t("reject")}
      </Button>

      <ConfirmModal
        open={mode === "approve"}
        onClose={() => setMode(null)}
        onConfirm={() => review(true)}
        title={t("approveTitle")}
        text={t("approveText", { amount: formatPrice(amount, tc("currency")) })}
        confirmLabel={t("approve")}
        cancelLabel={tc("cancel")}
        loading={loading}
      />

      <Modal open={mode === "reject"} onClose={() => setMode(null)} title={t("rejectTitle")} closeLabel={tc("close")}>
        <Field label={t("reason")} htmlFor={`reason-${id}`} required error={reasonError}>
          <Textarea
            id={`reason-${id}`}
            value={reason}
            maxLength={500}
            onChange={(e) => {
              setReason(e.target.value);
              setReasonError(undefined);
            }}
            placeholder={t("reasonPlaceholder")}
            invalid={Boolean(reasonError)}
          />
        </Field>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setMode(null)}>{tc("cancel")}</Button>
          <Button variant="danger" onClick={() => review(false)} loading={loading}>{t("reject")}</Button>
        </div>
      </Modal>
    </div>
  );
}

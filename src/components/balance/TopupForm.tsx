"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, ImagePlus, Landmark, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { CopyButton } from "./CopyButton";
import { cn } from "@/lib/cn";
import { getDbErrorCode } from "@/lib/db-errors";
import { formatNumber } from "@/lib/format";
import { compressImage, storagePath } from "@/lib/image";
import { instructionsFor, parseAmount, requisitesText, TOPUP_MAX, TOPUP_MIN, type PaymentMethod } from "@/lib/payments";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Method = PaymentMethod & { qrUrl: string | null };

export function TopupForm({ userId, methods, locale }: { userId: string; methods: Method[]; locale: string }) {
  const t = useTranslations("balance");
  const te = useTranslations("dbErrors");
  const tc = useTranslations("common");
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [methodId, setMethodId] = useState<string>();
  const [amount, setAmount] = useState("");
  const [txRef, setTxRef] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errors, setErrors] = useState<{ method?: string; amount?: string; proof?: string; form?: string }>({});
  const [sending, setSending] = useState(false);

  const method = methods.find((m) => m.id === methodId);

  function pickFile(f: File | undefined) {
    if (preview) URL.revokeObjectURL(preview);
    if (!f) {
      setFile(null);
      setPreview(null);
      return;
    }
    if (!f.type.startsWith("image/")) {
      setErrors((e) => ({ ...e, proof: te("bad_image") }));
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setErrors((e) => ({ ...e, proof: undefined }));
  }

  function clearFile() {
    pickFile(undefined);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = parseAmount(amount);
    const next: typeof errors = {};
    if (!method) next.method = te("bad_method");
    if (value === null || value < TOPUP_MIN || value > TOPUP_MAX)
      next.amount = t("amountRange", { max: formatNumber(TOPUP_MAX) });
    if (!txRef.trim() && !file) next.proof = te("proof_required");
    setErrors(next);
    if (Object.keys(next).length > 0 || !method || value === null) return;

    setSending(true);
    const supabase = getSupabaseBrowserClient();
    try {
      let receiptPath: string | null = null;
      if (file) {
        const blob = await compressImage(file);
        receiptPath = storagePath(userId);
        const { error: upErr } = await supabase.storage
          .from("receipts")
          .upload(receiptPath, blob, { contentType: "image/jpeg", upsert: false });
        if (upErr) throw new Error("bad_image");
      }

      const { error } = await supabase.rpc("create_topup_request", {
        p_payment_method_id: method.id,
        p_amount: value,
        p_transaction_ref: txRef.trim() || null,
        p_receipt_path: receiptPath,
      });
      if (error) throw error;

      toast(t("sent"));
      setAmount("");
      setTxRef("");
      clearFile();
      setMethodId(undefined);
      router.refresh();
    } catch (err) {
      setErrors({ form: te(getDbErrorCode(err)) });
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">
          {t("step1")}
          <span className="ml-0.5 text-primary">*</span>
        </legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {methods.map((m) => {
            const active = m.id === methodId;
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setMethodId(m.id);
                  setErrors((e) => ({ ...e, method: undefined }));
                }}
                className={cn(
                  "relative flex h-16 items-center gap-2.5 rounded-2xl border px-3 text-left text-sm font-bold active:scale-[0.98]",
                  active ? "border-primary bg-primary-soft text-primary ring-2 ring-primary/30" : "border-border bg-bg hover:bg-card",
                )}
              >
                <Landmark className="size-5 shrink-0" />
                <span className="min-w-0 leading-tight">{m.name}</span>
                {active && <Check className="absolute top-2 right-2 size-4" />}
              </button>
            );
          })}
        </div>
        {errors.method && <p role="alert" className="mt-2 text-sm text-danger">{errors.method}</p>}
      </fieldset>

      {method && (
        <div className="animate-rise rounded-2xl border border-border bg-bg p-4">
          <p className="text-xs font-bold tracking-widest text-muted uppercase">{t("requisites")}</p>
          <dl className="mt-3 grid gap-2 text-[15px]">
            <div className="flex flex-wrap justify-between gap-x-4">
              <dt className="text-muted">{t("bank")}</dt>
              <dd className="font-semibold">{method.name}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-x-4">
              <dt className="text-muted">{t("recipient")}</dt>
              <dd className="font-semibold">{method.recipient_name}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-x-4">
              <dt className="text-muted">{t("account")}</dt>
              <dd className="font-mono font-semibold break-all">{method.account_number}</dd>
            </div>
          </dl>
          {instructionsFor(method, locale) && (
            <p className="mt-3 text-sm whitespace-pre-line text-muted">{instructionsFor(method, locale)}</p>
          )}
          {method.qrUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- QR из Supabase Storage
            <img
              src={method.qrUrl}
              alt={t("qrAlt", { bank: method.name })}
              className="mx-auto mt-4 size-48 rounded-2xl border border-border bg-white object-contain p-2"
            />
          )}
          <div className="mt-4">
            <CopyButton text={requisitesText(method)} />
          </div>
        </div>
      )}

      <Field label={t("step2")} htmlFor="amount" required error={errors.amount} hint={t("amountHint")}>
        <div className="relative">
          <Input
            id="amount"
            inputMode="numeric"
            autoComplete="off"
            value={amount}
            onChange={(e) => {
              const n = parseAmount(e.target.value);
              setAmount(n === null ? "" : formatNumber(n));
              setErrors((er) => ({ ...er, amount: undefined }));
            }}
            placeholder="500"
            invalid={Boolean(errors.amount)}
            className="pr-16 text-lg font-bold"
          />
          <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 font-semibold text-muted">
            {tc("currency")}
          </span>
        </div>
      </Field>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium">
          {t("step3")}
          <span className="ml-0.5 text-primary">*</span>
        </p>
        <Input
          aria-label={t("txRef")}
          value={txRef}
          maxLength={100}
          onChange={(e) => {
            setTxRef(e.target.value);
            setErrors((er) => ({ ...er, proof: undefined }));
          }}
          placeholder={t("txRef")}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        {preview ? (
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element -- локальный blob: превью */}
            <img src={preview} alt={t("receipt")} className="h-40 rounded-2xl border border-border object-cover" />
            <button
              type="button"
              onClick={clearFile}
              aria-label={t("removeReceipt")}
              className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-black/60 text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()} className="w-full sm:w-fit">
            <ImagePlus className="size-4" /> {t("attachReceipt")}
          </Button>
        )}
        {errors.proof && <p role="alert" className="text-sm text-danger">{errors.proof}</p>}
      </div>

      {errors.form && (
        <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          {errors.form}
        </p>
      )}

      <Button type="submit" size="lg" loading={sending}>
        {t("submit")}
      </Button>
      <p className="-mt-2 text-center text-sm text-muted">{t("reviewNote")}</p>
    </form>
  );
}

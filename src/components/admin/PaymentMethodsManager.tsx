"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ImagePlus, Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Textarea } from "@/components/ui/Input";
import { ConfirmModal, Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { compressImage, storagePath } from "@/lib/image";
import type { PaymentMethod } from "@/lib/payments";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Method = PaymentMethod & { qrUrl: string | null };

type Draft = {
  name: string;
  recipient_name: string;
  account_number: string;
  instructions_ru: string;
  instructions_ky: string;
  is_enabled: boolean;
  sort_order: string;
};

function toDraft(m?: Method): Draft {
  return {
    name: m?.name ?? "",
    recipient_name: m?.recipient_name ?? "",
    account_number: m?.account_number ?? "",
    instructions_ru: m?.instructions_ru ?? "",
    instructions_ky: m?.instructions_ky ?? "",
    is_enabled: m?.is_enabled ?? false,
    sort_order: String(m?.sort_order ?? 0),
  };
}

export function PaymentMethodsManager({ adminId, methods }: { adminId: string; methods: Method[] }) {
  const t = useTranslations("admin");
  const tb = useTranslations("balance");
  const tc = useTranslations("common");
  const router = useRouter();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState<Method | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(toDraft());
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [removeQr, setRemoveQr] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft | "form", string>>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Method | null>(null);

  function open(m: Method | "new") {
    setEditing(m);
    setDraft(toDraft(m === "new" ? undefined : m));
    setQrFile(null);
    setRemoveQr(false);
    setErrors({});
  }

  function set<K extends keyof Draft>(k: K, v: Draft[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined, form: undefined }));
  }

  function validate(): boolean {
    const e: typeof errors = {};
    const name = draft.name.trim();
    if (name.length < 1 || name.length > 60) e.name = t("errName");
    const recipient = draft.recipient_name.trim();
    const account = draft.account_number.trim();
    if (recipient && recipient.length > 100) e.recipient_name = t("errRecipient");
    if (account && (account.length < 4 || account.length > 64)) e.account_number = t("errAccount");
    if (draft.is_enabled && (!recipient || !account)) e.is_enabled = t("errEnable");
    if (draft.instructions_ru.length > 1000) e.instructions_ru = t("errInstructions");
    if (draft.instructions_ky.length > 1000) e.instructions_ky = t("errInstructions");
    if (!/^\d{1,4}$/.test(draft.sort_order.trim())) e.sort_order = t("errSort");
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!editing || !validate()) return;
    setSaving(true);
    const supabase = getSupabaseBrowserClient();
    try {
      const current = editing === "new" ? null : editing;
      let qrPath = current?.qr_path ?? null;
      if (qrFile) {
        const blob = await compressImage(qrFile, 1000, 600 * 1024);
        const path = storagePath(adminId);
        const { error } = await supabase.storage.from("payment-qr").upload(path, blob, { contentType: "image/jpeg" });
        if (error) throw new Error("qr");
        qrPath = path;
      } else if (removeQr) {
        qrPath = null;
      }

      const row = {
        name: draft.name.trim(),
        recipient_name: draft.recipient_name.trim() || null,
        account_number: draft.account_number.trim() || null,
        instructions_ru: draft.instructions_ru.trim() || null,
        instructions_ky: draft.instructions_ky.trim() || null,
        qr_path: qrPath,
        is_enabled: draft.is_enabled,
        sort_order: Number(draft.sort_order.trim()),
      };

      const { error } = current
        ? await supabase.from("payment_methods").update(row).eq("id", current.id)
        : await supabase
            .from("payment_methods")
            .insert({ ...row, code: `m_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}` });
      if (error) throw error;

      // Старый QR больше не нужен.
      if (current?.qr_path && current.qr_path !== qrPath) {
        await supabase.storage.from("payment-qr").remove([current.qr_path]);
      }

      setEditing(null);
      toast(t("saved"));
      router.refresh();
    } catch (err) {
      setErrors({ form: err instanceof Error && err.message === "qr" ? t("errQr") : t("errSave") });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!deleting) return;
    setSaving(true);
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.from("payment_methods").delete().eq("id", deleting.id);
    if (!error && deleting.qr_path) await supabase.storage.from("payment-qr").remove([deleting.qr_path]);
    setSaving(false);
    if (error) {
      toast(t("errSave"), "error");
      return;
    }
    setDeleting(null);
    toast(t("deleted"));
    router.refresh();
  }

  const current = editing && editing !== "new" ? editing : null;
  const qrPreview = useMemo(() => (qrFile ? URL.createObjectURL(qrFile) : null), [qrFile]);
  useEffect(() => () => {
    if (qrPreview) URL.revokeObjectURL(qrPreview);
  }, [qrPreview]);
  const qrShown = qrPreview ?? (removeQr ? null : current?.qrUrl ?? null);

  return (
    <>
      <Button onClick={() => open("new")} className="w-full sm:w-fit">
        <Plus className="size-4" /> {t("addMethod")}
      </Button>

      {methods.length === 0 ? (
        <Card>
          <EmptyState icon={Landmark} title={t("noMethodsTitle")} />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {methods.map((m) => (
            <li key={m.id}>
              <Card as="article" className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold">{m.name}</p>
                    <Badge tone={m.is_enabled ? "success" : "neutral"}>{m.is_enabled ? t("enabled") : t("disabled")}</Badge>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted">
                    {m.recipient_name && m.account_number ? `${m.recipient_name} · ${m.account_number}` : t("noRequisites")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="soft" size="sm" onClick={() => open(m)}>
                    <Pencil className="size-4" /> {t("edit")}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleting(m)} aria-label={t("delete")} className="text-danger">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={current ? current.name : t("addMethod")}
        closeLabel={tc("close")}
      >
        <div className="flex max-h-[70dvh] flex-col gap-4 overflow-y-auto px-0.5 pb-1">
          <Field label={t("fieldName")} htmlFor="pm-name" required error={errors.name}>
            <Input id="pm-name" value={draft.name} maxLength={60} onChange={(e) => set("name", e.target.value)} invalid={Boolean(errors.name)} />
          </Field>
          <Field label={tb("recipient")} htmlFor="pm-recipient" error={errors.recipient_name}>
            <Input id="pm-recipient" value={draft.recipient_name} maxLength={100} onChange={(e) => set("recipient_name", e.target.value)} invalid={Boolean(errors.recipient_name)} />
          </Field>
          <Field label={tb("account")} htmlFor="pm-account" error={errors.account_number}>
            <Input id="pm-account" value={draft.account_number} maxLength={64} onChange={(e) => set("account_number", e.target.value)} invalid={Boolean(errors.account_number)} />
          </Field>
          <Field label={t("fieldInstructionsRu")} htmlFor="pm-ins-ru" error={errors.instructions_ru}>
            <Textarea id="pm-ins-ru" value={draft.instructions_ru} maxLength={1000} onChange={(e) => set("instructions_ru", e.target.value)} />
          </Field>
          <Field label={t("fieldInstructionsKy")} htmlFor="pm-ins-ky" error={errors.instructions_ky}>
            <Textarea id="pm-ins-ky" value={draft.instructions_ky} maxLength={1000} onChange={(e) => set("instructions_ky", e.target.value)} />
          </Field>
          <Field label={t("fieldSort")} htmlFor="pm-sort" error={errors.sort_order}>
            <Input id="pm-sort" inputMode="numeric" value={draft.sort_order} maxLength={4} onChange={(e) => set("sort_order", e.target.value)} invalid={Boolean(errors.sort_order)} />
          </Field>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{t("fieldQr")}</p>
            {qrShown && (
              // eslint-disable-next-line @next/next/no-img-element -- QR из Storage или локальный blob:
              <img src={qrShown} alt={t("fieldQr")} className="size-40 rounded-2xl border border-border bg-white object-contain p-2" />
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                setQrFile(e.target.files?.[0] ?? null);
                setRemoveQr(false);
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                <ImagePlus className="size-4" /> {qrShown ? t("replaceQr") : t("uploadQr")}
              </Button>
              {qrShown && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-danger"
                  onClick={() => {
                    setQrFile(null);
                    setRemoveQr(true);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                >
                  {t("removeQr")}
                </Button>
              )}
            </div>
          </div>

          <label className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-bg p-4">
            <span>
              <span className="block font-semibold">{t("fieldEnabled")}</span>
              <span className="block text-sm text-muted">{t("fieldEnabledHint")}</span>
            </span>
            <input
              type="checkbox"
              checked={draft.is_enabled}
              onChange={(e) => set("is_enabled", e.target.checked)}
              className="size-6 shrink-0 accent-[var(--primary)]"
            />
          </label>
          {errors.is_enabled && <p role="alert" className="-mt-2 text-sm text-danger">{errors.is_enabled}</p>}

          {errors.form && (
            <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">{errors.form}</p>
          )}
        </div>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setEditing(null)}>{tc("cancel")}</Button>
          <Button onClick={save} loading={saving}>{t("save")}</Button>
        </div>
      </Modal>

      <ConfirmModal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        title={t("deleteTitle")}
        text={t("deleteText", { name: deleting?.name ?? "" })}
        confirmLabel={t("delete")}
        cancelLabel={tc("cancel")}
        danger
        loading={saving}
      />
    </>
  );
}

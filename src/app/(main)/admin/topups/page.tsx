import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ReceiptText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TopupReviewActions } from "@/components/admin/TopupReviewActions";
import { TopupStatusBadge, type TopupStatus } from "@/components/balance/TopupStatusBadge";
import { requireAdmin } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { formatDateTime, formatKgPhone, formatPrice } from "@/lib/format";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const STATUSES: TopupStatus[] = ["pending", "approved", "rejected"];

type Row = {
  id: string;
  method_name: string;
  amount: number;
  transaction_ref: string | null;
  receipt_path: string | null;
  status: TopupStatus;
  reject_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  user: { phone: string | null; first_name: string | null; last_name: string | null } | null;
};

export default async function AdminTopupsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin("/admin/topups");
  const { status: raw } = await searchParams;
  const status: TopupStatus = STATUSES.includes(raw as TopupStatus) ? (raw as TopupStatus) : "pending";

  const t = await getTranslations("admin");
  const ts = await getTranslations("topupStatus");
  const tc = await getTranslations("common");
  const locale = await getLocale();
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .from("topup_requests")
    .select(
      "id, method_name, amount, transaction_ref, receipt_path, status, reject_reason, created_at, reviewed_at, user:profiles!topup_requests_user_id_fkey(phone, first_name, last_name)",
    )
    .eq("status", status)
    .order("created_at", { ascending: status === "pending" })
    .limit(100);
  if (error) throw new Error("admin_topups_load_failed");
  const rows = (data ?? []) as unknown as Row[];

  // Чеки лежат в приватном бакете: временные ссылки на 1 час.
  const paths = rows.map((r) => r.receipt_path).filter((p): p is string => Boolean(p));
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data: urls } = await supabase.storage.from("receipts").createSignedUrls(paths, 3600);
    urls?.forEach((u) => u.path && u.signedUrl && signed.set(u.path, u.signedUrl));
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <PageHeader title={t("topupsTitle")} backHref="/admin" />

      <nav aria-label={t("filter")} className="flex w-fit gap-1 rounded-2xl bg-bg p-1 shadow-sm ring-1 ring-border">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/topups?status=${s}`}
            aria-current={s === status ? "page" : undefined}
            className={cn(
              "flex h-10 items-center rounded-xl px-4 text-sm font-semibold",
              s === status ? "bg-primary text-on-primary shadow-sm" : "text-muted hover:text-text",
            )}
          >
            {ts(s)}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <Card>
          <EmptyState icon={ReceiptText} title={t("noTopupsTitle")} text={t("noTopupsText")} />
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => {
            const name = [r.user?.first_name, r.user?.last_name].filter(Boolean).join(" ");
            const receipt = r.receipt_path ? signed.get(r.receipt_path) : undefined;
            return (
              <li key={r.id}>
                <Card as="article" className="flex flex-col gap-4 p-5 sm:flex-row">
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-2xl font-extrabold">{formatPrice(r.amount, tc("currency"))}</p>
                      <TopupStatusBadge status={r.status} />
                    </div>
                    <dl className="grid gap-1 text-sm">
                      <Row label={t("user")} value={`${name || t("noName")} · ${r.user?.phone ? formatKgPhone(r.user.phone) : "—"}`} />
                      <Row label={t("bank")} value={r.method_name} />
                      <Row label={t("txRef")} value={r.transaction_ref ?? "—"} />
                      <Row label={t("date")} value={formatDateTime(r.created_at, locale)} />
                      {r.reviewed_at && <Row label={t("reviewedAt")} value={formatDateTime(r.reviewed_at, locale)} />}
                      {r.reject_reason && <Row label={t("reason")} value={r.reject_reason} />}
                    </dl>
                    {r.status === "pending" && <TopupReviewActions id={r.id} amount={r.amount} />}
                  </div>
                  {r.receipt_path && (
                    <div className="sm:w-48">
                      {receipt ? (
                        <a href={receipt} target="_blank" rel="noopener noreferrer" className="block">
                          {/* eslint-disable-next-line @next/next/no-img-element -- временная ссылка Supabase */}
                          <img
                            src={receipt}
                            alt={t("receipt")}
                            className="h-48 w-full rounded-2xl border border-border bg-white object-contain hover:opacity-90"
                          />
                          <span className="mt-1 block text-center text-xs text-muted">{t("openReceipt")}</span>
                        </a>
                      ) : (
                        <p className="text-sm text-danger">{t("receiptUnavailable")}</p>
                      )}
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-x-2">
      <dt className="text-muted">{label}:</dt>
      <dd className="font-medium break-all">{value}</dd>
    </div>
  );
}

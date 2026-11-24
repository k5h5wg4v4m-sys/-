import { getLocale, getTranslations } from "next-intl/server";
import { ArrowDownLeft, ArrowUpRight, Landmark, Receipt } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TopupForm } from "@/components/balance/TopupForm";
import { TopupStatusBadge, type TopupStatus } from "@/components/balance/TopupStatusBadge";
import { requireUser } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { formatDateTime, formatNumber, formatPrice } from "@/lib/format";
import { PAYMENT_METHOD_FIELDS, type PaymentMethod } from "@/lib/payments";
import { getSupabaseServerClient } from "@/lib/supabase/server";

type TopupRow = {
  id: string;
  method_name: string;
  amount: number;
  transaction_ref: string | null;
  status: TopupStatus;
  reject_reason: string | null;
  created_at: string;
};

type TxRow = {
  id: number;
  type: "topup" | "listing_payment" | "refund" | "admin_credit" | "admin_debit";
  amount: number;
  balance_after: number;
  description: string | null;
  created_at: string;
};

export default async function BalancePage() {
  const user = await requireUser("/balance");
  const t = await getTranslations("balance");
  const tc = await getTranslations("common");
  const tt = await getTranslations("txTypes");
  const locale = await getLocale();
  const supabase = await getSupabaseServerClient();

  const [methodsRes, topupsRes, txRes] = await Promise.all([
    supabase.from("payment_methods").select(PAYMENT_METHOD_FIELDS).eq("is_enabled", true).order("sort_order"),
    supabase
      .from("topup_requests")
      .select("id, method_name, amount, transaction_ref, status, reject_reason, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("transactions")
      .select("id, type, amount, balance_after, description, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  if (methodsRes.error || topupsRes.error || txRes.error) throw new Error("balance_load_failed");

  const methods = ((methodsRes.data ?? []) as PaymentMethod[]).map((m) => ({
    ...m,
    qrUrl: m.qr_path ? supabase.storage.from("payment-qr").getPublicUrl(m.qr_path).data.publicUrl : null,
  }));
  const topups = (topupsRes.data ?? []) as TopupRow[];
  const txs = (txRes.data ?? []) as TxRow[];
  const currency = tc("currency");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader title={t("title")} backHref="/profile" />

      <Card as="section" className="border-primary/25 bg-primary-soft p-5 sm:p-6">
        <p className="text-sm font-semibold text-primary">{t("current")}</p>
        <p className="mt-1 text-4xl font-extrabold tracking-tight">{formatPrice(user.balance, currency)}</p>
        <p className="mt-2 text-sm text-muted">{t("usage")}</p>
      </Card>

      <Card as="section" className="p-5 sm:p-6" >
        <h2 id="topup" className="mb-4 text-lg font-bold">{t("topupTitle")}</h2>
        {methods.length === 0 ? (
          <EmptyState icon={Landmark} title={t("noMethodsTitle")} text={t("noMethodsText")} className="py-6" />
        ) : (
          <TopupForm userId={user.id} methods={methods} locale={locale} />
        )}
      </Card>

      <Card as="section" className="p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-bold">{t("requestsTitle")}</h2>
        {topups.length === 0 ? (
          <EmptyState icon={Receipt} title={t("noRequestsTitle")} text={t("noRequestsText")} className="py-6" />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {topups.map((r) => (
              <li key={r.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold">{formatPrice(r.amount, currency)}</p>
                  <TopupStatusBadge status={r.status} />
                </div>
                <p className="text-sm text-muted">
                  {r.method_name} · {formatDateTime(r.created_at, locale)}
                  {r.transaction_ref && <> · № {r.transaction_ref}</>}
                </p>
                {r.status === "rejected" && r.reject_reason && (
                  <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
                    {t("rejectReason")}: {r.reject_reason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card as="section" className="p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-bold">{t("historyTitle")}</h2>
        {txs.length === 0 ? (
          <EmptyState icon={ArrowDownLeft} title={t("noTxTitle")} text={t("noTxText")} className="py-6" />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {txs.map((x) => {
              const plus = x.amount > 0;
              return (
                <li key={x.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-2xl",
                      plus ? "bg-primary-soft text-primary" : "bg-danger-soft text-danger",
                    )}
                  >
                    {plus ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{tt(x.type)}</p>
                    <p className="truncate text-sm text-muted">
                      {formatDateTime(x.created_at, locale)}
                      {x.description && <> · {x.description}</>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn("font-bold", plus ? "text-primary" : "text-danger")}>
                      {plus ? "+" : "−"}
                      {formatPrice(Math.abs(x.amount), currency)}
                    </p>
                    <p className="text-xs text-muted">
                      {t("after")} {formatNumber(x.balance_after)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

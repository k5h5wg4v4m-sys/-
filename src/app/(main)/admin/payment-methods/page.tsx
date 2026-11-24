import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/PageHeader";
import { PaymentMethodsManager } from "@/components/admin/PaymentMethodsManager";
import { requireAdmin } from "@/lib/auth";
import { PAYMENT_METHOD_FIELDS, type PaymentMethod } from "@/lib/payments";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminPaymentMethodsPage() {
  const admin = await requireAdmin("/admin/payment-methods");
  const t = await getTranslations("admin");
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase.from("payment_methods").select(PAYMENT_METHOD_FIELDS).order("sort_order").order("name");
  if (error) throw new Error("admin_methods_load_failed");

  const methods = ((data ?? []) as PaymentMethod[]).map((m) => ({
    ...m,
    qrUrl: m.qr_path ? supabase.storage.from("payment-qr").getPublicUrl(m.qr_path).data.publicUrl : null,
  }));

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader title={t("methodsTitle")} subtitle={t("methodsSubtitle")} backHref="/admin" />
      <PaymentMethodsManager adminId={admin.id} methods={methods} />
    </div>
  );
}

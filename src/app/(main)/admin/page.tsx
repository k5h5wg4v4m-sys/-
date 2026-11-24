import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChevronRight, Landmark, ReceiptText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/auth";
import { formatNumber } from "@/lib/format";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  await requireAdmin("/admin");
  const t = await getTranslations("admin");
  const supabase = await getSupabaseServerClient();

  const [pending, enabled] = await Promise.all([
    supabase.from("topup_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("payment_methods").select("id", { count: "exact", head: true }).eq("is_enabled", true),
  ]);
  if (pending.error || enabled.error) throw new Error("admin_load_failed");

  const items = [
    { href: "/admin/topups", icon: ReceiptText, title: t("topupsTitle"), text: t("pendingCount", { n: formatNumber(pending.count ?? 0) }) },
    { href: "/admin/payment-methods", icon: Landmark, title: t("methodsTitle"), text: t("enabledCount", { n: formatNumber(enabled.count ?? 0) }) },
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} backHref="/profile" />
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map(({ href, icon: Icon, title, text }) => (
          <Link key={href} href={href} className="group">
            <Card className="flex h-full items-center gap-4 p-5 transition-shadow group-hover:shadow-md">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
                <Icon className="size-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{title}</p>
                <p className="text-sm text-muted">{text}</p>
              </div>
              <ChevronRight className="size-5 text-muted" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

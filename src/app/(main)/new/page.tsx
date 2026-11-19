import { getTranslations } from "next-intl/server";
import { Lock } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { formatPrice } from "@/lib/format";

// Цена дня совпадает с public.listing_day_price() в базе; здесь — только для показа.
const DAY_PRICE = 20;
const EXAMPLES = [1, 3, 7, 15, 30];

export default async function NewListingPage() {
  const t = await getTranslations("post");
  const tc = await getTranslations("common");
  const steps = t.raw("steps") as string[];
  const price = formatPrice(DAY_PRICE, tc("currency"));

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:items-start">
        <Card as="section" className="p-5 sm:p-6">
          <ol className="flex flex-col gap-1">
            {steps.map((s, i) => (
              <li key={s} className="flex animate-rise items-center gap-4 rounded-2xl p-2" style={{ animationDelay: `${i * 40}ms` }}>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[15px] font-bold text-primary">
                  {i + 1}
                </span>
                <span className="font-semibold">{s}</span>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-dashed border-border bg-bg p-4">
            <Lock className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">{t("soonTitle")}</p>
              <p className="mt-0.5 text-sm text-muted">{t("soonText")}</p>
            </div>
          </div>
        </Card>

        <Card as="section" className="overflow-hidden border-primary/25 bg-primary-soft p-5 sm:p-6">
          <p className="text-sm font-semibold text-primary">{t("priceTitle")}</p>
          <p className="mt-1 text-3xl font-extrabold">{t("pricePerDay", { price })}</p>
          <ul className="mt-4 grid grid-cols-5 gap-1.5 text-center">
            {EXAMPLES.map((d) => (
              <li key={d} className="rounded-xl bg-bg px-1 py-2 shadow-sm">
                <p className="text-xs text-muted">{d}×</p>
                <p className="text-[13px] font-bold text-primary">{d * DAY_PRICE}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted">{t("priceNote", { price })}</p>
        </Card>
      </div>
    </>
  );
}

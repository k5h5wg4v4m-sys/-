import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

export async function PageHeader({
  title,
  subtitle,
  backHref,
  actions,
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  actions?: React.ReactNode;
}) {
  const t = await getTranslations("common");
  return (
    <header className="mb-6 flex items-center gap-3">
      {backHref && (
        <Link
          href={backHref}
          aria-label={t("back")}
          className="-ml-1 flex size-11 shrink-0 items-center justify-center rounded-2xl text-text hover:bg-card active:scale-95"
        >
          <ArrowLeft className="size-6" />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[26px] leading-tight font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[15px] text-muted">{subtitle}</p>}
      </div>
      {actions}
    </header>
  );
}

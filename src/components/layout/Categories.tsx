import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { CATEGORIES } from "@/lib/categories";
import { cn } from "@/lib/cn";

/** Компактные карточки категорий: лента со скроллом на телефоне, сетка на компьютере. */
export async function CategoryStrip() {
  const t = await getTranslations("categories");
  return (
    <ul className="-mx-4 flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-5 sm:overflow-visible sm:px-0 lg:grid-cols-10 [&::-webkit-scrollbar]:hidden">
      {CATEGORIES.slice(0, 10).map((c, i) => (
        <li key={c.slug} className="shrink-0 snap-start" style={{ animationDelay: `${i * 30}ms` }}>
          <CategoryTile slug={c.slug} icon={c.icon} label={t(c.slug)} compact />
        </li>
      ))}
    </ul>
  );
}

export async function CategoryGrid() {
  const t = await getTranslations("categories");
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {CATEGORIES.map((c, i) => (
        <li key={c.slug} className="animate-rise" style={{ animationDelay: `${i * 20}ms` }}>
          <CategoryTile slug={c.slug} icon={c.icon} label={t(c.slug)} />
        </li>
      ))}
    </ul>
  );
}

function CategoryTile({
  slug,
  icon: Icon,
  label,
  compact,
}: {
  slug: string;
  icon: (typeof CATEGORIES)[number]["icon"];
  label: string;
  compact?: boolean;
}) {
  return (
    <Link
      href={`/category/${slug}`}
      className={cn(
        "group flex rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-md active:scale-[0.97]",
        compact ? "w-[92px] flex-col items-center gap-2 px-2 py-3 text-center sm:w-auto" : "items-center gap-3 p-3",
      )}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-bg text-primary shadow-sm group-hover:bg-primary group-hover:text-on-primary">
        <Icon className="size-[22px]" strokeWidth={1.9} />
      </span>
      <span className={cn("font-semibold text-text", compact ? "line-clamp-2 text-[11.5px] leading-tight" : "text-sm leading-snug")}>
        {label}
      </span>
    </Link>
  );
}

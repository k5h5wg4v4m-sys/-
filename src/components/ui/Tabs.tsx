import Link from "next/link";
import { cn } from "@/lib/cn";

/** Вкладки-ссылки (состояние в URL, работает без JS и сохраняется при обновлении). */
export function LinkTabs({
  items,
  active,
  label,
}: {
  items: { key: string; href: string; label: string }[];
  active: string;
  label: string;
}) {
  return (
    <nav aria-label={label} className="flex gap-1 rounded-2xl bg-card p-1">
      {items.map((it) => {
        const on = it.key === active;
        return (
          <Link
            key={it.key}
            href={it.href}
            scroll={false}
            aria-current={on ? "page" : undefined}
            className={cn(
              "flex-1 rounded-xl px-4 py-2.5 text-center text-sm font-semibold active:scale-[0.98]",
              on ? "bg-bg text-primary shadow-sm" : "text-muted hover:text-text",
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { isActive, NAV_ITEMS } from "./nav-items";

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <nav aria-label={t("label")} className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/92 backdrop-blur-xl lg:hidden">
      <ul className="mx-auto grid h-[68px] max-w-lg grid-cols-5 items-center px-2">
        {NAV_ITEMS.map(({ key, href, icon: Icon }) => {
          const active = isActive(pathname, href);
          if (key === "post") {
            return (
              <li key={key} className="flex justify-center">
                <Link
                  href={href}
                  aria-label={t("postAria")}
                  aria-current={active ? "page" : undefined}
                  className="flex size-[52px] items-center justify-center rounded-[18px] bg-primary text-on-primary shadow-primary hover:bg-primary-strong active:scale-90"
                >
                  <Icon className="size-7" strokeWidth={2.5} />
                </Link>
              </li>
            );
          }
          return (
            <li key={key} className="flex justify-center">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-w-14 flex-col items-center gap-1 rounded-2xl px-2 py-1.5 text-[11px] font-semibold active:scale-95",
                  active ? "text-primary" : "text-muted hover:text-text",
                )}
              >
                <span className={cn("flex h-7 w-12 items-center justify-center rounded-full", active && "bg-primary-soft")}>
                  <Icon className="size-[22px]" strokeWidth={active ? 2.4 : 1.9} />
                </span>
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

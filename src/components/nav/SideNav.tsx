"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/cn";
import { isActive, NAV_ITEMS } from "./nav-items";

export function SideNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const items = NAV_ITEMS.filter((i) => i.key !== "post");

  return (
    <aside className="sticky top-0 hidden h-dvh w-[264px] shrink-0 flex-col gap-8 border-r border-border bg-bg px-5 py-7 lg:flex">
      <Logo className="px-2" />
      <Link
        href="/new"
        className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-primary font-semibold text-on-primary shadow-primary hover:bg-primary-strong active:scale-[0.97]"
      >
        <span className="text-xl leading-none">+</span> {t("postAria")}
      </Link>
      <nav aria-label={t("label")}>
        <ul className="flex flex-col gap-1">
          {items.map(({ key, href, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={key}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-3.5 py-3 text-[15px] font-semibold active:scale-[0.98]",
                    active ? "bg-primary-soft text-primary" : "text-muted hover:bg-card hover:text-text",
                  )}
                >
                  <Icon className="size-5" strokeWidth={active ? 2.4 : 1.9} />
                  {t(key)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

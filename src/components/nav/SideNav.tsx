"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { isActive, NAV_ITEMS } from "./nav-items";

export function SideNav() {
  const pathname = usePathname();
  const t = useTranslations();

  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 border-r border-border bg-surface px-4 py-6 lg:flex">
      <Link href="/" className="px-3 text-2xl font-extrabold tracking-tight text-primary">
        {t("common.appName")}
      </Link>
      <nav>
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ key, href, icon: Icon }) => {
            const active = isActive(pathname, href);
            const isPost = key === "post";
            return (
              <li key={key}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-all duration-200 ${
                    isPost
                      ? "my-2 bg-primary text-on-primary shadow-soft hover:bg-primary-hover"
                      : active
                        ? "bg-primary-soft text-primary"
                        : "text-muted hover:bg-surface-2 hover:text-text"
                  }`}
                >
                  <Icon className="size-5" strokeWidth={active || isPost ? 2.4 : 1.9} />
                  {isPost ? t("nav.postAria") : t(`nav.${key}`)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { isActive, NAV_ITEMS } from "./nav-items";

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/90 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5 items-center">
        {NAV_ITEMS.map(({ key, href, icon: Icon }) => {
          const active = isActive(pathname, href);
          if (key === "post") {
            return (
              <li key={key} className="flex justify-center">
                <Link
                  href={href}
                  aria-label={t("postAria")}
                  aria-current={active ? "page" : undefined}
                  className="-mt-6 flex size-14 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-soft transition-transform duration-200 hover:bg-primary-hover active:scale-95"
                >
                  <Icon className="size-7" strokeWidth={2.4} />
                </Link>
              </li>
            );
          }
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-1 text-[11px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted hover:text-text"
                }`}
              >
                <Icon className="size-6" strokeWidth={active ? 2.4 : 1.9} />
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

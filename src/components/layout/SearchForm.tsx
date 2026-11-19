import { Search } from "lucide-react";
import { getTranslations } from "next-intl/server";

/** Обычная GET-форма: работает без JS, запрос попадает в адрес /search?q=… */
export async function SearchForm({ defaultValue, autoFocus }: { defaultValue?: string; autoFocus?: boolean }) {
  const t = await getTranslations("home");
  return (
    <form action="/search" role="search" className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
      <input
        type="search"
        name="q"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        enterKeyHint="search"
        maxLength={100}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchPlaceholder")}
        className="h-[52px] w-full rounded-2xl border border-border bg-card pr-28 pl-12 text-base text-text placeholder:text-muted focus:border-primary focus:bg-bg focus:ring-4 focus:ring-primary/15 focus:outline-none"
      />
      <button
        type="submit"
        className="absolute top-1.5 right-1.5 h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-on-primary hover:bg-primary-strong active:scale-95"
      >
        {t("searchSubmit")}
      </button>
    </form>
  );
}

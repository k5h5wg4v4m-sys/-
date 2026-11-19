"use client";

import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { checkPassword, PASSWORD_RULES } from "@/lib/password";

const BAR: Record<string, string> = { weak: "bg-danger", medium: "bg-warning", strong: "bg-primary" };
const TEXT: Record<string, string> = { weak: "text-danger", medium: "text-warning", strong: "text-primary" };
const FILLED: Record<string, number> = { weak: 1, medium: 2, strong: 3 };

/** Индикатор надёжности (слабый / средний / надёжный) и список требований. */
export function PasswordStrength({ password }: { password: string }) {
  const t = useTranslations("auth.password");
  const result = checkPassword(password);
  const empty = password.length === 0;

  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <div className="flex items-center gap-3">
        <div className="grid flex-1 grid-cols-3 gap-1.5" aria-hidden>
          {[1, 2, 3].map((i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-colors duration-300",
                !empty && i <= FILLED[result.strength] ? BAR[result.strength] : "bg-border",
              )}
            />
          ))}
        </div>
        <span className={cn("min-w-20 text-right text-sm font-semibold", empty ? "text-muted" : TEXT[result.strength])}>
          {empty ? t("strengthEmpty") : t(`strength.${result.strength}`)}
        </span>
      </div>

      <ul className="grid gap-1.5 text-sm sm:grid-cols-2">
        {PASSWORD_RULES.map((rule) => {
          const ok = result.passed.has(rule);
          return (
            <li key={rule} className={cn("flex items-center gap-2", ok ? "text-primary" : "text-muted")}>
              {ok ? <Check className="size-4 shrink-0" /> : <span className="size-4 shrink-0 text-center leading-4">•</span>}
              {t(`rules.${rule}`)}
            </li>
          );
        })}
        {result.problems.map((p) => (
          <li key={p} className="flex items-center gap-2 text-danger sm:col-span-2">
            <X className="size-4 shrink-0" />
            {t(`problems.${p}`)}
          </li>
        ))}
      </ul>
    </div>
  );
}

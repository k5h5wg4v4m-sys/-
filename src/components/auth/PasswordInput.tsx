"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";

export function PasswordInput({
  invalid,
  className,
  ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { invalid?: boolean }) {
  const t = useTranslations("auth");
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        aria-invalid={invalid || undefined}
        className={cn(
          "h-12 w-full rounded-2xl border border-border bg-card pr-12 pl-4 text-base text-text placeholder:text-muted",
          "focus:border-primary focus:bg-bg focus:ring-4 focus:ring-primary/15 focus:outline-none disabled:opacity-60",
          invalid && "border-danger focus:border-danger focus:ring-danger/15",
          className,
        )}
        {...rest}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        aria-pressed={visible}
        className="absolute top-1/2 right-1 flex size-10 -translate-y-1/2 items-center justify-center rounded-xl text-muted hover:text-text"
      >
        {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  );
}

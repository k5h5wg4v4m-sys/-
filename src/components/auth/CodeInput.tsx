"use client";

import { cn } from "@/lib/cn";

export const OTP_LENGTH = 6;

/** Поле для кода из SMS: одно поле, автоподстановка кода на iOS/Android. */
export function CodeInput({
  id,
  value,
  onChange,
  invalid,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (code: string) => void;
  invalid?: boolean;
  disabled?: boolean;
}) {
  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]*"
      maxLength={OTP_LENGTH}
      autoFocus
      disabled={disabled}
      aria-invalid={invalid || undefined}
      placeholder={"•".repeat(OTP_LENGTH)}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, OTP_LENGTH))}
      className={cn(
        "h-14 w-full rounded-2xl border border-border bg-card text-center text-2xl font-bold tracking-[0.5em] text-text placeholder:text-muted/60",
        "focus:border-primary focus:bg-bg focus:ring-4 focus:ring-primary/15 focus:outline-none disabled:opacity-60",
        invalid && "border-danger focus:border-danger focus:ring-danger/15",
      )}
    />
  );
}

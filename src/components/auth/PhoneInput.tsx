"use client";

import { cn } from "@/lib/cn";

/** Оставляет 9 цифр номера после +996 (вставка "+996 555…" или "0555…" тоже работает). */
export function toLocalDigits(input: string) {
  let d = input.replace(/\D/g, "");
  if (d.length > 9 && d.startsWith("996")) d = d.slice(3);
  if (d.length === 10 && d.startsWith("0")) d = d.slice(1);
  return d.slice(0, 9);
}

/** "555123456" -> "555 123 456" */
function pretty(d: string) {
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join(" ");
}

/** Номер Кыргызстана: код +996 зафиксирован, пользователь вводит 9 цифр. value — только цифры. */
export function PhoneInput({
  id,
  value,
  onChange,
  invalid,
  disabled,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (digits: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-12 items-center rounded-2xl border border-border bg-card",
        "focus-within:border-primary focus-within:bg-bg focus-within:ring-4 focus-within:ring-primary/15",
        invalid && "border-danger focus-within:border-danger focus-within:ring-danger/15",
        disabled && "opacity-60",
      )}
    >
      <span className="flex h-full items-center border-r border-border px-4 font-semibold text-text select-none">+996</span>
      <input
        id={id}
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        placeholder="555 123 456"
        aria-invalid={invalid || undefined}
        disabled={disabled}
        autoFocus={autoFocus}
        value={pretty(value)}
        onChange={(e) => onChange(toLocalDigits(e.target.value))}
        className="h-full min-w-0 flex-1 rounded-r-2xl bg-transparent px-4 text-base tracking-wide text-text placeholder:text-muted focus:outline-none"
      />
    </div>
  );
}

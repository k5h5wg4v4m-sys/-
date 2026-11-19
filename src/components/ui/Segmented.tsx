"use client";

import { cn } from "@/lib/cn";

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
  label,
}: {
  value: T | undefined;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  onChange: (v: T) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex gap-1 rounded-2xl bg-bg p-1 shadow-sm ring-1 ring-border">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => !active && onChange(o.value)}
            className={cn(
              "flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold active:scale-[0.97] disabled:opacity-60",
              active ? "bg-primary text-on-primary shadow-sm" : "text-muted hover:text-text",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  text,
  children,
}: {
  icon: LucideIcon;
  title: string;
  text?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex animate-fade-up flex-col items-center rounded-3xl border border-border bg-surface px-6 py-14 text-center shadow-soft">
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <Icon className="size-8" />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {text && <p className="mt-1.5 max-w-sm text-sm text-muted">{text}</p>}
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export function EmptyState({
  icon: Icon,
  illustration,
  title,
  text,
  children,
  className,
}: {
  icon?: LucideIcon;
  illustration?: React.ReactNode;
  title: string;
  text?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex animate-rise flex-col items-center px-6 py-12 text-center", className)}>
      {illustration ??
        (Icon && (
          <div className="mb-5 flex size-20 items-center justify-center rounded-[28px] bg-primary-soft text-primary">
            <Icon className="size-9" strokeWidth={1.8} />
          </div>
        ))}
      <h2 className="text-lg font-bold">{title}</h2>
      {text && <p className="mt-1.5 max-w-xs text-[15px] text-muted">{text}</p>}
      {children && <div className="mt-6">{children}</div>}
    </div>
  );
}

import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

/** Общая карточка экранов входа и регистрации. */
export function AuthCard({
  icon,
  title,
  subtitle,
  children,
  footer,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex animate-rise flex-col gap-5">
      <Card as="section" className="bg-bg p-6 shadow-lg sm:p-8">
        {icon && (
          <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">{icon}</div>
        )}
        <h1 className="text-[26px] leading-tight font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 text-[15px] text-muted">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </Card>
      {footer && <div className="text-center text-[15px] text-muted">{footer}</div>}
    </div>
  );
}

export function FormError({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="animate-fade rounded-2xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
      {text}
    </p>
  );
}

/** Прогресс регистрации: 1 — номер, 2 — пароль, 3 — данные профиля. */
export function Steps({ current, label }: { current: number; label: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="grid flex-1 grid-cols-3 gap-1.5" aria-hidden>
        {[1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1.5 rounded-full", i <= current ? "bg-primary" : "bg-border")} />
        ))}
      </div>
      <span className="text-sm font-semibold text-muted">{label}</span>
    </div>
  );
}

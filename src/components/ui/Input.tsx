import { cn } from "@/lib/cn";

export function Field({
  label,
  required,
  error,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-primary">*</span>}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-danger">{error}</p>
      ) : hint ? (
        <p className="text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({
  className,
  icon,
  invalid,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { icon?: React.ReactNode; invalid?: boolean }) {
  return (
    <div className="relative">
      {icon && <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted">{icon}</span>}
      <input
        aria-invalid={invalid || undefined}
        className={cn(
          "h-12 w-full rounded-2xl border border-border bg-card px-4 text-base text-text placeholder:text-muted",
          "focus:border-primary focus:bg-bg focus:ring-4 focus:ring-primary/15 focus:outline-none",
          invalid && "border-danger focus:border-danger focus:ring-danger/15",
          Boolean(icon) && "pl-11",
          className,
        )}
        {...rest}
      />
    </div>
  );
}

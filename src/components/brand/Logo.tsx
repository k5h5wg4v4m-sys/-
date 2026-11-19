import Link from "next/link";
import { cn } from "@/lib/cn";

/** Знак TABYLGA: зелёный «бейдж» с меткой-находкой (табылга — находка). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("size-9", className)} aria-hidden>
      <rect width="40" height="40" rx="12" fill="var(--primary)" />
      <path d="M12 13.5h16" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M20 13.5v14" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="28.5" cy="27.5" r="3" fill="#fff" opacity=".9" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" aria-label="TABYLGA" className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="text-[19px] font-extrabold tracking-[0.08em] text-text">TABYLGA</span>
    </Link>
  );
}

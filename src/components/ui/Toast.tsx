"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "success" | "error" | "info";
type ToastItem = { id: number; tone: Tone; text: string };

const ToastContext = createContext<(text: string, tone?: Tone) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const icons = { success: CircleCheck, error: CircleAlert, info: Info };
const tones = { success: "text-primary", error: "text-danger", info: "text-muted" };

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const show = useCallback((text: string, tone: Tone = "success") => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs.slice(-2), { id, tone, text }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3200);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-4 pt-[max(12px,env(safe-area-inset-top))]"
      >
        {items.map((t) => {
          const Icon = icons[t.tone];
          return (
            <div
              key={t.id}
              role={t.tone === "error" ? "alert" : "status"}
              className="pointer-events-auto flex w-full max-w-sm animate-toast items-center gap-3 rounded-2xl border border-border bg-elevated px-4 py-3 text-sm font-medium shadow-lg"
            >
              <Icon className={cn("size-5 shrink-0", tones[t.tone])} />
              {t.text}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

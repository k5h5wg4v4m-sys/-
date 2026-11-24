import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CircleAlert } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Card } from "@/components/ui/Card";
import { LoginForm } from "@/components/auth/LoginForm";
import { getCurrentUser, safeNext } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = safeNext(next);
  if (await getCurrentUser()) redirect(target);
  const t = await getTranslations("auth");

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 pt-4 lg:pt-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <Logo />
        <h1 className="text-[26px] font-extrabold tracking-tight">{t("title")}</h1>
        <p className="text-[15px] text-muted">{t("subtitle")}</p>
      </div>
      <Card as="section" className="animate-rise p-5 sm:p-6">
        {isSupabaseConfigured ? (
          <LoginForm next={target} />
        ) : (
          <p className="flex items-start gap-3 text-sm text-danger">
            <CircleAlert className="mt-0.5 size-5 shrink-0" /> {t("notConfigured")}
          </p>
        )}
      </Card>
    </div>
  );
}

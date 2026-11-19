import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ShieldCheck } from "lucide-react";
import { AuthCard, Steps } from "@/components/auth/AuthCard";
import { SetPasswordForm } from "@/components/auth/SetPasswordForm";
import { getSession, hasPassword } from "@/lib/auth";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("setPasswordTitle") };
}

export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const reset = (await searchParams).mode === "reset";
  // Пароль уже есть, а это не восстановление — шаг пройден.
  if (!reset && hasPassword(session.user)) redirect("/onboarding");
  const t = await getTranslations("auth");

  return (
    <AuthCard
      icon={<ShieldCheck className="size-7" />}
      title={reset ? t("resetPasswordTitle") : t("setPasswordTitle")}
      subtitle={reset ? t("resetPasswordSubtitle") : t("setPasswordSubtitle")}
    >
      {!reset && <Steps current={2} label={t("stepOf", { current: 2, total: 3 })} />}
      <SetPasswordForm mode={reset ? "reset" : "register"} next="/onboarding" />
    </AuthCard>
  );
}

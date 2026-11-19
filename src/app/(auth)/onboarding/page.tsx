import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { IdCard } from "lucide-react";
import { AuthCard, Steps } from "@/components/auth/AuthCard";
import { OnboardingForm } from "@/components/auth/OnboardingForm";
import { getSession, onboardingStep } from "@/lib/auth";

export async function generateMetadata() {
  const t = await getTranslations("auth.profile");
  return { title: t("title") };
}

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const step = onboardingStep(session);
  if (step === "/set-password") redirect(step);
  if (step === null) redirect("/");

  const t = await getTranslations("auth.profile");
  const ta = await getTranslations("auth");
  const p = session.profile;
  return (
    <AuthCard icon={<IdCard className="size-7" />} title={t("title")} subtitle={t("subtitle")}>
      <Steps current={3} label={ta("stepOf", { current: 3, total: 3 })} />
      <OnboardingForm
        userId={session.user.id}
        next="/"
        initial={{
          firstName: p?.first_name ?? "",
          lastName: p?.last_name ?? "",
          middleName: p?.middle_name ?? "",
          birthYear: p?.birth_year ? String(p.birth_year) : "",
          gender: p?.gender ?? "",
        }}
      />
    </AuthCard>
  );
}

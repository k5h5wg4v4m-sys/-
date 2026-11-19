import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { KeyRound } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";
import { PhoneOtpForm } from "@/components/auth/PhoneOtpForm";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("forgotTitle") };
}

export default async function ForgotPage() {
  const t = await getTranslations("auth");
  return (
    <AuthCard
      icon={<KeyRound className="size-7" />}
      title={t("forgotTitle")}
      subtitle={t("forgotSubtitle")}
      footer={
        <Link href="/login" className="font-semibold text-primary hover:text-primary-strong">
          {t("backToLogin")}
        </Link>
      }
    >
      <PhoneOtpForm mode="reset" />
    </AuthCard>
  );
}

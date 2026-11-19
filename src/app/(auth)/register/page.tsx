import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { UserRoundPlus } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";
import { PhoneOtpForm } from "@/components/auth/PhoneOtpForm";
import { getSession } from "@/lib/auth";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("registerTitle") };
}

export default async function RegisterPage() {
  if (await getSession()) redirect("/");
  const t = await getTranslations("auth");

  return (
    <AuthCard
      icon={<UserRoundPlus className="size-7" />}
      title={t("registerTitle")}
      subtitle={t("registerSubtitle")}
      footer={
        <>
          {t("haveAccount")}{" "}
          <Link href="/login" className="font-semibold text-primary hover:text-primary-strong">
            {t("loginLink")}
          </Link>
        </>
      }
    >
      <PhoneOtpForm mode="register" />
    </AuthCard>
  );
}

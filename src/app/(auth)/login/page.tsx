import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LogIn } from "lucide-react";
import { AuthCard } from "@/components/auth/AuthCard";
import { LoginForm } from "@/components/auth/LoginForm";
import { getSession } from "@/lib/auth";
import { safeNext } from "@/lib/safe-next";

export async function generateMetadata() {
  const t = await getTranslations("auth");
  return { title: t("loginTitle") };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  if (await getSession()) redirect(next);
  const t = await getTranslations("auth");

  return (
    <AuthCard
      icon={<LogIn className="size-7" />}
      title={t("loginTitle")}
      subtitle={t("loginSubtitle")}
      footer={
        <>
          {t("noAccount")}{" "}
          <Link href="/register" className="font-semibold text-primary hover:text-primary-strong">
            {t("registerLink")}
          </Link>
        </>
      }
    >
      <LoginForm next={next} />
    </AuthCard>
  );
}

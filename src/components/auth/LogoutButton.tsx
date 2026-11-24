"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const t = useTranslations("auth");
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  async function logout() {
    setLoading(true);
    const { error } = await getSupabaseBrowserClient().auth.signOut();
    if (error) {
      toast(t("failed"), "error");
      setLoading(false);
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button variant="secondary" onClick={logout} loading={loading} className="w-full sm:w-auto">
      <LogOut className="size-4" /> {t("logout")}
    </Button>
  );
}

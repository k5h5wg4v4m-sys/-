"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuthErrorText } from "./useAuthError";

export function LogoutButton() {
  const t = useTranslations("auth");
  const errorText = useAuthErrorText();
  const toast = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  return (
    <Button
      variant="secondary"
      loading={loading}
      className="w-full text-danger"
      onClick={async () => {
        setLoading(true);
        const { error } = await getSupabaseBrowserClient().auth.signOut({ scope: "local" });
        if (error) {
          toast(errorText(error), "error");
          setLoading(false);
          return;
        }
        router.replace("/");
        router.refresh();
      }}
    >
      {!loading && <LogOut className="size-5" />}
      {t("logout")}
    </Button>
  );
}

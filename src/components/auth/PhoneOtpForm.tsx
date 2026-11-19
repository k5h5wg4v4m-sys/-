"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { formatKgPhone } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { FormError, Steps } from "./AuthCard";
import { CodeInput, OTP_LENGTH } from "./CodeInput";
import { PhoneInput } from "./PhoneInput";
import { useAuthErrorText } from "./useAuthError";

const RESEND_SECONDS = 60;

/**
 * Подтверждение номера по SMS.
 *  register — создаёт пользователя в Supabase Auth (если номера ещё нет) и ведёт к созданию пароля;
 *  reset    — только для существующих номеров, ведёт к новому паролю.
 */
export function PhoneOtpForm({ mode }: { mode: "register" | "reset" }) {
  const steps = mode === "register";
  const t = useTranslations("auth");
  const errorText = useAuthErrorText();
  const toast = useToast();
  const router = useRouter();

  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [phoneError, setPhoneError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  async function sendCode() {
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        phone: `+996${phone}`,
        options: { shouldCreateUser: mode === "register", channel: "sms" },
      });
      if (error) throw error;
      setStep("code");
      setCode("");
      setResendIn(RESEND_SECONDS);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }

  async function onSubmitPhone(e: React.FormEvent) {
    e.preventDefault();
    if (phone.length !== 9) {
      setPhoneError(true);
      return;
    }
    await sendCode();
  }

  async function onSubmitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (code.length !== OTP_LENGTH) {
      setError(t("codeIncomplete"));
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.verifyOtp({ phone: `+996${phone}`, token: code, type: "sms" });
      if (error) throw error;

      if (mode === "reset") {
        router.replace("/set-password?mode=reset");
      } else if (data.user?.user_metadata?.password_set === true) {
        // Номер уже зарегистрирован: владелец подтвердил его по SMS, поэтому просто входим.
        toast(t("alreadyRegistered"), "info");
        router.replace("/");
      } else {
        router.replace("/set-password");
      }
      router.refresh();
    } catch (err) {
      setError(errorText(err));
      setLoading(false);
    }
  }

  if (step === "phone") {
    return (
      <form onSubmit={onSubmitPhone} noValidate className="flex flex-col gap-4">
        {steps && <Steps current={1} label={t("stepOf", { current: 1, total: 3 })} />}
        <Field
          label={t("phone")}
          htmlFor="phone"
          error={phoneError ? t("phoneInvalid") : undefined}
          hint={t("phoneHint")}
        >
          <PhoneInput
            id="phone"
            value={phone}
            autoFocus
            invalid={phoneError}
            onChange={(v) => {
              setPhone(v);
              setPhoneError(false);
            }}
          />
        </Field>
        <FormError text={error} />
        <Button type="submit" size="lg" loading={loading}>
          {t("sendCode")}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmitCode} noValidate className="flex flex-col gap-4">
      {steps && <Steps current={1} label={t("stepOf", { current: 1, total: 3 })} />}
      <p className="text-[15px] text-muted">
        {t("codeSent", { phone: formatKgPhone(`996${phone}`) })}{" "}
        <button
          type="button"
          className="font-semibold text-primary hover:text-primary-strong"
          onClick={() => {
            setStep("phone");
            setError(null);
          }}
        >
          {t("changePhone")}
        </button>
      </p>
      <Field label={t("code")} htmlFor="code">
        <CodeInput id="code" value={code} onChange={setCode} disabled={loading} invalid={Boolean(error)} />
      </Field>
      <FormError text={error} />
      <Button type="submit" size="lg" loading={loading} disabled={code.length !== OTP_LENGTH}>
        {t("confirm")}
      </Button>
      <Button type="button" variant="ghost" disabled={resendIn > 0 || loading} onClick={sendCode}>
        {resendIn > 0 ? t("resendIn", { seconds: resendIn }) : t("resend")}
      </Button>
    </form>
  );
}

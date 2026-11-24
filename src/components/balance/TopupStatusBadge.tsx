import { useTranslations } from "next-intl";
import { Badge, type BadgeTone } from "@/components/ui/Badge";

export type TopupStatus = "pending" | "approved" | "rejected";

const tones: Record<TopupStatus, BadgeTone> = { pending: "warning", approved: "success", rejected: "danger" };

export function TopupStatusBadge({ status }: { status: TopupStatus }) {
  const t = useTranslations("topupStatus");
  return <Badge tone={tones[status]}>{t(status)}</Badge>;
}

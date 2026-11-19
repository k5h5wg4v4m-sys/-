import {
  Apple, Baby, Briefcase, Building2, Car, Cog, Dumbbell, Flower2, Gamepad2, Hammer, HeartPulse,
  Laptop, Package, PawPrint, Shirt, Smartphone, Sofa, Sparkles, Tv, WashingMachine, type LucideIcon,
} from "lucide-react";

/**
 * Справочник категорий. Должен совпадать с таблицей public.categories (supabase/migrations/001_base.sql):
 * id и slug — те же; названия — в messages/*.json -> categories.<slug>.
 */
export const CATEGORIES = [
  { id: 1, slug: "electronics", icon: Tv },
  { id: 2, slug: "phones", icon: Smartphone },
  { id: 3, slug: "computers", icon: Laptop },
  { id: 4, slug: "appliances", icon: WashingMachine },
  { id: 5, slug: "clothing", icon: Shirt },
  { id: 6, slug: "beauty-health", icon: HeartPulse },
  { id: 7, slug: "perfume-cosmetics", icon: Sparkles },
  { id: 8, slug: "kids", icon: Baby },
  { id: 9, slug: "furniture", icon: Sofa },
  { id: 10, slug: "home-garden", icon: Flower2 },
  { id: 11, slug: "construction", icon: Hammer },
  { id: 12, slug: "cars", icon: Car },
  { id: 13, slug: "auto-parts", icon: Cog },
  { id: 14, slug: "real-estate", icon: Building2 },
  { id: 15, slug: "animals", icon: PawPrint },
  { id: 16, slug: "sport", icon: Dumbbell },
  { id: 17, slug: "hobby", icon: Gamepad2 },
  { id: 18, slug: "jobs-services", icon: Briefcase },
  { id: 19, slug: "food", icon: Apple },
  { id: 20, slug: "other", icon: Package },
] as const satisfies readonly { id: number; slug: string; icon: LucideIcon }[];

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export function findCategory(slug: string) {
  return CATEGORIES.find((c) => c.slug === slug);
}

import { Heart, House, MessagesSquare, Plus, UserRound, type LucideIcon } from "lucide-react";

export type NavKey = "home" | "favorites" | "post" | "chats" | "profile";

export const NAV_ITEMS: { key: NavKey; href: string; icon: LucideIcon }[] = [
  { key: "home", href: "/", icon: House },
  { key: "favorites", href: "/favorites", icon: Heart },
  { key: "post", href: "/new", icon: Plus },
  { key: "chats", href: "/chats", icon: MessagesSquare },
  { key: "profile", href: "/profile", icon: UserRound },
];

const HOME_SECTIONS = ["/search", "/categories", "/category", "/notifications"];
const PROFILE_SECTIONS = ["/balance", "/admin", "/login"];

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || HOME_SECTIONS.some((s) => pathname.startsWith(s));
  if (href === "/profile" && PROFILE_SECTIONS.some((s) => pathname === s || pathname.startsWith(s + "/"))) return true;
  return pathname === href || pathname.startsWith(href + "/");
}

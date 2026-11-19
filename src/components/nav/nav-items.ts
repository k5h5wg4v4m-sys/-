import { Heart, Home, MessageCircle, Plus, User, type LucideIcon } from "lucide-react";

export type NavKey = "home" | "favorites" | "post" | "chats" | "profile";

export const NAV_ITEMS: { key: NavKey; href: string; icon: LucideIcon }[] = [
  { key: "home", href: "/", icon: Home },
  { key: "favorites", href: "/favorites", icon: Heart },
  { key: "post", href: "/new", icon: Plus },
  { key: "chats", href: "/chats", icon: MessageCircle },
  { key: "profile", href: "/profile", icon: User },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

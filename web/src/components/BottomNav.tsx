"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Skull, Crosshair, Users, Spade, UserRound } from "lucide-react";

const tabs = [
  { href: "/", key: "crimes", icon: Skull },
  { href: "/city", key: "city", icon: Crosshair },
  { href: "/family", key: "family", icon: Users },
  { href: "/casino", key: "casino", icon: Spade },
  { href: "/profile", key: "profile", icon: UserRound },
] as const;

export function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-gold/20 bg-night/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="grid grid-cols-5">
        {tabs.map(({ href, key, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={key}
              href={href}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[0.7rem] transition-colors ${
                active ? "text-gold" : "text-ivory-dim hover:text-ivory"
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              {t(key)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

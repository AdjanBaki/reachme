"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./ui";

const items = [
  { href: "/leads", label: "Leads" },
  { href: "/redo-att-skicka", label: "Redo att skicka" },
  { href: "/installningar", label: "Inställningar" },
  { href: "/sparrlista", label: "Spärrlista" },
  { href: "/abonnemang", label: "Abonnemang" },
];

/** Main navigation: vertical in the sidebar on wide screens, a scrollable row on phones. */
export function AppNav({ orientation }: { orientation: "vertical" | "horizontal" }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Huvudmeny">
      <ul className={cx(orientation === "vertical" ? "space-y-0.5" : "flex gap-1 overflow-x-auto")}>
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "block rounded-md px-3 py-1.5 text-sm",
                  active
                    ? "bg-accent-soft font-medium text-teal-900 dark:text-teal-50"
                    : "text-muted hover:bg-black/5 hover:text-foreground dark:hover:bg-white/5",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

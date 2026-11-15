"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cx } from "./ui";

const items = [
  { href: "/leads", label: "Leads" },
  { href: "/redo-att-skicka", label: "Redo att skicka" },
  { href: "/installningar", label: "Inställningar" },
  { href: "/sparrlista", label: "Spärrlista" },
  { href: "/abonnemang", label: "Abonnemang" },
];

type Orientation = "vertical" | "horizontal";

function NavList({ orientation, pathname }: { orientation: Orientation; pathname: string | null }) {
  return (
    <ul className={cx(orientation === "vertical" ? "space-y-0.5" : "flex gap-1 overflow-x-auto")}>
      {items.map((item) => {
        const active = pathname !== null && (pathname === item.href || pathname.startsWith(`${item.href}/`));
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
  );
}

function ActiveNavList({ orientation }: { orientation: Orientation }) {
  const pathname = usePathname();
  return <NavList orientation={orientation} pathname={pathname} />;
}

/**
 * Main navigation: vertical in the sidebar on wide screens, a scrollable row on phones.
 * The pathname is unknown while prerendering dynamic routes, so the links render
 * without highlighting until it resolves.
 */
export function AppNav({ orientation }: { orientation: Orientation }) {
  return (
    <nav aria-label="Huvudmeny">
      <Suspense fallback={<NavList orientation={orientation} pathname={null} />}>
        <ActiveNavList orientation={orientation} />
      </Suspense>
    </nav>
  );
}

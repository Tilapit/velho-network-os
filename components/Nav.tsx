"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function Nav({ counts }: { counts: Record<string, number | undefined> }) {
  const path = usePathname();
  const items = [
    { href: "/", label: "Overview", key: "overview" },
    { href: "/network", label: "Network", key: "network" },
    { href: "/engagement", label: "Engagement", key: "engagement" },
    { href: "/opportunities", label: "Opportunities", key: "opportunities" },
    { href: "/intelligence", label: "Intelligence", key: "intelligence" },
    { href: "/data", label: "Data sources", key: "data" },
  ];
  return (
    <nav className="nav" aria-label="Main">
      {items.map((i) => {
        const active = i.href === "/" ? path === "/" || path.startsWith("/people") : path.startsWith(i.href);
        return (
          <Link key={i.href} href={i.href} className={active ? "active" : ""}>
            <span>{i.label}</span>
            {counts[i.key] !== undefined ? <span className="count num">{counts[i.key]}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}

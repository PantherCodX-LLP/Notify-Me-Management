"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { section: "Analytics" },
  { href: "/", label: "Overview", icon: "▦" },
  { href: "/conversion", label: "Conversion & Revenue", icon: "↗" },
  { section: "Merchants" },
  { href: "/shops", label: "Shops Explorer", icon: "🏪" },
  { href: "/installs", label: "Installs", icon: "⬇" },
  { href: "/uninstalls", label: "Churn & Uninstalls", icon: "⤴" },
  { href: "/plans", label: "Plans & Billing", icon: "◆" },
  { href: "/mrr", label: "MRR & Revenue", icon: "$" },
  { section: "Product" },
  { href: "/notifications", label: "Notifications", icon: "🔔" },
  { href: "/features", label: "Features", icon: "✦" },
  { section: "Growth" },
  { href: "/marketing", label: "Marketing", icon: "📣" },
  { href: "/email", label: "Email Outreach", icon: "✉" },
  { section: "Database" },
  { href: "/tables", label: "Table Explorer", icon: "▤" },
  { href: "/schema", label: "Schema & Mapping", icon: "⚙" },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo">N</div>
        <div>
          <div className="name">Notify Me</div>
          <div className="sub">Admin Dashboard</div>
        </div>
      </div>
      <nav className="nav">
        {LINKS.map((l, i) =>
          "section" in l ? (
            <div className="section" key={i}>
              {l.section}
            </div>
          ) : (
            <Link
              key={l.href}
              href={l.href!}
              className={path === l.href || (l.href !== "/" && path.startsWith(l.href!)) ? "active" : ""}
            >
              <span className="ico">{l.icon}</span>
              {l.label}
            </Link>
          )
        )}
      </nav>
      <div className="foot">
        Read-only · app_bis
        <br />
        Back in Stock · Shopify
      </div>
    </aside>
  );
}

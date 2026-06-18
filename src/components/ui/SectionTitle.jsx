import React from "react";

/**
 * Polished section heading. Two looks:
 *  - Default: small uppercase label with a primary accent bar.
 *  - With `icon`: a tinted rounded icon badge before the title (card section style).
 *
 * Usage:
 *   <SectionTitle>Key Performance Indicators</SectionTitle>
 *   <SectionTitle icon={Activity} as="h3" size="card">Recent Visits</SectionTitle>
 */
export default function SectionTitle({
  children,
  icon: Icon,
  as: Tag = "h2",
  size = "label",
  color = "primary",
  className = "",
}) {
  const tints = {
    primary: { bg: "bg-primary/10", text: "text-primary", bar: "bg-primary" },
    accent: { bg: "bg-accent/10", text: "text-accent", bar: "bg-accent" },
    "chart-2": { bg: "bg-chart-2/10", text: "text-chart-2", bar: "bg-chart-2" },
  };
  const t = tints[color] || tints.primary;

  if (Icon) {
    return (
      <Tag className={`font-heading text-sm font-semibold flex items-center gap-2 ${className}`}>
        <span className={`w-7 h-7 rounded-lg ${t.bg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-4 h-4 ${t.text}`} />
        </span>
        {children}
      </Tag>
    );
  }

  if (size === "card") {
    return (
      <Tag className={`font-heading text-sm font-semibold flex items-center gap-2 ${className}`}>
        <span className={`w-1 h-3.5 rounded-full ${t.bar}`} /> {children}
      </Tag>
    );
  }

  return (
    <Tag className={`flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider ${className}`}>
      <span className={`w-1 h-3.5 rounded-full ${t.bar}`} /> {children}
    </Tag>
  );
}
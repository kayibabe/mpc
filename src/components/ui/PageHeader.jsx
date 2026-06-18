import React from "react";

/**
 * Polished page header with an accent bar, title, optional subtitle and right-aligned actions.
 * Usage:
 *   <PageHeader title="Reception" subtitle="Register & check in patients" icon={Users}>
 *     <Button>Action</Button>
 *   </PageHeader>
 */
export default function PageHeader({ title, subtitle, icon: Icon, children, className = "" }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${className}`}>
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/15 to-accent/10 ring-1 ring-inset ring-primary/10 flex items-center justify-center flex-shrink-0 shadow-sm">
            <Icon className="w-5 h-5 text-primary" strokeWidth={2.25} />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground truncate">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {children && <div className="flex items-center gap-2 flex-shrink-0">{children}</div>}
    </div>
  );
}
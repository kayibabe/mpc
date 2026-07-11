import React from "react";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="h-screen overflow-hidden flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-5">
          <div className="w-16 h-16 rounded-2xl mb-3 mx-auto flex items-center justify-center bg-primary text-primary-foreground text-3xl">🏥</div>
          <div className="flex items-center justify-center gap-2">
            <span className="text-lg font-semibold text-primary tracking-wide uppercase">Mtowera Private Clinic</span>
          </div>
          <div className="mt-5">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
            {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
          </div>
        </div>
        <div className="bg-card rounded-2xl shadow-sm border border-border p-6">
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-4">{footer}</p>
        )}
      </div>
    </div>
  );
}
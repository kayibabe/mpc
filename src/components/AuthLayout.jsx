import React from "react";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <img
            src="https://media.base44.com/images/public/6a31ab83c014cd4c6a751648/294736bde_image.png"
            alt="Zomba City Private Clinic"
            className="w-16 h-16 rounded-2xl mb-4 mx-auto object-cover"
          />
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-lg font-semibold text-primary tracking-wide uppercase">Zomba City Private Clinic</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="text-muted-foreground mt-2">{subtitle}</p>}
        </div>
        <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
        )}
      </div>
    </div>
  );
}
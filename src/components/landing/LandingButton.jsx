import React from "react";

export default function LandingButton({ children, href = "#case", onClick, variant = "amber", className = "" }) {
  const base =
    "inline-flex items-center justify-center gap-2 font-display font-bold uppercase tracking-[0.04em] text-[15px] rounded-lg transition-transform hover:-translate-y-px";
  const variants = {
    amber: "bg-alert text-alert-foreground px-6 py-3 hover:bg-[#e69500]",
    ghost:
      "bg-transparent text-foreground border border-border px-4 py-2.5 text-[13px] hover:border-alert hover:text-alert",
  };
  return (
    <a href={href} onClick={onClick} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </a>
  );
}
import React from "react";

const stats = [
  { big: "$15.1B", sub: "lost by the industry to detention in one year", src: "ATRI, 2024" },
  { big: "<50%", sub: "of detention invoices actually get paid", src: "industry surveys" },
  { big: "$11–19K", sub: "uncompensated loss per driver, per year", src: "ATRI, 2024" },
];

export default function LandingStats() {
  return (
    <div className="border-y border-border bg-surface py-9">
      <div className="max-w-5xl mx-auto px-6 grid sm:grid-cols-3 gap-6">
        {stats.map((s, i) => (
          <div key={i}>
            <b className="font-display font-extrabold text-[34px] leading-none block">{s.big}</b>
            <span className="text-sm text-muted-foreground">{s.sub}</span>
            <i className="font-mono not-italic text-[11px] text-muted-foreground/70 block mt-1.5">
              {s.src}
            </i>
          </div>
        ))}
      </div>
    </div>
  );
}
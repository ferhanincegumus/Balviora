import React from "react";
import Eyebrow from "@/components/landing/Eyebrow";

export default function LandingProof() {
  return (
    <section id="proof" className="pt-0 pb-16 sm:pb-24 scroll-mt-24">
      <div className="max-w-5xl mx-auto px-6">
        <Eyebrow>Proof over promises</Eyebrow>
        <h2 className="font-display font-extrabold uppercase tracking-[0.01em] text-[clamp(30px,4.5vw,44px)] leading-[1.05]">
          The recovery log
        </h2>
        <p className="text-lg text-muted-foreground max-w-[560px] mt-4">
          Every dollar clawed back gets logged here. Real cases, real brokers, real deposits.
        </p>
        <div className="mt-10 rounded-2xl border border-border overflow-hidden font-mono text-sm">
          <div className="bg-muted px-5 py-3.5 text-muted-foreground text-xs uppercase tracking-[0.12em] flex justify-between gap-3 flex-wrap">
            <span>Recovered to date</span>
            <b className="text-money font-medium">$0 — log opens with case #001</b>
          </div>
          <div className="grid sm:grid-cols-[110px_1fr_120px] gap-4 px-5 py-4 bg-surface border-t border-border">
            <span className="text-muted-foreground">CASE #001</span>
            <span className="text-foreground">
              Your case could be the first entry on this board.
            </span>
            <span className="text-money sm:text-right">—</span>
          </div>
          <div className="px-5 py-4 border-t border-dashed border-border text-muted-foreground text-xs bg-surface">
            // This log fills with verified recoveries only. No inflated numbers, no fake
            testimonials — deposit or it didn't happen.
          </div>
        </div>
      </div>
    </section>
  );
}
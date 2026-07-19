import React from "react";
import Eyebrow from "@/components/landing/Eyebrow";
import LandingButton from "@/components/landing/LandingButton";
import { trackEvent } from "@/lib/landingAnalytics";

const items = [
  "You pay a percentage only from money actually recovered",
  "Percentage agreed before I touch your case — no surprises",
  "Broker doesn't pay? You keep your $0. I eat the work.",
  "Cancel anytime. Your documents stay yours.",
];

export default function LandingPricing() {
  return (
    <section id="pricing" className="pt-0 pb-16 sm:pb-24 scroll-mt-24">
      <div className="max-w-5xl mx-auto px-6">
        <Eyebrow>Pricing</Eyebrow>
        <h2 className="font-display font-extrabold uppercase tracking-[0.01em] text-[clamp(30px,4.5vw,44px)] leading-[1.05] text-center">
          No recovery. No fee.
        </h2>
        <div className="max-w-[560px] mx-auto mt-11 rounded-2xl border border-alert bg-gradient-to-b from-surface to-background p-10 text-center">
          <div className="font-display font-extrabold text-[72px] leading-none">$0</div>
          <span className="block font-mono text-[13px] text-muted-foreground mt-2 mb-5">
            UPFRONT · NO SUBSCRIPTION · NO CONTRACT
          </span>
          <ul className="text-left mx-auto mb-7 max-w-[380px] text-muted-foreground text-[15px]">
            {items.map((it, i) => (
              <li
                key={i}
                className="py-2.5 border-b border-dashed border-border flex gap-2.5 last:border-0"
              >
                <span className="text-alert">→</span>
                <span>{it}</span>
              </li>
            ))}
          </ul>
          <LandingButton
            href="#case"
            onClick={() => trackEvent("cta_clicked", { location: "pricing" })}
          >
            Send my first case
          </LandingButton>
        </div>
      </div>
    </section>
  );
}
import React from "react";
import Eyebrow from "@/components/landing/Eyebrow";

const steps = [
  {
    tag: "STEP 1 — YOU",
    title: "Send the case",
    body: "Rate con, arrival & departure times, broker name. Photos if you have them. Takes five minutes from the cab.",
  },
  {
    tag: "STEP 2 — ME",
    title: "I build & chase",
    body: 'GPS-stamped timeline, the detention clause from your own rate con, a professional invoice — then relentless follow-up at day 7, 14, and 30. Brokers can\'t claim "no documentation" anymore.',
  },
  {
    tag: "STEP 3 — YOU, AGAIN",
    title: "Get paid",
    body: "The money goes to you. I take my cut only from what's actually recovered. Broker stiffs us? You owe nothing.",
  },
];

export default function LandingHow() {
  return (
    <section id="how" className="py-16 sm:py-24 scroll-mt-24">
      <div className="max-w-5xl mx-auto px-6">
        <Eyebrow>How it works</Eyebrow>
        <h2 className="font-display font-extrabold uppercase tracking-[0.01em] text-[clamp(30px,4.5vw,44px)] leading-[1.05]">
          You drive. I chase.
        </h2>
        <p className="text-lg text-muted-foreground max-w-[560px] mt-4">
          Three moves. None of them cost you anything up front.
        </p>
        <div className="grid md:grid-cols-3 gap-5 mt-11">
          {steps.map((s, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-surface p-7 transition-colors hover:border-alert"
            >
              <span className="block font-mono text-xs text-alert tracking-[0.12em] mb-3.5">
                {s.tag}
              </span>
              <h3 className="font-display font-bold text-xl tracking-[0.02em] mb-2.5">{s.title}</h3>
              <p className="text-muted-foreground text-[15px]">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
import React from "react";
import Eyebrow from "@/components/landing/Eyebrow";

export default function LandingFounder() {
  return (
    <section className="pt-0 pb-16 sm:pb-24 scroll-mt-24">
      <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-[1.1fr_0.9fr] gap-14 items-center">
        <div>
          <Eyebrow>Why me</Eyebrow>
          <blockquote className="font-display font-semibold text-[clamp(22px,3vw,30px)] leading-[1.3] border-l-[3px] border-alert pl-6 mb-5">
            "I've sat at the dock for six hours, called the broker, and heard 'we'll check the
            camera footage.' I know the runaround because I've lived it."
          </blockquote>
          <p className="text-muted-foreground">
            I'm not a software company that discovered trucking last quarter. I drive. I've lost
            this money myself, load after load, and I built this system to get it back — first for
            me, now for you. When I email a broker, it's with the paperwork they can't argue with and
            the persistence they can't wait out.
          </p>
          <span className="block mt-5 font-mono text-[13px] text-foreground">
            — Ferhan, owner-operator & founder
          </span>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-6 font-mono text-[13px] text-muted-foreground leading-8">
          <b className="text-foreground font-medium">DRIVER-SIDE FACTS</b>
          <br />
          &gt; Years on the road: <b className="text-foreground font-medium">10+</b>
          <br />
          &gt; Detention runaround survived: <b className="text-foreground font-medium">every flavor</b>
          <br />
          &gt; Evidence standard: <b className="text-money font-medium">GPS-stamped</b>
          <br />
          &gt; Follow-up cadence: <b className="text-foreground font-medium">day 7 / 14 / 30</b>
          <br />
          &gt; Upfront cost to you: <b className="text-money font-medium">$0</b>
        </div>
      </div>
    </section>
  );
}
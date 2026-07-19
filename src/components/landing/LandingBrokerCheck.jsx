import React, { useState } from "react";
import Eyebrow from "@/components/landing/Eyebrow";
import LandingButton from "@/components/landing/LandingButton";

export default function LandingBrokerCheck() {
  const [name, setName] = useState("");
  const [show, setShow] = useState(false);

  return (
    <section id="brokers" className="pt-0 pb-16 sm:pb-24 scroll-mt-24">
      <div className="max-w-5xl mx-auto px-6">
        <Eyebrow>Free tool</Eyebrow>
        <h2 className="font-display font-extrabold uppercase tracking-[0.01em] text-[clamp(30px,4.5vw,44px)] leading-[1.05]">
          Does your broker actually pay detention?
        </h2>
        <p className="text-lg text-muted-foreground max-w-[560px] mt-4">
          Type a broker name. I'm building a payment-behavior file on brokers, case by case.
        </p>
        <div className="mt-10 rounded-2xl border border-border bg-surface p-8 max-w-[640px]">
          <div className="flex gap-3 flex-wrap">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. TQL, CH Robinson, Coyote…"
              aria-label="Broker name"
              className="flex-1 min-w-[220px] bg-background border border-border rounded-lg px-4 py-3 text-foreground text-[15px] focus-visible:outline-none focus-visible:border-alert"
            />
            <LandingButton
              variant="ghost"
              href="#brokers"
              onClick={(e) => {
                e.preventDefault();
                if (!name.trim()) return;
                setShow(true);
              }}
            >
              Check broker
            </LandingButton>
          </div>
          {show && (
            <div className="mt-5 rounded-xl border border-dashed border-border p-5 font-mono text-[13px] text-muted-foreground leading-8">
              <b className="text-foreground font-medium">
                BROKER FILE — {name.trim().toUpperCase()}
              </b>
              <br />
              &gt; Detention clause honored:{" "}
              <span className="blur-[5px] select-none">sometimes, with pressure</span>
              <br />
              &gt; Avg. days to pay: <span className="blur-[5px] select-none">34 days</span>
              <br />
              &gt; Best pressure point:{" "}
              <span className="blur-[5px] select-none">accounts payable escalation</span>
              <br />
              <span className="text-alert">
                → Full files unlock as the recovery log grows. Send a case on this broker and I'll
                dig in for free.
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
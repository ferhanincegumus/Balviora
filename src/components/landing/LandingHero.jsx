import React, { useEffect, useRef, useState } from "react";
import Eyebrow from "@/components/landing/Eyebrow";
import LandingButton from "@/components/landing/LandingButton";
import { trackEvent } from "@/lib/landingAnalytics";

// Industry loss: $15.1B / year ≈ $478.8 / second.
const PER_SEC = 15100000000 / 31536000;
const fmt = (n) => "$" + Math.floor(n).toLocaleString("en-US");

export default function LandingHero() {
  const [ticker, setTicker] = useState(0);
  const [hrs, setHrs] = useState(6);
  const [rate, setRate] = useState(85);
  const start = useRef(Date.now());

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = setInterval(() => {
      setTicker(((Date.now() - start.current) / 1000) * PER_SEC);
    }, reduce ? 2000 : 100);
    return () => clearInterval(id);
  }, []);

  const yearly = hrs * rate * 12;

  return (
    <header id="top" className="relative overflow-hidden pt-20 sm:pt-24 pb-16 sm:pb-20">
      <div
        className="absolute inset-0 -z-10 pointer-events-none"
        aria-hidden="true"
        style={{
          backgroundImage:
            "radial-gradient(700px 340px at 78% -10%, hsl(var(--amber)/0.09), transparent 60%), repeating-linear-gradient(90deg, transparent 0 90px, rgba(255,255,255,0.015) 90px 92px)",
        }}
      />
      <div className="max-w-5xl mx-auto px-6">
        <Eyebrow>Detention recovery · By a trucker, for truckers</Eyebrow>
        <h1 className="font-display font-extrabold uppercase tracking-[0.01em] leading-[1.05] text-[clamp(42px,7vw,76px)]">
          They made you wait.
          <br />
          <span className="text-alert">Make them pay.</span>
        </h1>
        <p className="mt-5 text-lg text-muted-foreground max-w-[560px]">
          Brokers stall, "lose" your paperwork, and hope you give up. I don't give up. Send me your
          detention case — I build the GPS-stamped evidence, chase the broker, and you only pay
          when the money lands.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-4">
          <LandingButton href="#case" onClick={() => trackEvent("cta_clicked", { location: "hero" })}>
            Send my case — free
          </LandingButton>
          <span className="font-mono text-[13px] text-muted-foreground inline-flex items-center gap-2">
            <span className="text-money">●</span> No recovery, no fee. Ever.
          </span>
        </div>

        {/* Live industry loss ticker */}
        <div className="mt-14 rounded-2xl border border-border bg-surface p-6 sm:p-7 flex flex-wrap gap-7 items-center">
          <div className="font-mono font-medium text-[clamp(30px,5vw,46px)] text-alert tracking-tight min-w-[290px] tnum">
            {fmt(ticker)}
          </div>
          <p className="text-sm text-muted-foreground max-w-[340px]">
            <b className="text-foreground font-semibold">
              Lost to unpaid detention since you opened this page.
            </b>{" "}
            The industry bleeds $15.1B a year waiting at docks. Some of it is yours.
          </p>
        </div>

        {/* Cost calculator */}
        <div className="mt-6 rounded-2xl border border-border bg-surface p-6 sm:p-7">
          <h3 className="font-display font-bold text-xl">What's the wait costing you?</h3>
          <p className="text-sm text-muted-foreground mt-1.5 mb-5">
            Drag the sliders. This is money you already earned.
          </p>
          <div className="grid sm:grid-cols-2 gap-7">
            <div>
              <label className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground flex justify-between mb-2.5">
                Detention hours / month <output className="text-alert font-medium">{hrs} h</output>
              </label>
              <input
                type="range"
                min="1"
                max="30"
                value={hrs}
                step="1"
                onChange={(e) => setHrs(+e.target.value)}
                className="ds-range w-full"
              />
            </div>
            <div>
              <label className="font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground flex justify-between mb-2.5">
                Your detention rate{" "}
                <output className="text-alert font-medium">${rate} / h</output>
              </label>
              <input
                type="range"
                min="25"
                max="150"
                value={rate}
                step="5"
                onChange={(e) => setRate(+e.target.value)}
                className="ds-range w-full"
              />
            </div>
          </div>
          <div className="mt-6 pt-5 border-t border-dashed border-border flex flex-wrap items-baseline gap-3">
            <div className="font-mono text-[clamp(28px,4.5vw,40px)] text-alert tnum">
              ${yearly.toLocaleString("en-US")}
            </div>
            <span className="text-sm text-muted-foreground">
              walking away from you every year — if nobody chases it.
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
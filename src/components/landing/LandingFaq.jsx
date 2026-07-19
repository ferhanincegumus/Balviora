import React from "react";
import { Plus, Minus } from "lucide-react";
import Eyebrow from "@/components/landing/Eyebrow";

const faqs = [
  {
    q: "What if the broker just ignores you too?",
    a: "Some will try. That's why the follow-up runs on a schedule — day 7, 14, 30 — with escalating pressure, ending with a surety bond (BMC-84) angle when it's warranted. Ignoring one email is easy. Ignoring a documented, persistent claim with a bond claim on the horizon is expensive.",
  },
  {
    q: "Will this burn my relationship with the broker?",
    a: "No — because nothing I send is hostile. Every email is professional, documented, and about one thing: paperwork you both agreed to. Brokers actually respect carriers who invoice cleanly. The ones who blacklist you for asking to be paid were never a relationship worth keeping.",
  },
  {
    q: "My rate con doesn't mention detention. Am I out of luck?",
    a: "Not automatically. Send it anyway — there are angles (industry-standard rates, course of dealing, the broker's own posted policies). Worst case, I tell you honestly it's not winnable and you've lost nothing.",
  },
  {
    q: "How do you prove I actually waited?",
    a: "ELD/GPS timestamps, gate photos, BOL time notations, even your phone's location history. Most claims die because the time was never documented — my whole job is making your evidence airtight before the broker sees it.",
  },
  {
    q: "What's your cut?",
    a: 'A flat percentage of recovered money, agreed in writing before I start. No recovery means no fee — and no invoice, no "processing charge," nothing.',
  },
  {
    q: "Is this a lawyer thing? Am I signing something scary?",
    a: "No lawsuits, no court. This is professional collections pressure with airtight paperwork. You sign a simple one-page agreement on the percentage, and your documents stay yours.",
  },
];

export default function LandingFaq() {
  return (
    <section id="faq" className="pt-0 pb-16 sm:pb-24 scroll-mt-24">
      <div className="max-w-5xl mx-auto px-6">
        <Eyebrow>Straight answers</Eyebrow>
        <h2 className="font-display font-extrabold uppercase tracking-[0.01em] text-[clamp(30px,4.5vw,44px)] leading-[1.05]">
          FAQ
        </h2>
        <div className="max-w-[720px] mt-9">
          {faqs.map((f, i) => (
            <details key={i} className="group border-b border-border py-5">
              <summary className="flex justify-between items-center gap-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden font-display font-bold uppercase tracking-[0.02em] text-[19px]">
                <span>{f.q}</span>
                <span className="text-alert shrink-0">
                  <Plus className="w-5 h-5 group-open:hidden" />
                  <Minus className="w-5 h-5 hidden group-open:block" />
                </span>
              </summary>
              <p className="mt-3 text-muted-foreground text-[15px] max-w-[640px]">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
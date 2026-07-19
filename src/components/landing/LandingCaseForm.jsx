import React, { useState } from "react";
import Eyebrow from "@/components/landing/Eyebrow";
import { base44 } from "@/api/base44Client";
import { trackEvent } from "@/lib/landingAnalytics";

const inputCls =
  "w-full bg-background border border-border rounded-lg px-3.5 py-3 text-foreground text-[15px] focus-visible:outline-none focus-visible:border-alert";
const labelCls =
  "block font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground mb-1.5";

// Customer's only entry point. Submissions persist as a CaseLead (founder/admin
// works them in the backend). No account, no tracking page — the customer just
// gets SMS/WhatsApp updates on their phone.
export default function LandingCaseForm() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", broker: "", hours: "", notes: "", website: "" });
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (!f.checkValidity()) {
      f.reportValidity();
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await base44.functions.invoke("submitCase", {
        name: form.name,
        phone: form.phone,
        broker: form.broker,
        hours: form.hours,
        notes: form.notes,
        website: form.website,
      });
      trackEvent("case_submitted", { broker: form.broker, hours: form.hours });
      setSent(true);
    } catch (err) {
      setError(err?.message || "Something went wrong. Try again or text us directly.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="case" className="bg-surface border-t border-border py-16 sm:py-24 scroll-mt-24">
      <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-2 gap-14 items-start">
        <div>
          <Eyebrow>Start here — 5 minutes</Eyebrow>
          <h2 className="font-display font-extrabold uppercase tracking-[0.01em] text-[clamp(30px,4.5vw,44px)] leading-[1.05]">
            Send me your case
          </h2>
          <p className="text-lg text-muted-foreground max-w-[460px] mt-4 mb-5">
            You've already done the hard part: the waiting. Give me the basics and I'll tell you
            within 48 hours if it's winnable — free, no strings.
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            // No app to log into. I'll text you updates on your phone — rate con, broker replies,
            the money. You just drive.
          </p>
        </div>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          {/* Honeypot — hidden from humans; bots fill it and get dropped silently. */}
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={set("website")}
            className="hidden"
            aria-hidden="true"
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls} htmlFor="fName">
                Your name
              </label>
              <input
                id="fName"
                required
                value={form.name}
                onChange={set("name")}
                placeholder="First name is fine"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="fPhone">
                Phone
              </label>
              <input
                id="fPhone"
                type="tel"
                required
                value={form.phone}
                onChange={set("phone")}
                placeholder="(555) 555-5555"
                className={inputCls}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls} htmlFor="fBroker">
                Broker name
              </label>
              <input
                id="fBroker"
                required
                value={form.broker}
                onChange={set("broker")}
                placeholder="Who owes you?"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="fHours">
                Hours you waited
              </label>
              <input
                id="fHours"
                type="number"
                min="1"
                max="72"
                required
                value={form.hours}
                onChange={set("hours")}
                placeholder="e.g. 5"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="fNotes">
              What happened? (optional)
            </label>
            <textarea
              id="fNotes"
              value={form.notes}
              onChange={set("notes")}
              placeholder="Dock held me 5 hrs in Dallas, broker says no detention without gate photos…"
              className={`${inputCls} min-h-[96px] resize-y`}
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 bg-alert text-alert-foreground hover:bg-[#e69500] font-display font-bold uppercase tracking-[0.04em] text-[15px] px-6 py-3 rounded-lg transition-transform hover:-translate-y-px disabled:opacity-60 disabled:translate-y-0"
          >
            {submitting ? "Sending…" : "Send my case — free review"}
          </button>
          {error && <p className="text-sm text-risk">{error}</p>}
          {sent && (
            <div className="border border-money text-money rounded-xl px-4 py-3.5 font-mono text-sm">
              ✓ Case received. I'll text you within 48 hours. Keep the rate con handy.
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
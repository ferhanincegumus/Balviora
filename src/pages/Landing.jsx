import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import LandingNav from "@/components/landing/LandingNav";
import LandingHero from "@/components/landing/LandingHero";
import LandingStats from "@/components/landing/LandingStats";
import LandingHow from "@/components/landing/LandingHow";
import LandingProof from "@/components/landing/LandingProof";
import LandingFounder from "@/components/landing/LandingFounder";
import LandingPricing from "@/components/landing/LandingPricing";
import LandingBrokerCheck from "@/components/landing/LandingBrokerCheck";
import LandingFaq from "@/components/landing/LandingFaq";
import LandingCaseForm from "@/components/landing/LandingCaseForm";
import LandingFooter from "@/components/LandingFooter";
import LandingButton from "@/components/landing/LandingButton";
import { trackEvent } from "@/lib/landingAnalytics";
import { roleOf, roleHome } from "@/lib/roles";

export default function Landing() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    base44.auth
      .isAuthenticated()
      .then(async (a) => {
        setAuthed(a);
        if (a) {
          try {
            const me = await base44.auth.me();
            navigate(roleHome(roleOf(me)), { replace: true });
          } catch {
            navigate("/dashboard", { replace: true });
          }
        }
      })
      .catch(() => setAuthed(false));
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground pb-20 sm:pb-0">
      <LandingNav authed={authed} />
      <main>
        <LandingHero />
        <LandingStats />
        <LandingHow />
        <LandingProof />
        <LandingFounder />
        <LandingPricing />
        <LandingBrokerCheck />
        <LandingFaq />
        <LandingCaseForm />
      </main>
      <LandingFooter />

      {/* Sticky mobile CTA — one tap from "Send my case" */}
      {!authed && (
        <div className="sm:hidden fixed bottom-0 inset-x-0 z-50 bg-background/95 backdrop-blur border-t border-border px-4 py-3">
          <LandingButton
            href="#case"
            onClick={() => trackEvent("cta_clicked", { location: "mobile_bar" })}
            className="w-full"
          >
            Send my case — free
          </LandingButton>
        </div>
      )}
    </div>
  );
}
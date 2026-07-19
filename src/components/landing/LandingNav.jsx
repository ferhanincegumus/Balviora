import React from "react";
import { Link } from "react-router-dom";
import Brand from "@/components/landing/Brand";
import LandingButton from "@/components/landing/LandingButton";
import { trackEvent } from "@/lib/landingAnalytics";

const links = [
  { href: "#how", label: "How it works" },
  { href: "#proof", label: "Recovered" },
  { href: "#pricing", label: "Pricing" },
  { href: "#brokers", label: "Broker check" },
  { href: "#faq", label: "FAQ" },
];

export default function LandingNav({ authed }) {
  return (
    <nav className="sticky top-0 z-50 bg-background/90 backdrop-blur border-b border-border">
      <div className="max-w-5xl mx-auto px-6 h-16 flex items-center">
        <a href="#top" aria-label="Detention Shield home">
          <Brand />
        </a>
        <div className="ml-auto flex items-center gap-5">
          <div className="hidden sm:flex gap-5 text-sm text-muted-foreground">
            {links.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-foreground transition-colors">
                {l.label}
              </a>
            ))}
          </div>
          <Link
            to={authed ? "/dashboard" : "/login"}
            className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {authed ? "Dashboard" : "Login"}
          </Link>
          <LandingButton href="#case" onClick={() => trackEvent("cta_clicked", { location: "nav" })}>
            Send my case
          </LandingButton>
        </div>
      </div>
    </nav>
  );
}
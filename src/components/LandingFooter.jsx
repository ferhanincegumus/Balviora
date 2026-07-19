import React from "react";
import Brand from "@/components/landing/Brand";

export default function LandingFooter() {
  return (
    <footer className="border-t border-border py-9 text-muted-foreground text-[13px]">
      <div className="max-w-5xl mx-auto px-6 flex justify-between gap-4 flex-wrap items-center">
        <a href="#top" aria-label="Detention Shield home">
          <Brand size={20} />
        </a>
        <span>They made you wait. Make them pay.</span>
        <span>© 2026 Detention Shield</span>
      </div>
    </footer>
  );
}
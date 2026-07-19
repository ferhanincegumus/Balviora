import React from "react";

// Detention Shield wordmark — shield (protection) + clock (waiting time),
// "Shield" set in the amber accent. Used in the nav + footer.
export default function Brand({ size = 26 }) {
  return (
    <span className="inline-flex items-center gap-2.5 font-display font-bold uppercase tracking-[0.03em] text-[19px] leading-none">
      <svg width={size} height={size} viewBox="0 0 26 26" fill="none" aria-hidden="true">
        <path d="M13 1 L24 5 V12 C24 19 19.5 23.5 13 25 C6.5 23.5 2 19 2 12 V5 Z" stroke="currentColor" strokeWidth="2" className="text-alert" fill="none" />
        <circle cx="13" cy="12" r="5.5" stroke="currentColor" strokeWidth="1.6" fill="none" className="text-foreground" />
        <path d="M13 8.8 V12 L15.4 13.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="text-alert" />
      </svg>
      Detention<em className="not-italic text-alert">Shield</em>
    </span>
  );
}
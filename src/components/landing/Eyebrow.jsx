import React from "react";

export default function Eyebrow({ children }) {
  return (
    <span className="block font-mono text-xs uppercase tracking-[0.14em] text-alert mb-3.5">
      {children}
    </span>
  );
}
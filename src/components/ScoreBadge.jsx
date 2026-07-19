import React from "react";
import { cn } from "@/lib/utils";
import { scoreTier } from "@/lib/claimScore";

const tierStyles = {
  high: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  low: "bg-red-500/15 text-red-400 border-red-500/30",
};

export default function ScoreBadge({ score, label = true }) {
  const tier = scoreTier(score);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border",
        tierStyles[tier]
      )}
      title="AI-estimated likelihood of full recovery"
    >
      {label && <span className="opacity-70">Success</span>}
      <span className="font-semibold">{score}%</span>
    </span>
  );
}
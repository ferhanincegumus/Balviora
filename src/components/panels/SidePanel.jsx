import React from "react";
import { useSidePanel } from "./SidePanelContext";
import { X, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import ClaimDetailPanel from "./ClaimDetailPanel";
import LoadDetailPanel from "./LoadDetailPanel";
import BrokerDetailPanel from "./BrokerDetailPanel";
import PotentialRecoveryPanel from "./PotentialRecoveryPanel";

// Registry of panel types -> components. Add new panels here.
const PANEL_COMPONENTS = {
  claim: ClaimDetailPanel,
  load: LoadDetailPanel,
  broker: BrokerDetailPanel,
  potentialRecovery: PotentialRecoveryPanel,
};

const PANEL_TITLES = {
  claim: "Claim",
  load: "Load",
  broker: "Broker",
  potentialRecovery: "Recovery",
};

export default function SidePanel() {
  const { panels, closePanel } = useSidePanel();

  if (panels.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => closePanel(panels[0].key)} />
      {panels.map((panel, index) => {
        const Comp = PANEL_COMPONENTS[panel.type];
        const isTop = index === panels.length - 1;
        // Stack: lower panels peek out to the left of the top panel.
        const peekOffset = (panels.length - 1 - index) * 14;

        return (
          <div
            key={panel.key}
            className={cn(
              "absolute top-0 right-0 h-full w-full sm:w-[480px] bg-sidebar border-l border-sidebar-border shadow-2xl flex flex-col",
              isTop ? "transition-transform duration-300 ease-out" : ""
            )}
            style={{ transform: `translateX(-${peekOffset}px)`, zIndex: 10 + index }}
          >
            <div className="h-14 flex items-center justify-between px-4 border-b border-sidebar-border shrink-0 bg-sidebar">
              <div className="flex items-center gap-2 min-w-0">
                {index > 0 && (
                  <button
                    onClick={() => closePanel(panel.key)}
                    className="p-1 -ml-1 text-muted-foreground hover:text-foreground"
                    title="Back"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <span className="text-sm font-medium text-foreground truncate">
                  {panel.title || PANEL_TITLES[panel.type] || panel.type}
                </span>
              </div>
              <button
                onClick={() => closePanel(panel.key)}
                className="p-2 -mr-2 text-muted-foreground hover:text-foreground"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {Comp ? (
                <Comp {...(panel.data || {})} onClose={() => closePanel(panel.key)} />
              ) : (
                <div className="p-6 text-sm text-muted-foreground">Unknown panel type: {panel.type}</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
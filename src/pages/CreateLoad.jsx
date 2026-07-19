import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import LoadForm from "@/components/LoadForm";
import { cn } from "@/lib/utils";
import { Truck, Building2 } from "lucide-react";

// The Add-a-Load page serves two roles via a mode toggle:
//  - "driver": field capture (photo + GPS arrival stamp; office finishes claim)
//  - "office": import-first flow with rate con analyzer verdict + live detention clock
export default function CreateLoad() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("office");

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display font-bold text-2xl tracking-tight">Add a load</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {mode === "driver"
            ? "Driver capture — snap the paperwork, stamp your arrival via GPS. The office finishes the claim."
            : "Paste your rate con — we pull the details and calculate your claim."}
        </p>
      </div>

      <div className="inline-flex rounded-lg border border-border p-1 bg-surface">
        <button
          onClick={() => setMode("driver")}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition",
            mode === "driver" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Truck className="w-4 h-4" /> Driver (field)
        </button>
        <button
          onClick={() => setMode("office")}
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition",
            mode === "office" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Building2 className="w-4 h-4" /> Office
        </button>
      </div>

      <LoadForm mode={mode} onSaved={() => navigate("/claims")} />
    </div>
  );
}
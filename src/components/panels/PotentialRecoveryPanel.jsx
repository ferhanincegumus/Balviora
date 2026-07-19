import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useSidePanel } from "@/components/panels/SidePanelContext";
import { FileText, Eye, Trash2, Loader2, MapPin, Clock, DollarSign, Sparkles } from "lucide-react";

const statusStyles = {
  new: "bg-blue-500/15 text-blue-400",
  reviewed: "bg-amber-500/15 text-amber-400",
  claimed: "bg-emerald-500/15 text-emerald-400",
  ignored: "bg-slate-500/15 text-slate-400",
};
const statusLabels = { new: "New", reviewed: "Reviewed", claimed: "Claimed", ignored: "Ignored" };

export default function PotentialRecoveryPanel({ id, onClose }) {
  const { toast } = useToast();
  const { openPanel } = useSidePanel();
  const [recovery, setRecovery] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    setRecovery(null);
    base44.entities.PotentialRecovery.get(id).then(setRecovery).catch(() => setRecovery(false));
  }, [id]);

  const createClaim = async () => {
    if (!recovery) return;
    setBusy(true);
    try {
      const load = await base44.entities.Load.create({
        broker_name: recovery.broker_name || "Unknown Broker",
        load_number: recovery.load_number || "(from email)",
        pickup_location: recovery.facility || "",
        arrival_time: recovery.arrival_time,
        departure_time: recovery.departure_time,
        free_detention_hours: recovery.free_detention_hours,
        detention_rate_per_hour: recovery.detention_rate_per_hour,
        total_wait_hours: recovery.detected_wait_hours,
        billable_hours: recovery.billable_hours,
        claim_amount: recovery.estimated_amount,
      });
      const claim = await base44.entities.Claim.create({
        load_id: load.id,
        broker_name: recovery.broker_name || "",
        load_number: recovery.load_number || "",
        status: "draft",
        claim_amount: recovery.estimated_amount,
        generated_at: new Date().toISOString(),
      });
      await base44.entities.PotentialRecovery.update(recovery.id, { status: "claimed" });
      setRecovery({ ...recovery, status: "claimed" });
      toast({ title: "Claim created", description: "Opening the new claim…" });
      openPanel("claim", { id: claim.id }, { title: `Claim ${claim.load_number || ""}` });
    } catch (e) {
      toast({ title: "Failed to create claim", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status) => {
    setBusy(true);
    try {
      const updated = await base44.entities.PotentialRecovery.update(recovery.id, { status });
      setRecovery(updated);
    } catch (e) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await base44.entities.PotentialRecovery.delete(recovery.id);
      toast({ title: "Discovery deleted" });
      onClose();
    } catch (e) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (recovery === null) return <div className="p-10 text-center text-muted-foreground">Loading recovery…</div>;
  if (recovery === false) {
    return (
      <div className="p-10 text-center">
        <p className="font-medium">Recovery not found.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={onClose}>Close</Button>
      </div>
    );
  }

  const isClaimed = recovery.status === "claimed";
  const isIgnored = recovery.status === "ignored";

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={"px-2 py-0.5 rounded-full text-xs font-medium " + (statusStyles[recovery.status] || statusStyles.new)}>
                {statusLabels[recovery.status] || recovery.status}
              </span>
              <h2 className="text-lg font-semibold truncate">{recovery.load_number || "Unknown load"}</h2>
            </div>
            <p className="text-xs text-muted-foreground truncate">{recovery.broker_name || "Unknown broker"}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-bold text-emerald-400 leading-none">${(recovery.estimated_amount || 0).toLocaleString()}</p>
            <p className="text-[11px] text-muted-foreground mt-1">est. recovery</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <Card className="p-4 border-l-4 border-l-primary">
          <div className="flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-sm text-muted-foreground">
              AI detected billable detention in an email. Review the details and convert to a formal claim.
            </p>
          </div>
        </Card>

        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Detention Breakdown</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Wait time</p><p className="font-medium">{recovery.detected_wait_hours?.toFixed(1)} hrs</p></div></div>
            <div><p className="text-xs text-muted-foreground">Billable</p><p className="font-medium">{recovery.billable_hours?.toFixed(1)} hrs</p></div>
            <div><p className="text-xs text-muted-foreground">Free time</p><p className="font-medium">{recovery.free_detention_hours} hrs</p></div>
            <div className="flex items-center gap-1.5"><DollarSign className="w-3 h-3 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Rate</p><p className="font-medium">${recovery.detention_rate_per_hour || 0}/hr</p></div></div>
          </div>
        </Card>

        {(recovery.facility || recovery.detention_reason || recovery.email_subject) && (
          <Card className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Source</p>
            <div className="space-y-2 text-sm">
              {recovery.facility && <p className="flex items-start gap-1.5"><MapPin className="w-3 h-3 text-muted-foreground mt-0.5" /> {recovery.facility}</p>}
              {recovery.detention_reason && <p className="text-muted-foreground">{recovery.detention_reason}</p>}
              {recovery.email_subject && (
                <div>
                  <p className="text-xs text-muted-foreground">Email subject</p>
                  <p className="font-medium text-xs">{recovery.email_subject}</p>
                </div>
              )}
            </div>
          </Card>
        )}

        <div className="flex flex-wrap gap-2">
          {!isClaimed && !isIgnored && (
            <Button onClick={createClaim} disabled={busy} size="sm">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 mr-1.5" />}
              {busy ? "Working…" : "Create Claim"}
            </Button>
          )}
          {recovery.status === "new" && (
            <Button variant="outline" size="sm" onClick={() => setStatus("reviewed")} disabled={busy}>
              <Eye className="w-4 h-4 mr-1.5" /> Mark reviewed
            </Button>
          )}
          {!isIgnored && !isClaimed && (
            <Button variant="outline" size="sm" onClick={() => setStatus("ignored")} disabled={busy}>Ignore</Button>
          )}
          <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-400 ml-auto" onClick={remove} disabled={busy}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
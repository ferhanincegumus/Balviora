import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles, Search, Trash2, FileText, Eye, DollarSign, Mail, Inbox, Loader2,
} from "lucide-react";
import { differenceInCalendarDays } from "date-fns";
import { useSidePanel } from "@/components/panels/SidePanelContext";
import BrokerReplyTriage from "@/components/BrokerReplyTriage";

const statusStyles = {
  new: "bg-blue-500/15 text-blue-400",
  reviewed: "bg-amber-500/15 text-amber-400",
  claimed: "bg-emerald-500/15 text-emerald-400",
  ignored: "bg-slate-500/15 text-slate-400",
};
const statusLabels = { new: "New", reviewed: "Reviewed", claimed: "Claimed", ignored: "Ignored" };

const filters = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "reviewed", label: "Reviewed" },
  { key: "claimed", label: "Claimed" },
  { key: "ignored", label: "Ignored" },
];

export default function RecoveryInbox() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { openPanel } = useSidePanel();
  const [recoveries, setRecoveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [scanning, setScanning] = useState(false);
  const [actingId, setActingId] = useState(null);
  const [filter, setFilter] = useState("all");

  const fetchRecoveries = useCallback(async () => {
    try {
      const data = await base44.entities.PotentialRecovery.list("-detected_at", 100);
      setRecoveries(data);
    } catch (e) {
      toast({ title: "Failed to load recoveries", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRecoveries();
  }, [fetchRecoveries]);

  const handleScan = async () => {
    if (!body.trim()) {
      toast({ title: "Paste an email body first" });
      return;
    }
    setScanning(true);
    try {
      const res = await base44.functions.invoke("scanEmailForDetention", { subject, body, source: "manual" });
      const d = res.data ?? res;
      if (d.found) {
        toast({
          title: "Detention detected!",
          description: `$${d.record.estimated_amount} potential recovery for load ${d.record.load_number || "(unknown)"}`,
        });
        setSubject("");
        setBody("");
        await fetchRecoveries();
      } else {
        toast({ title: "No detention found", description: d.reason || "This email didn't contain billable detention." });
      }
    } catch (e) {
      toast({ title: "Scan failed", description: e.message, variant: "destructive" });
    } finally {
      setScanning(false);
    }
  };

  const createClaim = async (r) => {
    setActingId(r.id);
    try {
      const load = await base44.entities.Load.create({
        broker_name: r.broker_name || "Unknown Broker",
        load_number: r.load_number || "(from email)",
        pickup_location: r.facility || "",
        arrival_time: r.arrival_time,
        departure_time: r.departure_time,
        free_detention_hours: r.free_detention_hours,
        detention_rate_per_hour: r.detention_rate_per_hour,
        total_wait_hours: r.detected_wait_hours,
        billable_hours: r.billable_hours,
        claim_amount: r.estimated_amount,
      });
      const claim = await base44.entities.Claim.create({
        load_id: load.id,
        broker_name: r.broker_name || "",
        load_number: r.load_number || "",
        status: "draft",
        claim_amount: r.estimated_amount,
        generated_at: new Date().toISOString(),
      });
      await base44.entities.PotentialRecovery.update(r.id, { status: "claimed" });
      toast({
        title: "Claim created",
        description: `Opening the claim to generate the AI email…`,
      });
      await fetchRecoveries();
      navigate(`/claims/${claim.id}`);
    } catch (e) {
      toast({ title: "Failed to create claim", description: e.message, variant: "destructive" });
    } finally {
      setActingId(null);
    }
  };

  const setStatus = async (r, status) => {
    setActingId(r.id);
    try {
      await base44.entities.PotentialRecovery.update(r.id, { status });
      await fetchRecoveries();
    } catch (e) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    } finally {
      setActingId(null);
    }
  };

  const remove = async (r) => {
    setActingId(r.id);
    try {
      await base44.entities.PotentialRecovery.delete(r.id);
      await fetchRecoveries();
    } catch (e) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    } finally {
      setActingId(null);
    }
  };

  const filtered = recoveries.filter((r) => filter === "all" || r.status === filter);
  const potential = recoveries
    .filter((r) => r.status !== "ignored")
    .reduce((s, r) => s + Number(r.estimated_amount || 0), 0);
  const newCount = recoveries.filter((r) => r.status === "new").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Inbox className="w-6 h-6 text-primary" /> Potential Recovery Inbox
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Paste load confirmation or appointment emails — AI finds hidden detention money.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
            <DollarSign className="w-4 h-4" /> Potential Recovery
          </div>
          <p className="text-3xl font-bold mt-1 text-emerald-400">${potential.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground mt-1">{recoveries.length} discoveries</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
            <Mail className="w-4 h-4" /> New Discoveries
          </div>
          <p className="text-3xl font-bold mt-1 text-blue-400">{newCount}</p>
          <p className="text-xs text-muted-foreground mt-1">awaiting your review</p>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider">
            <Sparkles className="w-4 h-4" /> AI Engine
          </div>
          <p className="text-3xl font-bold mt-1 text-primary">Active</p>
          <p className="text-xs text-muted-foreground mt-1">scans every pasted email</p>
        </Card>
      </div>

      <BrokerReplyTriage />

      <Card className="p-5 border-primary/30">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="font-semibold">Scan an email for detention</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Paste a load confirmation, appointment, or broker email. AI extracts arrival/departure times and
          calculates billable detention automatically.
        </p>
        <div className="space-y-3">
          <Input
            placeholder="Email subject (e.g. Load Confirmation - Coyote #8821)"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <Textarea
            placeholder="Paste the full email body here..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
          />
          <Button onClick={handleScan} disabled={scanning}>
            {scanning ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Analyzing...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" /> Scan for detention
              </>
            )}
          </Button>
        </div>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-lg font-semibold">Discovered recoveries</h2>
          <div className="flex gap-1 flex-wrap">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors " +
                  (filter === f.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground")
                }
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            <Inbox className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">No recoveries here yet.</p>
            <p className="text-sm mt-1">Paste an email above to let AI find lost detention revenue.</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => {
              const days = r.detected_at ? differenceInCalendarDays(new Date(), new Date(r.detected_at)) : 0;
              return (
                <Card key={r.id} className="p-4 hover:border-primary/50 transition-colors">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <button
                      onClick={() => openPanel("potentialRecovery", { id: r.id }, { title: r.load_number || "Recovery" })}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={"px-2 py-0.5 rounded-full text-xs font-medium " + (statusStyles[r.status] || statusStyles.new)}>
                          {statusLabels[r.status] || r.status}
                        </span>
                        <span className="font-semibold">{r.load_number || "Unknown load"}</span>
                        <span className="text-sm text-muted-foreground">· {r.broker_name || "Unknown broker"}</span>
                        <span className="text-xs text-muted-foreground">{days}d ago</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Wait</p>
                          <p className="font-medium">{r.detected_wait_hours?.toFixed(1)}h</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Billable</p>
                          <p className="font-medium">{r.billable_hours?.toFixed(1)}h</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Free time</p>
                          <p className="font-medium">{r.free_detention_hours}h</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Est. recovery</p>
                          <p className="font-bold text-emerald-400">${(r.estimated_amount || 0).toLocaleString()}</p>
                        </div>
                      </div>
                      {r.facility && (
                        <p className="text-xs text-muted-foreground mt-2 truncate">📍 {r.facility}</p>
                      )}
                    </button>
                    <div className="flex items-center gap-2 flex-wrap">
                      {r.status !== "claimed" && r.status !== "ignored" && (
                        <Button size="sm" onClick={() => createClaim(r)} disabled={actingId === r.id}>
                          {actingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                          Create Claim
                        </Button>
                      )}
                      {r.status === "new" && (
                        <Button size="sm" variant="outline" onClick={() => setStatus(r, "reviewed")} disabled={actingId === r.id}>
                          <Eye className="w-4 h-4" /> Review
                        </Button>
                      )}
                      {r.status !== "ignored" && r.status !== "claimed" && (
                        <Button size="sm" variant="ghost" onClick={() => setStatus(r, "ignored")} disabled={actingId === r.id}>
                          Ignore
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => remove(r)} disabled={actingId === r.id}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Card className="p-4 bg-muted/30">
        <p className="text-sm text-muted-foreground">
          💡 Want automatic scanning? Once you register Gmail/Outlook connectors, this inbox will scan your
          inbox automatically. For now, paste any load confirmation email and AI does the rest.{" "}
          <Link to="/claims" className="text-primary hover:underline">View your claims →</Link>
        </p>
      </Card>
    </div>
  );
}
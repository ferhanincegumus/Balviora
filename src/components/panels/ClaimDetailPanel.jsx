import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import StatusBadge from "@/components/StatusBadge";
import ScoreBadge from "@/components/ScoreBadge";
import EvidenceManager from "@/components/EvidenceManager";
import ClaimDefense from "@/components/ClaimDefense";
import NegotiationPanel from "@/components/NegotiationPanel";
import NegotiationLoop from "@/components/NegotiationLoop";
import { computeScore } from "@/lib/claimScore";
import { analyzeClaim } from "@/lib/claimAssistant";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useSidePanel } from "@/components/panels/SidePanelContext";
import {
  Send, CheckCircle, XCircle, Brain, ExternalLink, FileText, Shield, MessagesSquare,
  MapPin, Clock, Sparkles, Building2,
} from "lucide-react";

const TABS = [
  { key: "overview", label: "Overview", icon: FileText },
  { key: "evidence", label: "Evidence", icon: Shield },
  { key: "defense", label: "Defense", icon: Brain },
  { key: "negotiate", label: "Negotiate", icon: MessagesSquare },
];

const ACTIONABLE_STATUSES = ["ready_to_send", "followup_required", "sent", "awaiting_response"];

export default function ClaimDetailPanel({ id, onClose }) {
  const { toast } = useToast();
  const { openPanel } = useSidePanel();
  const [claim, setClaim] = useState(null);
  const [load, setLoad] = useState(null);
  const [carrier, setCarrier] = useState(null);
  const [tab, setTab] = useState("overview");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!id) return;
    setClaim(null);
    base44.entities.Claim.get(id)
      .then(async (c) => {
        if (!c) { setClaim(false); return; }
        setClaim(c);
        if (c.load_id) {
          try { setLoad(await base44.entities.Load.get(c.load_id)); } catch (_) {}
        }
        try {
          const profiles = await base44.entities.CarrierProfile.list();
          if (profiles.length > 0) setCarrier(profiles[0]);
        } catch (_) {}
      })
      .catch(() => setClaim(false));
  }, [id]);

  const updateStatus = async (status) => {
    try {
      const updated = await base44.entities.Claim.update(claim.id, { status });
      setClaim(updated);
      toast({ title: "Status updated", description: `Marked as ${status.replace(/_/g, " ")}.` });
    } catch {
      toast({ title: "Error", description: "Could not update status.", variant: "destructive" });
    }
  };

  const sendToBroker = async () => {
    setSending(true);
    try {
      try { await base44.functions.invoke("sendClaimEmail", { claimId: claim.id }); } catch (_) {}
      const updated = await base44.entities.Claim.update(claim.id, {
        status: "sent",
        sent_date: new Date().toISOString(),
        next_followup_date: new Date(Date.now() + 3 * 86400000).toISOString(),
      });
      setClaim(updated);
      toast({ title: "Email sent to broker", description: "Claim marked as sent. AI follow-ups scheduled." });
    } catch {
      toast({ title: "Error", description: "Could not send.", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (claim === null) {
    return <div className="p-10 text-center text-muted-foreground">Loading claim…</div>;
  }
  if (claim === false) {
    return (
      <div className="p-10 text-center">
        <p className="font-medium">Claim not found.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={onClose}>Close</Button>
      </div>
    );
  }

  const score = computeScore(claim, load);
  const analysis = analyzeClaim(claim, load);
  const actionable = ACTIONABLE_STATUSES.includes(claim.status);

  return (
    <div className="flex flex-col h-full">
      {/* Header summary */}
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-semibold truncate">Claim {claim.load_number || ""}</h2>
              <StatusBadge status={claim.status} />
            </div>
            <p className="text-xs text-muted-foreground truncate">{claim.broker_name || "—"}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-bold text-primary leading-none">${(claim.claim_amount || 0).toLocaleString()}</p>
            <div className="mt-1.5 flex justify-end"><ScoreBadge score={score} label={false} /></div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <Link to={`/claims/${claim.id}`} onClick={onClose} className="flex-1">
            <Button variant="outline" size="sm" className="w-full">
              <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open full page
            </Button>
          </Link>
          {actionable && claim.email_body && (
            <Button size="sm" onClick={sendToBroker} disabled={sending}>
              <Send className="w-3.5 h-3.5 mr-1.5" /> {sending ? "Sending…" : "Send"}
            </Button>
          )}
          {claim.broker_name && (
            <Button size="sm" variant="outline" onClick={() => openPanel("broker", { brokerName: claim.broker_name }, { title: claim.broker_name })}>
              <Building2 className="w-3.5 h-3.5 mr-1.5" /> Broker
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-card shrink-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors",
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {tab === "overview" && (
          <>
            {analysis && (
              <Card className="p-4 border-l-4 border-l-primary">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                    <Brain className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">AI Assistant</p>
                    <p className="text-sm text-foreground mb-2">{analysis.message}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <ScoreBadge score={analysis.score} />
                      <span className="text-xs text-muted-foreground">→</span>
                      <span className="text-xs font-medium text-primary">{analysis.nextAction}</span>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {load && (
              <Card className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Load Details</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Load #</p><p className="font-medium truncate">{load.load_number || "—"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Broker</p><p className="font-medium truncate">{load.broker_name || "—"}</p></div>
                  <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Pickup</p><p className="font-medium truncate">{load.pickup_location || "—"}</p></div></div>
                  <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Delivery</p><p className="font-medium truncate">{load.delivery_location || "—"}</p></div></div>
                  <div className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Wait</p><p className="font-medium">{Number(load.total_wait_hours || 0).toFixed(1)} hrs</p></div></div>
                  <div><p className="text-xs text-muted-foreground">Billable</p><p className="font-medium">{Number(load.billable_hours || 0).toFixed(1)} hrs</p></div>
                </div>
              </Card>
            )}

            {claim.email_body && (
              <Card className="p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Claim Email</p>
                <p className="text-sm font-medium p-2 rounded-md bg-muted/50 border border-border mb-2">{claim.email_subject}</p>
                <pre className="font-body whitespace-pre-wrap text-xs p-3 rounded-md bg-muted/30 border border-border leading-relaxed max-h-48 overflow-auto">{claim.email_body}</pre>
                <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Use the full page to regenerate or export PDF.
                </p>
              </Card>
            )}

            <Card className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Quick Status</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => updateStatus("approved")} className="text-emerald-400 hover:text-emerald-400">
                  <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Approved
                </Button>
                <Button size="sm" variant="outline" onClick={() => updateStatus("denied")} className="text-red-400 hover:text-red-400">
                  <XCircle className="w-3.5 h-3.5 mr-1.5" /> Denied
                </Button>
                <Button size="sm" variant="outline" onClick={() => updateStatus("paid")}>
                  <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Paid
                </Button>
              </div>
            </Card>
          </>
        )}

        {tab === "evidence" && <EvidenceManager claimId={claim.id} />}

        {tab === "defense" && <ClaimDefense claim={claim} load={load} carrier={carrier} />}

        {tab === "negotiate" && (
          <>
            <NegotiationPanel claim={claim} load={load} carrier={carrier} onClaimUpdate={setClaim} />
            <NegotiationLoop claim={claim} onClaimUpdate={setClaim} />
          </>
        )}
      </div>
    </div>
  );
}
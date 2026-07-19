import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { computeBrokerMetrics, BEHAVIOR_META } from "@/lib/brokerAnalytics";
import { Layers, Loader2, Send, Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";

// Recommended batch strategy per broker behavior.
function strategyForBehavior(metrics) {
  const deniedRatio = metrics.claimCount ? (metrics.statusCounts.denied || 0) / metrics.claimCount : 0;
  const partialRatio = metrics.claimCount ? ((metrics.statusCounts.partially_approved || 0) + metrics.brokerOfferCount) / metrics.claimCount : 0;
  if (deniedRatio >= 0.4) {
    return {
      key: "discount",
      label: "Offer 15% settlement on all open claims",
      reason: `${Math.round(deniedRatio * 100)}% of this broker's claims get denied — a 15% concession across the portfolio often unlocks faster cash.`,
      counterPct: 0.85,
    };
  }
  if (partialRatio >= 0.3) {
    return {
      key: "counter",
      label: "Counter all at 90% to close quickly",
      reason: "This broker usually negotiates — a small 10% concession across all open claims can settle the portfolio.",
      counterPct: 0.9,
    };
  }
  return {
    key: "hold",
    label: "Hold firm at full amount",
    reason: "This broker generally pays — no need to discount. Send a batch status nudge instead.",
    counterPct: 1,
  };
}

export default function PortfolioNegotiation({ claims = [], onComplete }) {
  const { toast } = useToast();
  const [selectedBroker, setSelectedBroker] = useState("");
  const [running, setRunning] = useState(false);
  const [drafts, setDrafts] = useState(null);

  const brokerMetrics = useMemo(() => computeBrokerMetrics(claims), [claims]);

  // Brokers with open claims worth batching.
  const batchableBrokers = useMemo(() => {
    const OPEN = ["sent", "awaiting_response", "followup_required"];
    return brokerMetrics.filter((b) =>
      b.claims.some((c) => OPEN.includes(c.status))
    );
  }, [brokerMetrics]);

  const selected = brokerMetrics.find((b) => b.broker_name === selectedBroker) || null;
  const strategy = selected ? strategyForBehavior(selected) : null;

  const OPEN = ["sent", "awaiting_response", "followup_required"];
  const openClaims = selected ? selected.claims.filter((c) => OPEN.includes(c.status)) : [];
  const portfolioValue = openClaims.reduce((s, c) => s + (c.claim_amount || 0), 0);
  const offerValue = strategy ? Math.round(portfolioValue * strategy.counterPct) : 0;

  const generateBatch = async () => {
    if (!selected || openClaims.length === 0) return;
    setRunning(true);
    setDrafts(null);
    try {
      const made = [];
      for (const c of openClaims) {
        const counterAmount = Math.round((c.claim_amount || 0) * strategy.counterPct);
        const prompt =
          'You are a freight carrier doing a PORTFOLIO settlement offer to a broker for ALL of your open detention claims with them at once.\n\n' +
          `Broker: ${c.broker_name}\n` +
          `Load #: ${c.load_number || 'N/A'}\n` +
          `Original claim: $${c.claim_amount || 0}\n` +
          `Proposed settlement (this claim): $${counterAmount}\n` +
          `Strategy: ${strategy.label}\n` +
          `Reason: ${strategy.reason}\n\n` +
          'Write a professional email proposing to settle this load\'s detention claim at the proposed amount as part of a batch settlement across all open claims with this broker. ' +
          'Reference the load number. Be firm but collaborative. Sign as the carrier (use "[Carrier Name]").\n\n' +
          'Return JSON with "subject" and "body" fields. Body is plain text with line breaks.';
        const ai = await base44.integrations.Core.InvokeLLM({
          prompt,
          response_json_schema: {
            type: 'object',
            properties: { subject: { type: 'string' }, body: { type: 'string' } },
          },
        });
        made.push({ claim: c, counterAmount, subject: ai.subject, body: ai.body });
      }
      setDrafts(made);
      toast({ title: 'Batch offers drafted', description: `${made.length} counter-offer email(s) ready to review & send.` });
    } catch {
      toast({ title: 'Batch generation failed', description: 'Could not draft the portfolio offers.', variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  const sendAll = async () => {
    if (!drafts) return;
    setRunning(true);
    let ok = 0, fail = 0;
    for (const d of drafts) {
      try {
        await base44.entities.Claim.update(d.claim.id, {
          email_subject: d.subject,
          email_body: d.body,
          broker_offer_amount: d.counterAmount,
          last_followup_date: new Date().toISOString(),
          next_followup_date: new Date(Date.now() + 4 * 86400000).toISOString(),
          status: 'sent',
          sent_date: new Date().toISOString(),
        });
        try { await base44.functions.invoke('sendClaimEmail', { claimId: d.claim.id }); } catch (_) {}
        ok++;
      } catch { fail++; }
    }
    setRunning(false);
    setDrafts(null);
    toast({
      title: fail === 0 ? 'Portfolio settlement sent' : 'Batch sent with errors',
      description: `${ok} offer(s) sent${fail ? `, ${fail} failed` : ''}.`,
      variant: fail === 0 ? 'default' : 'destructive',
    });
    if (onComplete) onComplete();
  };

  if (batchableBrokers.length === 0) return null;

  return (
    <Card className="p-6 border-l-4 border-l-amber-500">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center">
          <Layers className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Portfolio Negotiation</h2>
          <p className="text-base font-medium text-foreground">Batch-settle all open claims with one broker in a single move</p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-5">
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 block">Select broker</label>
          <Select value={selectedBroker} onValueChange={(v) => { setSelectedBroker(v); setDrafts(null); }}>
            <SelectTrigger><SelectValue placeholder="Choose a broker…" /></SelectTrigger>
            <SelectContent>
              {batchableBrokers.map((b) => (
                <SelectItem key={b.broker_name} value={b.broker_name}>
                  {b.broker_name} · {b.claims.filter((c) => OPEN.includes(c.status)).length} open
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selected && (
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">Behavior</p>
            <p className={`text-sm font-medium inline-flex items-center gap-1.5 ${BEHAVIOR_META[selected.behavior].className} px-2 py-0.5 rounded-full mt-1`}>
              {BEHAVIOR_META[selected.behavior].label}
            </p>
          </div>
        )}
      </div>

      {selected && strategy && (
        <>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 mb-4">
            <p className="text-sm font-medium text-amber-200 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" /> {strategy.label}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{strategy.reason}</p>
            <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border">
              <div>
                <p className="text-xs text-muted-foreground">Open claims</p>
                <p className="text-lg font-bold">{openClaims.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Portfolio value → offer</p>
                <p className="text-lg font-bold text-primary">${portfolioValue.toLocaleString()} → ${offerValue.toLocaleString()}</p>
              </div>
            </div>
          </div>

          {!drafts ? (
            <Button onClick={generateBatch} disabled={running}>
              {running ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Drafting {openClaims.length} offers…</> : <><Sparkles className="w-4 h-4 mr-1.5" /> Generate batch offers</>}
            </Button>
          ) : (
            <div className="space-y-3">
              {drafts.map((d) => (
                <div key={d.claim.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{d.claim.load_number || '—'}</span>
                    <span className="text-sm text-muted-foreground">${(d.claim.claim_amount || 0).toLocaleString()} → <span className="text-primary font-medium">${d.counterAmount.toLocaleString()}</span></span>
                  </div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{d.subject}</p>
                  <pre className="font-body whitespace-pre-wrap text-xs p-3 rounded-md bg-muted/40 border border-border max-h-32 overflow-auto">{d.body}</pre>
                </div>
              ))}
              <div className="flex items-center gap-3">
                <Button onClick={sendAll} disabled={running}>
                  {running ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Sending…</> : <><Send className="w-4 h-4 mr-1.5" /> Send all {drafts.length} offers</>}
                </Button>
                <Button variant="outline" onClick={() => setDrafts(null)} disabled={running}>
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> Redo
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
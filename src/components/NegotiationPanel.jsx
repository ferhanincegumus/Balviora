import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { buildStrategy, buildNegotiationPrompt, SCENARIO_LABELS } from "@/lib/brokerNegotiation";
import { Handshake, Sparkles, Copy, Check, Target, ShieldCheck, ListChecks, MessageSquareQuote } from "lucide-react";

const SCENARIO_STYLES = {
  denial_appeal: "bg-red-500/15 text-red-400",
  lowball_counter: "bg-orange-500/15 text-orange-400",
  partial_counter: "bg-amber-500/15 text-amber-400",
  documentation: "bg-blue-500/15 text-blue-400",
  no_response_escalation: "bg-purple-500/15 text-purple-400",
  standard_followup: "bg-muted text-muted-foreground",
};

export default function NegotiationPanel({ claim, load, carrier, onClaimUpdate }) {
  const { toast } = useToast();
  const [brokerResponse, setBrokerResponse] = useState(claim.broker_response || "");
  const [brokerOffer, setBrokerOffer] = useState(
    claim.broker_offer_amount != null ? String(claim.broker_offer_amount) : ""
  );
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [reply, setReply] = useState(null);
  const [copied, setCopied] = useState(false);

  // Negotiation only applies once the claim has been sent to the broker.
  const activeStatuses = ["sent", "awaiting_response", "followup_required", "partially_approved", "denied"];
  if (!activeStatuses.includes(claim.status)) return null;

  const workingClaim = {
    ...claim,
    broker_response: brokerResponse,
    broker_offer_amount: brokerOffer ? Number(brokerOffer) : 0,
  };
  const strategy = buildStrategy(workingClaim, load);

  const saveBrokerResponse = async () => {
    setSaving(true);
    try {
      const updated = await base44.entities.Claim.update(claim.id, {
        broker_response: brokerResponse,
        broker_offer_amount: brokerOffer ? Number(brokerOffer) : null,
        response_date: claim.response_date || new Date().toISOString(),
      });
      onClaimUpdate(updated);
      toast({ title: "Broker response saved", description: "Negotiation strategy updated." });
    } catch {
      toast({ title: "Error", description: "Could not save broker response.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const generateReply = async () => {
    if (!load) return;
    setGenerating(true);
    try {
      const prompt = buildNegotiationPrompt(workingClaim, load, carrier, strategy);
      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: { subject: { type: "string" }, body: { type: "string" } },
        },
      });
      setReply({ subject: res.subject, body: res.body });
      toast({ title: "Negotiation reply generated", description: "Review and copy to send to your broker." });
    } catch {
      toast({ title: "Error", description: "Could not generate the reply.", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const copyReply = () => {
    navigator.clipboard.writeText(`Subject: ${reply.subject}\n\n${reply.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="p-6 border-l-4 border-l-primary">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
          <Handshake className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">AI Broker Negotiation</h2>
          <p className="text-base font-medium text-foreground">Record the broker's response and let AI craft the optimal reply</p>
        </div>
      </div>

      {/* Broker response input */}
      <div className="space-y-3 mb-5">
        <div>
          <Label className="text-xs mb-1.5">Broker's response (paste their email or notes)</Label>
          <Textarea
            value={brokerResponse}
            onChange={(e) => setBrokerResponse(e.target.value)}
            placeholder="Paste the broker's reply here — e.g. 'We can only offer $150 as a courtesy' or 'We need the BOL and timestamp logs to process this.'"
            rows={3}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1">
            <Label className="text-xs mb-1.5">Broker's counter-offer amount (optional)</Label>
            <Input
              type="number"
              value={brokerOffer}
              onChange={(e) => setBrokerOffer(e.target.value)}
              placeholder="e.g. 150"
            />
          </div>
          <Button onClick={saveBrokerResponse} disabled={saving} variant="outline">
            {saving ? "Saving…" : "Save & Update Strategy"}
          </Button>
        </div>
      </div>

      {/* Strategy display */}
      <div className="rounded-lg border border-border bg-muted/30 p-4 mb-5 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Negotiation Strategy</span>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${SCENARIO_STYLES[strategy.scenario]}`}>
            {SCENARIO_LABELS[strategy.scenario]}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary shrink-0" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Target</p>
              <p className="text-sm font-semibold text-primary">${strategy.target.toLocaleString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Min. acceptable</p>
              <p className="text-sm font-semibold text-emerald-400">${strategy.minAcceptable.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {strategy.leverage.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
              <ListChecks className="w-3 h-3" /> Leverage points
            </p>
            <ul className="space-y-1">
              {strategy.leverage.map((l, i) => (
                <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                  <Check className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" /> {l}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Recommended</span>
            <span className="text-xs font-medium text-foreground">{strategy.recommendedAction}</span>
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Tone</span>
            <span className="text-xs text-muted-foreground">{strategy.tone}</span>
          </div>
        </div>
      </div>

      {/* Generate / display reply */}
      {!reply ? (
        <div className="text-center py-4">
          <Button onClick={generateReply} disabled={generating || !load}>
            <MessageSquareQuote className="w-4 h-4 mr-1.5" /> {generating ? "Generating reply…" : "Generate AI negotiation reply"}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Negotiation Reply</p>
            <Button variant="outline" size="sm" onClick={copyReply}>
              {copied ? <><Check className="w-4 h-4 mr-1.5" /> Copied</> : <><Copy className="w-4 h-4 mr-1.5" /> Copy</>}
            </Button>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Subject</p>
            <p className="font-medium p-3 rounded-lg bg-muted/50 border border-border">{reply.subject}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Body</p>
            <pre className="font-body whitespace-pre-wrap text-sm p-4 rounded-lg bg-muted/50 border border-border leading-relaxed">{reply.body}</pre>
          </div>
          <Button onClick={generateReply} variant="outline" size="sm" disabled={generating}>
            <Sparkles className="w-4 h-4 mr-1.5" /> Regenerate reply
          </Button>
        </div>
      )}
    </Card>
  );
}
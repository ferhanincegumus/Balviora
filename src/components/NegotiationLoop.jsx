import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Repeat, Sparkles, Loader2, Send, Copy, Check, AlertCircle, TrendingUp } from "lucide-react";

export default function NegotiationLoop({ claim, onClaimUpdate }) {
  const { toast } = useToast();
  const [running, setRunning] = useState(false);
  const [autoSend, setAutoSend] = useState(!!claim.auto_negotiate);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  // Loop only applies once a broker response exists and the claim is active.
  const activeStatuses = ["sent", "awaiting_response", "followup_required", "partially_approved", "denied"];
  if (!activeStatuses.includes(claim.status)) return null;
  if (!claim.broker_response || !String(claim.broker_response).trim()) return null;

  const runLoop = async () => {
    setRunning(true);
    try {
      const res = await base44.functions.invoke("runNegotiationLoop", {
        claim_id: claim.id,
        auto_send: autoSend,
      });
      const loop = res?.data?.loop;
      const updatedClaim = res?.data?.claim;
      setResult(loop);
      if (updatedClaim) onClaimUpdate(updatedClaim);
      toast({
        title: autoSend ? "Negotiation loop ran & sent" : "Negotiation loop complete",
        description: loop?.sent
          ? `Round ${loop.round}: AI counter sent to broker.`
          : `Round ${loop.round}: AI counter generated. Review and send manually.`,
      });
    } catch (e) {
      toast({
        title: "Loop failed",
        description: e?.response?.data?.error || "Could not run the negotiation loop.",
        variant: "destructive",
      });
    } finally {
      setRunning(false);
    }
  };

  const persistAuto = async (val) => {
    setAutoSend(val);
    try {
      const updated = await base44.entities.Claim.update(claim.id, { auto_negotiate: val });
      onClaimUpdate(updated);
    } catch {}
  };

  const copyReply = () => {
    if (!result) return;
    navigator.clipboard.writeText(`Subject: ${result.reply_subject}\n\n${result.reply_body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="p-6 border-l-4 border-l-violet-500">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-violet-500/15 flex items-center justify-center">
          <Repeat className="w-5 h-5 text-violet-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">AI Negotiation Loop</h2>
          <p className="text-base font-medium text-foreground">
            Auto-analyze the broker's reply & generate a counter-argument {claim.negotiation_rounds ? `· Round ${claim.negotiation_rounds}` : ""}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3 mb-4">
        <div>
          <Label htmlFor="auto-send" className="text-sm font-medium cursor-pointer">Auto-send the counter to broker</Label>
          <p className="text-xs text-muted-foreground mt-0.5">When on, the AI counter email is sent automatically each round. Keep off to review first.</p>
        </div>
        <Switch id="auto-send" checked={autoSend} onCheckedChange={persistAuto} disabled={running} />
      </div>

      {result && (
        <div className="space-y-3 mb-4">
          <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 font-medium uppercase tracking-wide">
                {result.intent || "analyzed"}
              </span>
              <span className="text-muted-foreground">Round {result.round}</span>
              {result.recommended_counter_amount != null && (
                <span className="text-foreground">Counter: <span className="font-semibold text-primary">${result.recommended_counter_amount.toLocaleString()}</span></span>
              )}
              {result.should_accept && (
                <span className="inline-flex items-center gap-1 text-emerald-400 font-medium"><TrendingUp className="w-3.5 h-3.5" /> Accept recommended</span>
              )}
            </div>
            <p className="text-sm text-foreground">{result.analysis}</p>
            <p className="text-xs text-muted-foreground pt-1 border-t border-border">
              <span className="text-foreground font-medium">Next action:</span> {result.next_action}
            </p>
          </div>

          {result.reply_body && !result.sent && (
            <>
              <div>
                <p className="text-xs text-muted-foreground mb-1">AI counter reply</p>
                <p className="font-medium p-3 rounded-lg bg-muted/50 border border-border text-sm">{result.reply_subject}</p>
              </div>
              <pre className="font-body whitespace-pre-wrap text-sm p-4 rounded-lg bg-muted/50 border border-border leading-relaxed max-h-72 overflow-auto">{result.reply_body}</pre>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={copyReply}>
                  {copied ? <><Check className="w-4 h-4 mr-1.5" /> Copied</> : <><Copy className="w-4 h-4 mr-1.5" /> Copy reply</>}
                </Button>
              </div>
            </>
          )}
          {result.sent && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-emerald-300">
              <Send className="w-4 h-4" /> Counter email sent to broker automatically.
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={runLoop} disabled={running}>
          {running ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Running loop…</> : <><Sparkles className="w-4 h-4 mr-1.5" /> {result ? "Run next loop round" : "Run AI negotiation loop"}</>}
        </Button>
        {claim.auto_negotiate && (
          <span className="inline-flex items-center gap-1 text-xs text-violet-300">
            <AlertCircle className="w-3.5 h-3.5" /> Auto-loop enabled
          </span>
        )}
      </div>
    </Card>
  );
}
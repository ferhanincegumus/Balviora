import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Shield, Loader2, Copy, Check, AlertTriangle, CheckCircle, XCircle, Lightbulb, Mail, Swords,
} from "lucide-react";

const strengthColor = {
  "Very Strong": "text-emerald-400",
  Strong: "text-emerald-400",
  Moderate: "text-amber-400",
  Weak: "text-orange-400",
  "Very Weak": "text-red-400",
};
const barColor = {
  "Very Strong": "bg-emerald-500",
  Strong: "bg-emerald-500",
  Moderate: "bg-amber-500",
  Weak: "bg-orange-500",
  "Very Weak": "bg-red-500",
};

export default function ClaimDefense({ claim, load, carrier }) {
  const { toast } = useToast();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showStrengthen, setShowStrengthen] = useState(false);
  const [showResponse, setShowResponse] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const existing = await base44.entities.ClaimDefenseReport.filter({ claim_id: claim.id });
        if (active && existing && existing.length > 0) setReport(existing[0]);
      } catch (_) { /* none yet */ }
    })();
    return () => { active = false; };
  }, [claim.id]);

  const prepare = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("prepareClaimDefense", { claim_id: claim.id });
      const d = res.data ?? res;
      if (d.report) {
        setReport(d.report);
        setShowResponse(false);
        setShowStrengthen(false);
        toast({
          title: "Defense package ready",
          description: `Defense score ${d.report.risk_score}/100 — ${d.report.claim_strength}.`,
        });
      }
    } catch (e) {
      toast({ title: "Failed to prepare defense", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const ensureThen = (fn) => async () => {
    if (!report) { await prepare(); }
    fn(true);
  };

  const copyResponse = () => {
    if (!report) return;
    const subject = `Detention Claim Follow-Up - Load #${claim.load_number || ""}`;
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${report.ai_generated_response}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="p-6 border-l-4 border-l-emerald-500/60">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
            <Shield className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">AI Claim Defense</h2>
            <p className="text-xs text-muted-foreground">Broker-proof your claim before sending</p>
          </div>
        </div>
        <Button onClick={prepare} disabled={loading} size="sm">
          {loading ? (
            <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Analyzing…</>
          ) : report ? (
            <><Shield className="w-4 h-4 mr-1.5" /> Re-prepare defense</>
          ) : (
            <><Shield className="w-4 h-4 mr-1.5" /> Prepare Claim Defense</>
          )}
        </Button>
      </div>

      {!report ? (
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            AI will analyze your load history, predict broker objections, build counter-arguments, score your
            evidence, and generate a defense package with a broker response email.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Defense score */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-4xl font-bold text-emerald-400">{report.risk_score}<span className="text-lg text-muted-foreground">/100</span></p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Defense score</p>
              </div>
              <div>
                <p className={"text-lg font-semibold " + (strengthColor[report.claim_strength] || "text-amber-400")}>
                  {report.claim_strength}
                </p>
                <p className="text-xs text-muted-foreground">Approval probability: {report.approval_probability}%</p>
                <div className="w-40 h-2 rounded-full bg-muted mt-1.5 overflow-hidden">
                  <div className={"h-full " + (barColor[report.claim_strength] || "bg-amber-500")} style={{ width: `${report.risk_score}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* Broker denial risks + counters */}
          {report.broker_denial_risks?.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5" /> Broker objections & AI counters
              </h3>
              {report.broker_denial_risks.map((r, i) => (
                <div key={i} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-sm">{r.objection}</p>
                  </div>
                  <div className="flex items-start gap-2 pl-6">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-emerald-400">{r.counter}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Evidence checklist */}
          {report.evidence_checklist?.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Evidence Checklist</h3>
              <div className="grid sm:grid-cols-2 gap-2">
                {report.evidence_checklist.map((e, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    {e.present ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span className={e.present ? "text-foreground" : "text-muted-foreground line-through"}>{e.item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strongest arguments */}
          {report.strongest_arguments?.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Strongest Arguments</h3>
              <ul className="space-y-1.5">
                {report.strongest_arguments.map((a, i) => (
                  <li key={i} className="text-sm flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">•</span>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={ensureThen(setShowResponse)} disabled={loading}>
              <Mail className="w-4 h-4 mr-1.5" /> Generate Broker Response
            </Button>
            <Button size="sm" variant="outline" onClick={ensureThen(setShowStrengthen)} disabled={loading}>
              <Lightbulb className="w-4 h-4 mr-1.5" /> Strengthen Claim
            </Button>
          </div>

          {/* Broker response email */}
          {showResponse && report.ai_generated_response && (
            <div className="rounded-lg border border-border p-4 bg-muted/30 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Subject: Detention Claim Follow-Up - Load #{claim.load_number || ""}
                </p>
                <Button size="sm" variant="ghost" onClick={copyResponse}>
                  {copied ? <><Check className="w-4 h-4 mr-1" /> Copied</> : <><Copy className="w-4 h-4 mr-1" /> Copy</>}
                </Button>
              </div>
              <pre className="font-body whitespace-pre-wrap text-sm leading-relaxed">{report.ai_generated_response}</pre>
            </div>
          )}

          {/* Strengthen claim */}
          {showStrengthen && (
            <div className="rounded-lg border border-border p-4 bg-muted/30 space-y-4">
              {report.missing_evidence?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Missing evidence
                  </p>
                  <ul className="space-y-1">
                    {report.missing_evidence.map((m, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />{m}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {report.recommended_actions?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-primary" /> Recommended actions
                  </p>
                  <ul className="space-y-1">
                    {report.recommended_actions.map((a, i) => (
                      <li key={i} className="text-sm flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />{a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
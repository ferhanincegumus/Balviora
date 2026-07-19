import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ScoreBadge from "@/components/ScoreBadge";
import { useToast } from "@/components/ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { scheduleFollowUpsForClaim } from "@/lib/followUpEngine";
import { evaluateAutoDispatch } from "@/lib/autoDispatch";
import { Zap, ShieldCheck, AlertTriangle, Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function AutoDispatchPanel({ claims = [], loads = [], onComplete }) {
  const { toast } = useToast();
  const [evidenceMap, setEvidenceMap] = useState({});
  const [evidenceLoaded, setEvidenceLoaded] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [results, setResults] = useState(null);

  // Candidate claims: ready to send with an email body.
  const candidates = useMemo(
    () => claims.filter((c) => c.status === "ready_to_send" && c.email_body),
    [claims]
  );

  // Pull evidence counts for each candidate (BOL/POD presence gates eligibility).
  useEffect(() => {
    let active = true;
    setEvidenceLoaded(false);
    if (candidates.length === 0) {
      setEvidenceMap({});
      setEvidenceLoaded(true);
      return;
    }
    Promise.all(
      candidates.map((c) =>
        base44.entities.Evidence
          .filter({ claim_id: c.id })
          .then((items) => {
            const counts = { bol: 0, pod: 0, email_thread: 0, other: 0 };
            (items || []).forEach((i) => {
              if (counts[i.type] !== undefined) counts[i.type]++;
            });
            return [c.id, counts];
          })
          .catch(() => [c.id, {}])
      )
    ).then((entries) => {
      if (!active) return;
      setEvidenceMap(Object.fromEntries(entries));
      setEvidenceLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [candidates.length, claims.length]);

  const evaluations = useMemo(
    () =>
      candidates.map((c) => {
        const load = loads.find((l) => l.id === c.load_id);
        const counts = evidenceMap[c.id] || {};
        const ev = evaluateAutoDispatch(c, load, counts);
        return { claim: c, load, ...ev };
      }),
    [candidates, loads, evidenceMap]
  );

  const ready = evaluations.filter((e) => e.eligible);
  const blocked = evaluations.filter((e) => !e.eligible);
  const totalValue = ready.reduce((s, e) => s + (e.claim.claim_amount || 0), 0);

  const dispatchAll = async () => {
    setDispatching(true);
    const done = { ok: 0, fail: 0, sent: [] };
    for (const t of ready) {
      try {
        await base44.functions.invoke("sendClaimEmail", { claimId: t.claim.id });
        const updated = await base44.entities.Claim.update(t.claim.id, {
          status: "sent",
          sent_date: new Date().toISOString(),
          next_followup_date: new Date(Date.now() + 3 * 86400000).toISOString(),
        });
        scheduleFollowUpsForClaim(updated.id, updated).catch(() => {});
        done.ok++;
        done.sent.push(t.claim.load_number || t.claim.id);
      } catch {
        done.fail++;
      }
    }
    setDispatching(false);
    setResults(done);
    toast({
      title: done.fail === 0 ? "Auto-dispatch complete" : "Auto-dispatch finished with errors",
      description: `${done.ok} claim(s) sent${done.fail ? `, ${done.fail} failed` : ""}. AI follow-ups scheduled.`,
      variant: done.fail === 0 ? "default" : "destructive",
    });
    if (onComplete) onComplete();
  };

  // Nothing to show if no ready-to-send claims exist at all.
  if (candidates.length === 0) return null;

  return (
    <Card className="p-6 border-primary/30 bg-primary/5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" /> Auto-Dispatch
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            High-confidence claims (score ≥ 85, BOL + POD on file, ≤ 60 days old) queued for one-click batch sending.
          </p>
        </div>
        {ready.length > 0 && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Ready to dispatch</p>
            <p className="text-2xl font-bold text-primary">
              {ready.length} <span className="text-sm font-normal text-muted-foreground">· ${totalValue.toLocaleString()}</span>
            </p>
          </div>
        )}
      </div>

      {!evidenceLoaded ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Checking evidence on {candidates.length} candidate(s)…
        </div>
      ) : (
        <div className="space-y-3">
          {/* Ready claims */}
          {ready.length === 0 ? (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">No claims meet all auto-dispatch criteria yet.</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {candidates.length} claim(s) are ready to send but blocked — see reasons below. Fix them on the claim page to unlock one-click dispatch.
                </p>
              </div>
            </div>
          ) : (
            <ul className="space-y-2">
              {ready.map((e) => (
                <li key={e.claim.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
                  <span className="w-9 h-9 rounded-md bg-emerald-500/15 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link to={`/claims/${e.claim.id}`} className="text-sm font-medium hover:text-primary truncate">
                        {e.claim.load_number || "—"}
                      </Link>
                      <ScoreBadge score={e.score} label={false} />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {e.claim.broker_name || "—"} · ${((e.claim.claim_amount || 0)).toLocaleString()} · {Math.round(e.ageDays)}d old
                    </p>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" /> BOL+POD
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Blocked claims (collapsed summary) */}
          {blocked.length > 0 && (
            <details className="rounded-lg border border-border bg-muted/20">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium flex items-center gap-2">
                <XCircle className="w-4 h-4 text-muted-foreground" />
                {blocked.length} not yet eligible
              </summary>
              <ul className="px-4 pb-4 space-y-2">
                {blocked.map((e) => (
                  <li key={e.claim.id} className="flex items-start justify-between gap-3 text-xs">
                    <div>
                      <Link to={`/claims/${e.claim.id}`} className="font-medium hover:text-primary">
                        {e.claim.load_number || "—"}
                      </Link>
                      <span className="text-muted-foreground"> · {e.claim.broker_name || "—"}</span>
                    </div>
                    <span className="text-muted-foreground text-right">{e.reasons.join(" · ")}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* Dispatch action */}
          {ready.length > 0 && (
            <div className="flex items-center justify-end gap-3 pt-2">
              {results && (
                <span className="text-xs text-muted-foreground">
                  Last run: {results.ok} sent{results.fail ? `, ${results.fail} failed` : ""}
                </span>
              )}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={dispatching}>
                    <Zap className="w-4 h-4 mr-1.5" />
                    {dispatching ? "Dispatching…" : `Dispatch ${ready.length} claim${ready.length > 1 ? "s" : ""}`}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Auto-dispatch {ready.length} claim(s)?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will send the prepared claim email to each broker, mark the claims as sent, and schedule AI follow-ups (day 3, 7, 14).
                      Total value: ${totalValue.toLocaleString()}.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={dispatching}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={dispatchAll} disabled={dispatching}>
                      {dispatching ? "Sending…" : "Confirm & send all"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
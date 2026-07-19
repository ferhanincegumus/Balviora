import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ScoreBadge from "@/components/ScoreBadge";
import {
  prioritizeClaims,
  categorizeRecovery,
  reasonFor,
  expectedRecovery,
  generateDailySummary,
} from "@/lib/recoveryAssistant";
import { Brain, Sparkles, AlertTriangle, ListChecks, TrendingUp, RefreshCw } from "lucide-react";

export default function RecoveryAssistant({ claims, loads }) {
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState(false);

  const prioritized = prioritizeClaims(claims, loads);
  const { urgent, recommended, opportunities } = categorizeRecovery(prioritized);

  const generate = () => {
    if (!claims) return;
    setSummaryLoading(true);
    setSummaryError(false);
    generateDailySummary(prioritized)
      .then((text) => setSummary(text))
      .catch(() => setSummaryError(true))
      .finally(() => setSummaryLoading(false));
  };

  useEffect(() => {
    if (claims && claims.length > 0) generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claims, loads]);

  if (!claims || claims.length === 0) return null;

  const actionLabel = (claim) =>
    ["draft", "ready_to_send"].includes(claim.status) ? "Generate Email" : "Follow up";

  const RecoveryRow = ({ p, accent }) => {
    const { claim, score } = p;
    const expected = expectedRecovery(claim, score);
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg border border-border bg-card/50 hover:border-primary/40 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link to={`/claims/${claim.id}`} className="font-medium text-sm hover:text-primary truncate">
              Load #{claim.load_number || "—"}
            </Link>
            <ScoreBadge score={score} label={false} />
          </div>
          <p className="text-xs text-muted-foreground mb-1.5">{claim.broker_name || "—"} · ${(claim.claim_amount || 0).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground leading-snug">{reasonFor(p)}</p>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-3 sm:pl-3">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Expected</p>
            <p className="text-sm font-semibold text-emerald-400">${expected.toLocaleString()}</p>
          </div>
          <Link to={`/claims/${claim.id}`}>
            <Button size="sm" variant={accent === "urgent" ? "default" : "outline"}>
              {actionLabel(claim)}
            </Button>
          </Link>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Today's Recovery Summary */}
      <Card className="p-5 border-l-4 border-l-primary">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">AI Recovery Assistant</h2>
              <p className="text-base font-medium text-foreground">Today's Recovery Summary</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={generate} disabled={summaryLoading} title="Regenerate summary">
            <RefreshCw className={`w-4 h-4 ${summaryLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        {summaryLoading ? (
          <div className="space-y-2 animate-pulse">
            <div className="h-3 bg-muted rounded w-full" />
            <div className="h-3 bg-muted rounded w-4/5" />
            <div className="h-3 bg-muted rounded w-3/5" />
          </div>
        ) : summaryError ? (
          <p className="text-sm text-muted-foreground">Could not generate today's summary. <button onClick={generate} className="text-primary hover:underline">Try again.</button></p>
        ) : summary ? (
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{summary}</p>
        ) : (
          <p className="text-sm text-muted-foreground">Generating your recovery briefing…</p>
        )}
      </Card>

      {prioritized.length === 0 && (
        <Card className="p-8 text-center border-dashed">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-6 h-6 text-emerald-400" />
          </div>
          <p className="font-medium">You're all caught up.</p>
          <p className="text-sm text-muted-foreground mt-1">No open claims need attention right now.</p>
        </Card>
      )}

      {/* 1. Urgent Claims */}
      {urgent.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
            <AlertTriangle className="w-4 h-4 text-red-400" /> Urgent Claims
            <span className="text-xs font-normal text-muted-foreground">({urgent.length})</span>
          </h3>
          <div className="space-y-2.5">
            {urgent.map((p) => <RecoveryRow key={p.claim.id} p={p} accent="urgent" />)}
          </div>
        </section>
      )}

      {/* 2. Recommended Actions */}
      {recommended.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
            <ListChecks className="w-4 h-4 text-primary" /> Recommended Actions
            <span className="text-xs font-normal text-muted-foreground">({recommended.length})</span>
          </h3>
          <div className="space-y-2.5">
            {recommended.map((p) => <RecoveryRow key={p.claim.id} p={p} />)}
          </div>
        </section>
      )}

      {/* 3. Recovery Opportunities */}
      {opportunities.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-400" /> Recovery Opportunities
            <span className="text-xs font-normal text-muted-foreground">({opportunities.length})</span>
          </h3>
          <div className="space-y-2.5">
            {opportunities.map((p) => <RecoveryRow key={p.claim.id} p={p} />)}
          </div>
        </section>
      )}
    </div>
  );
}
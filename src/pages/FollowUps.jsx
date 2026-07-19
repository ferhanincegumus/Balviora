import React, { useEffect, useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import ScoreBadge from "@/components/ScoreBadge";
import FollowUpStatusBadge from "@/components/FollowUpStatusBadge";
import { computeScore } from "@/lib/claimScore";
import {
  scheduleFollowUpsForClaim,
  getDaysWaiting,
  getFollowUpUrgency,
  generateFollowUpEmail,
  sendFollowUp,
  resolveFollowUpsForClaim,
  typeMeta,
} from "@/lib/followUpEngine";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sparkles, Send, CalendarClock, CheckCircle2, Mail, AlertCircle, Clock, RefreshCw } from "lucide-react";

const OPEN_STATUSES = ["sent", "awaiting_response", "followup_required"];

const urgencyStyles = {
  critical: "bg-red-500/15 text-red-400",
  high: "bg-orange-500/15 text-orange-400",
  medium: "bg-amber-500/15 text-amber-400",
  low: "bg-slate-500/15 text-slate-400",
  none: "bg-muted text-muted-foreground",
};

export default function FollowUps() {
  const [claims, setClaims] = useState(null);
  const [followups, setFollowups] = useState(null);
  const [loads, setLoads] = useState(null);
  const [generating, setGenerating] = useState(null);
  const [sending, setSending] = useState(null);
  const [resolving, setResolving] = useState(null);
  const [emailPreview, setEmailPreview] = useState(null);
  const [reschedule, setReschedule] = useState(null);
  const scheduledRef = useRef(new Set());
  const { toast } = useToast();

  const refresh = async () => {
    try {
      const [c, f, l] = await Promise.all([
        base44.entities.Claim.list("-updated_date", 200),
        base44.entities.FollowUp.list("-updated_date", 200),
        base44.entities.Load.list("-updated_date", 200),
      ]);
      setClaims(c);
      setFollowups(f);
      setLoads(l);
    } catch {
      setClaims([]); setFollowups([]); setLoads([]);
    }
  };

  useEffect(() => { refresh(); }, []);

  // Backfill: schedule follow-ups for any sent claims that don't have them yet (one-time per claim).
  useEffect(() => {
    if (!claims || !followups) return;
    const toSchedule = claims.filter(
      (c) =>
        OPEN_STATUSES.includes(c.status) &&
        c.sent_date &&
        !scheduledRef.current.has(c.id) &&
        !followups.some((f) => f.claim_id === c.id)
    );
    if (toSchedule.length === 0) return;
    toSchedule.forEach((c) => scheduledRef.current.add(c.id));
    Promise.all(toSchedule.map((c) => scheduleFollowUpsForClaim(c.id, c)))
      .then(refresh)
      .catch(() => {});
  }, [claims, followups]);

  const rows = useMemo(() => {
    if (!claims) return [];
    const result = claims
      .filter((c) => OPEN_STATUSES.includes(c.status) || c.status === "denied")
      .map((c) => {
        const cFollowups = (followups || []).filter((f) => f.claim_id === c.id);
        const load = (loads || []).find((l) => l.id === c.load_id);
        const days = getDaysWaiting(c);
        const score = computeScore(c, load);
        if (c.status === "denied") {
          return {
            claim: c, load, followups: cFollowups, days,
            urgency: { urgency: "critical", action: "Counter-offer needed", type: "custom", due: true },
            score, dueFollowup: null, denied: true,
          };
        }
        const urgency = getFollowUpUrgency(c);
        const dueFollowup =
          cFollowups.find((f) => f.type === urgency.type && f.status === "scheduled") ||
          cFollowups.find((f) => f.status === "scheduled") ||
          null;
        return { claim: c, load, followups: cFollowups, days, urgency, score, dueFollowup };
      });
    const order = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };
    return result.sort((a, b) => order[a.urgency.urgency] - order[b.urgency.urgency] || b.days - a.days);
  }, [claims, followups, loads]);

  const dueCount = rows.filter((r) => r.urgency.due).length;

  const handleGenerate = async (row) => {
    setGenerating(row.claim.id);
    try {
      const type = row.urgency.type || "day_3";
      const previousSent = row.followups.filter((f) => f.status === "sent");
      const email = await generateFollowUpEmail(row.claim, row.load, null, type, previousSent);

      let fu = row.followups.find((f) => f.type === type);
      if (!fu) {
        fu = await base44.entities.FollowUp.create({
          claim_id: row.claim.id,
          follow_up_number: typeMeta(type).delayDays,
          scheduled_date: new Date().toISOString(),
          status: "scheduled",
          type,
        });
        await refresh();
        fu = (followups ? [...followups] : []).find((f) => f.id === fu.id) || fu;
      }
      setEmailPreview({ claimId: row.claim.id, followUpId: fu.id, type, subject: email.subject, body: email.body });
    } catch {
      toast({ title: "Error", description: "Could not generate follow-up email.", variant: "destructive" });
    } finally {
      setGenerating(null);
    }
  };

  const handleSendPreview = async () => {
    if (!emailPreview) return;
    setSending(emailPreview.claimId);
    try {
      try {
        await base44.functions.invoke("sendClaimEmail", { claimId: emailPreview.claimId });
      } catch {}
      await sendFollowUp(emailPreview.followUpId, { subject: emailPreview.subject, body: emailPreview.body }, emailPreview.claimId);
      toast({ title: "Follow-up sent", description: "Broker has been notified and claim updated." });
      setEmailPreview(null);
      await refresh();
    } catch {
      toast({ title: "Error", description: "Could not send follow-up.", variant: "destructive" });
    } finally {
      setSending(null);
    }
  };

  const handleReschedule = async () => {
    if (!reschedule) return;
    try {
      const iso = new Date(reschedule.date + "T09:00:00").toISOString();
      await base44.entities.FollowUp.update(reschedule.followUpId, { scheduled_date: iso });
      toast({ title: "Follow-up rescheduled" });
      setReschedule(null);
      refresh();
    } catch {
      toast({ title: "Error", description: "Could not reschedule.", variant: "destructive" });
    }
  };

  const handleResolve = async (claimId) => {
    setResolving(claimId);
    try {
      const n = await resolveFollowUpsForClaim(claimId);
      await base44.entities.Claim.update(claimId, { status: "awaiting_response" });
      toast({ title: "Follow-ups resolved", description: n > 0 ? `${n} scheduled follow-up(s) completed.` : "Broker response recorded." });
      refresh();
    } catch {
      toast({ title: "Error", description: "Could not resolve.", variant: "destructive" });
    } finally {
      setResolving(null);
    }
  };

  const toLocalDateInput = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const off = d.getTimezoneOffset();
    return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Follow-up Center</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-managed recovery follow-ups for your open detention claims.
          </p>
        </div>
        <Button variant="outline" onClick={refresh}>
          <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
        </Button>
      </div>

      {claims === null ? (
        <Card className="p-10 text-center text-muted-foreground">Loading follow-ups…</Card>
      ) : rows.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          </div>
          <p className="font-medium">No follow-ups needed right now.</p>
          <p className="text-sm text-muted-foreground mt-1">
            Claims awaiting broker payment will appear here automatically once sent.
          </p>
          <Link to="/claims" className="inline-block mt-5">
            <Button variant="outline">View all claims</Button>
          </Link>
        </Card>
      ) : (
        <>
          {dueCount > 0 && (
            <Card className="p-4 border-l-4 border-l-amber-500 bg-amber-500/5">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                <p className="text-sm">
                  <span className="font-medium text-amber-400">{dueCount} claim{dueCount === 1 ? "" : "s"}</span> need follow-up attention today.
                </p>
              </div>
            </Card>
          )}

          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Load #</th>
                    <th className="px-4 py-3 font-medium">Broker</th>
                    <th className="px-4 py-3 font-medium text-right">Claim</th>
                    <th className="px-4 py-3 font-medium text-center">Days Waiting</th>
                    <th className="px-4 py-3 font-medium">Score</th>
                    <th className="px-4 py-3 font-medium">Next Action</th>
                    <th className="px-4 py-3 font-medium">Follow-up</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const { claim, days, urgency, score, dueFollowup } = row;
                    return (
                      <tr key={claim.id} className="border-b border-border last:border-0 hover:bg-muted/40 align-top">
                        <td className="px-4 py-3 font-medium">
                          <Link to={`/claims/${claim.id}`} className="hover:text-primary">{claim.load_number || "—"}</Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{claim.broker_name || "—"}</td>
                        <td className="px-4 py-3 text-right font-medium">${(claim.claim_amount || 0).toLocaleString()}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={days >= 7 ? "font-semibold text-orange-400" : days >= 3 ? "text-amber-400" : "text-muted-foreground"}>
                            {days}d
                          </span>
                        </td>
                        <td className="px-4 py-3"><ScoreBadge score={score} label={false} /></td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium ${urgencyStyles[urgency.urgency]}`}>
                            <Clock className="w-3 h-3" /> {urgency.action}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {dueFollowup ? (
                            <FollowUpStatusBadge status={dueFollowup.status} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {row.denied ? (
                            <div className="flex items-center justify-end gap-1">
                              <Link to={`/claims/${claim.id}`}>
                                <Button variant="outline" size="sm" title="Open to generate counter-offer">
                                  <Sparkles className="w-3.5 h-3.5 mr-1" /> Counter-offer
                                </Button>
                              </Link>
                            </div>
                          ) : (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="px-2"
                              onClick={() => handleGenerate(row)}
                              disabled={generating === claim.id}
                              title="Generate Follow-up"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="px-2"
                              onClick={() => handleGenerate(row)}
                              disabled={generating === claim.id}
                              title="Send Email"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </Button>
                            {dueFollowup && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="px-2"
                                onClick={() => setReschedule({ followUpId: dueFollowup.id, date: toLocalDateInput(dueFollowup.scheduled_date) })}
                                title="Reschedule"
                              >
                                <CalendarClock className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="px-2 text-emerald-400 hover:text-emerald-400"
                              onClick={() => handleResolve(claim.id)}
                              disabled={resolving === claim.id}
                              title="Mark Resolved"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Email preview dialog */}
      <Dialog open={!!emailPreview} onOpenChange={(o) => !o && setEmailPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-primary" />
              {typeMeta(emailPreview?.type).label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[55vh] overflow-y-auto">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Subject</p>
              <p className="font-medium p-3 rounded-lg bg-muted/50 border border-border">{emailPreview?.subject}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Body</p>
              <pre className="font-body whitespace-pre-wrap text-sm p-4 rounded-lg bg-muted/50 border border-border leading-relaxed">{emailPreview?.body}</pre>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailPreview(null)}>Cancel</Button>
            <Button onClick={handleSendPreview} disabled={sending}>
              <Send className="w-4 h-4 mr-1.5" /> {sending ? "Sending…" : "Send to broker"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule dialog */}
      <Dialog open={!!reschedule} onOpenChange={(o) => !o && setReschedule(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-primary" /> Reschedule follow-up
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="mb-1.5 block">New scheduled date</Label>
              <Input
                type="date"
                value={reschedule?.date || ""}
                onChange={(e) => setReschedule((r) => (r ? { ...r, date: e.target.value } : r))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReschedule(null)}>Cancel</Button>
            <Button onClick={handleReschedule}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
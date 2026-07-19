import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { LogIn, LogOut, Bell, Clock, DollarSign, Copy, Check, Loader2 } from "lucide-react";
import { generateNotificationEmail } from "@/lib/rateConAnalysis";

const fmtDur = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

// Live detention clock: Arrived/Departed timestamps, countdown to free-time
// expiry with a 15-min push notification, live accruing amount once billing
// starts, and auto-drafted claim + clause-text evidence on departure.
export default function LoadDetentionTimer({ load, onUpdated }) {
  const { toast } = useToast();
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const fired15 = useRef(false);
  const firedBilling = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const arrival = load.arrival_time ? new Date(load.arrival_time).getTime() : null;
  const departure = load.departure_time ? new Date(load.departure_time).getTime() : null;
  const freeHours = Number(load.free_detention_hours) || 0;
  const rate = Number(load.contract_rate || load.detention_rate_per_hour) || 0;
  const freeExpiresAt = arrival ? arrival + freeHours * 3600 * 1000 : null;

  const fireNotif = (title, body) => {
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        new Notification(title, { body });
      } catch {}
    }
  };

  // 15-minute warning before free time expires.
  useEffect(() => {
    if (!freeExpiresAt || departure || fired15.current || load.notified_15min) return;
    const warnAt = freeExpiresAt - 15 * 60 * 1000;
    if (now >= warnAt && now < freeExpiresAt) {
      fired15.current = true;
      base44.entities.Load.update(load.id, { notified_15min: true }).then((u) => onUpdated?.(u)).catch(() => {});
      fireNotif(
        "Detention free time expiring",
        `Free detention ends in ~15 min for load ${load.load_number || ""}. Notify your broker now.`
      );
      toast({ title: "15 minutes until detention billing starts", description: "Send your broker an arrival notification now." });
    }
  }, [now, freeExpiresAt, departure, load.notified_15min]);

  // Billing started.
  useEffect(() => {
    if (!freeExpiresAt || departure || firedBilling.current || load.notified_billing_start) return;
    if (now >= freeExpiresAt) {
      firedBilling.current = true;
      base44.entities.Load.update(load.id, { notified_billing_start: true }).then((u) => onUpdated?.(u)).catch(() => {});
      fireNotif(
        "Detention billing started",
        `Detention is now billable for load ${load.load_number || ""}. Accruing at $${rate}/hr.`
      );
      toast({ title: "Detention billing has started", description: `Accruing at $${rate}/hr.` });
    }
  }, [now, freeExpiresAt, departure, load.notified_billing_start]);

  const handleArrived = async () => {
    setBusy(true);
    try {
      const updated = await base44.entities.Load.update(load.id, {
        arrival_time: new Date().toISOString(),
        notified_15min: false,
        notified_billing_start: false,
      });
      fired15.current = false;
      firedBilling.current = false;
      onUpdated?.(updated);
      toast({ title: "Arrived", description: "Detention clock started." });
    } catch {
      toast({ title: "Error", description: "Could not timestamp arrival.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleDeparted = async () => {
    setBusy(true);
    try {
      const dep = new Date().toISOString();
      const a = new Date(load.arrival_time).getTime();
      const d = new Date(dep).getTime();
      const totalWait = (d - a) / (1000 * 60 * 60);
      const billable = Math.max(0, totalWait - freeHours);
      const claim = billable * rate;
      const updated = await base44.entities.Load.update(load.id, {
        departure_time: dep,
        total_wait_hours: Number(totalWait.toFixed(2)),
        billable_hours: Number(billable.toFixed(2)),
        claim_amount: Number(claim.toFixed(2)),
      });
      onUpdated?.(updated);
      await prefillClaim(load, updated, claim);
      toast({
        title: "Departed — claim drafted",
        description: `Claim pre-filled at $${claim.toFixed(2)} with the rate con clause attached as evidence.`,
      });
    } catch {
      toast({ title: "Error", description: "Could not timestamp departure.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  // Pre-fill the linked claim draft with the computed amount and save the
  // verbatim clause_text as supporting Evidence.
  const prefillClaim = async (oldLoad, updatedLoad, claim) => {
    try {
      let linked = await base44.entities.Claim.filter({ load_id: oldLoad.id });
      let claimRec = linked[0];
      if (!claimRec) {
        claimRec = await base44.entities.Claim.create({
          load_id: oldLoad.id,
          broker_name: oldLoad.broker_name,
          load_number: oldLoad.load_number,
          status: "draft",
          claim_amount: claim,
        });
      } else {
        claimRec = await base44.entities.Claim.update(claimRec.id, {
          broker_name: oldLoad.broker_name,
          load_number: oldLoad.load_number,
          claim_amount: claim,
        });
      }
      if (oldLoad.clause_text) {
        await base44.entities.Evidence.create({
          claim_id: claimRec.id,
          type: "other",
          filename: "Rate con detention clause",
          content: oldLoad.clause_text,
          notes: "Verbatim detention clause extracted from the rate confirmation",
          uploaded_at: new Date().toISOString(),
        });
      }
    } catch {}
  };

  const handleNotificationEmail = async () => {
    setGenerating(true);
    try {
      let carrier = null;
      try {
        const profiles = await base44.entities.CarrierProfile.list();
        if (profiles.length) carrier = profiles[0];
      } catch {}
      const res = await generateNotificationEmail({
        broker_name: load.broker_name,
        load_number: load.load_number,
        free_time_hours: freeHours,
        arrival_time: load.arrival_time,
        carrier,
      });
      setEmail(res);
      setEmailOpen(true);
    } catch {
      toast({ title: "Could not generate notification email", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const copyEmail = () => {
    navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const billing = arrival && !departure && freeExpiresAt && now >= freeExpiresAt;
  const billableSoFar = billing ? (now - freeExpiresAt) / (1000 * 60 * 60) : 0;
  const accruing = billing ? billableSoFar * rate : 0;

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-primary" />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Detention Clock</p>
      </div>

      {/* Arrived / Departed */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <Button
          size="sm"
          variant={arrival ? "outline" : "default"}
          disabled={busy || !!arrival}
          onClick={handleArrived}
        >
          <LogIn className="w-4 h-4 mr-1.5" /> {arrival ? "Arrived" : "Arrived"}
        </Button>
        <Button
          size="sm"
          variant={departure ? "outline" : "secondary"}
          disabled={busy || !arrival || !!departure}
          onClick={handleDeparted}
        >
          {busy ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <LogOut className="w-4 h-4 mr-1.5" />}
          Departed
        </Button>
      </div>

      {arrival && (
        <div className="text-xs text-muted-foreground space-y-1">
          <p>Arrival: <strong className="text-foreground">{new Date(load.arrival_time).toLocaleString()}</strong></p>
          {departure && <p>Departure: <strong className="text-foreground">{new Date(load.departure_time).toLocaleString()}</strong></p>}
          <p>Free time: {freeHours} hrs · Rate: ${rate}/hr</p>
        </div>
      )}

      {/* Live countdown / accrual */}
      {arrival && !departure && freeExpiresAt && (
        <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border">
          {!billing ? (
            <>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Free time ends in
              </p>
              <p className="text-2xl font-bold text-amber-400 tabular-nums tracking-tight mt-1">{fmtDur(freeExpiresAt - now)}</p>
              {now >= freeExpiresAt - 15 * 60 * 1000 && (
                <Button size="sm" variant="outline" className="w-full mt-2" onClick={handleNotificationEmail} disabled={generating}>
                  {generating ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Bell className="w-4 h-4 mr-1.5" />}
                  Send broker notification
                </Button>
              )}
            </>
          ) : (
            <>
              <p className="text-xs text-alert flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" /> Detention billing — accruing live
              </p>
              <p className="text-3xl font-bold text-alert tabular-nums tracking-tight mt-1">${accruing.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{billableSoFar.toFixed(2)} billable hrs · ${rate}/hr</p>
            </>
          )}
        </div>
      )}

      {departure && (
        <div className="mt-3 p-3 rounded-lg bg-muted border border-border">
          <p className="text-xs text-muted-foreground">Claim drafted</p>
          <p className="text-xl font-bold text-foreground mt-0.5">${(load.claim_amount || 0).toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">{Number(load.billable_hours || 0).toFixed(2)} billable hrs</p>
        </div>
      )}

      {/* Notification email dialog */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Broker arrival notification</DialogTitle>
          </DialogHeader>
          {email && (
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Subject</p>
                <p className="font-medium p-3 rounded-lg bg-muted/50 border border-border">{email.subject}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Body</p>
                <pre className="font-body whitespace-pre-wrap text-sm p-4 rounded-lg bg-muted/50 border border-border leading-relaxed">{email.body}</pre>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={copyEmail} disabled={!email}>
              {copied ? <><Check className="w-4 h-4 mr-1.5" /> Copied</> : <><Copy className="w-4 h-4 mr-1.5" /> Copy</>}
            </Button>
            <Button onClick={() => setEmailOpen(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
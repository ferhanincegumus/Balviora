import React, { useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import { useParams, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import StatusBadge from "@/components/StatusBadge";
import ScoreBadge from "@/components/ScoreBadge";
import { computeScore } from "@/lib/claimScore";
import { useToast } from "@/components/ui/use-toast";
import ClaimTimeline from "@/components/ClaimTimeline";
import { analyzeClaim } from "@/lib/claimAssistant";
import { scheduleFollowUpsForClaim } from "@/lib/followUpEngine";
import NegotiationPanel from "@/components/NegotiationPanel";
import NegotiationLoop from "@/components/NegotiationLoop";
import ClaimDefense from "@/components/ClaimDefense";
import EvidenceManager from "@/components/EvidenceManager";
import BrokerResponseSimulator from "@/components/BrokerResponseSimulator";
import { ArrowLeft, Sparkles, Copy, Check, Send, CheckCircle, XCircle, Clock, MapPin, FileText, FileDown, Brain, AlertCircle, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const STATUS_FLOW = [
  { key: "draft", label: "Draft", icon: FileText },
  { key: "ready_to_send", label: "Ready", icon: Sparkles },
  { key: "sent", label: "Sent", icon: Send },
  { key: "awaiting_response", label: "Awaiting", icon: Clock },
  { key: "followup_required", label: "Follow-up", icon: AlertCircle },
  { key: "approved", label: "Approved", icon: CheckCircle },
  { key: "paid", label: "Paid", icon: CheckCircle },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "ready_to_send", label: "Ready to Send" },
  { value: "sent", label: "Sent" },
  { value: "awaiting_response", label: "Awaiting Response" },
  { value: "followup_required", label: "Follow-up Required" },
  { value: "approved", label: "Approved" },
  { value: "partially_approved", label: "Partially Approved" },
  { value: "denied", label: "Denied" },
  { value: "paid", label: "Paid" },
  { value: "closed", label: "Closed" },
];

export default function ClaimDetail() {
  const { id } = useParams();
  const { toast } = useToast();
  const [claim, setClaim] = useState(null);
  const [load, setLoad] = useState(null);
  const [carrier, setCarrier] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);
  const [brokerEmail, setBrokerEmail] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    base44.entities.Claim.get(id)
      .then(async (c) => {
        if (!c) { setClaim(false); return; }
        setClaim(c);
        if (c.broker_contact_email) setBrokerEmail(c.broker_contact_email);
        if (c.load_id) {
          try {
            const l = await base44.entities.Load.get(c.load_id);
            setLoad(l);
          } catch {}
        }
        try {
          const profiles = await base44.entities.CarrierProfile.list();
          if (profiles.length > 0) setCarrier(profiles[0]);
        } catch {}
      })
      .catch(() => setClaim(false));
  }, [id]);

  const buildPrompt = (kind) => {
    const cp = carrier || {};
    const base = `Carrier details:
- Company: ${cp.company_name || "[Carrier]"}
- Owner: ${cp.owner_name || ""}
- MC#: ${cp.mc_number || "N/A"}
- DOT#: ${cp.dot_number || "N/A"}

Load details:
- Broker: ${load.broker_name || "[Broker]"}
- Customer: ${load.customer_name || "N/A"}
- Load number: ${load.load_number || "N/A"}
- Pickup: ${load.pickup_location || "N/A"}
- Delivery: ${load.delivery_location || "N/A"}
- Appointment: ${load.appointment_time || "N/A"}
- Arrival: ${load.arrival_time || "N/A"}
- Departure: ${load.departure_time || "N/A"}

Detention calculation:
- Total wait time: ${Number(load.total_wait_hours || 0).toFixed(2)} hours
- Free detention: ${load.free_detention_hours || 0} hours
- Billable hours: ${Number(load.billable_hours || 0).toFixed(2)} hours
- Detention rate: $${load.contract_rate || load.detention_rate_per_hour || 0}/hour
- Total claim amount: $${Number(load.claim_amount || 0).toFixed(2)}`;

    if (kind === "initial") {
      return `You are a professional freight carrier writing a detention time claim email to a broker. Write a polite, professional, and firm email requesting detention pay.

${base}

Write a professional email with:
1. A clear subject line mentioning the load number and "Detention Time Claim".
2. A polite greeting to the broker.
3. A clear statement of the load and that detention time was incurred.
4. The specific arrival, departure, and total wait times.
5. The contract terms (free detention hours and rate).
6. The exact billable hours and total amount requested.
7. A polite closing requesting payment or documentation, signed with the carrier company name.

Return JSON with "subject" and "body" fields. The body should be plain text with line breaks.`;
    }

    const days = kind === 7 ? "7" : kind === 14 ? "14" : "30";
    return `You are a professional freight carrier sending a polite follow-up reminder to a broker about an unpaid detention time claim. This is a ${days}-day follow-up. Be polite and professional, but gently firm, noting that payment is now overdue and referencing the original claim.

${base}

Write a professional follow-up email with:
1. A clear subject line mentioning the load number, "${days}-day reminder", and "Detention Time Claim".
2. A polite greeting to the broker.
3. A reference to the original claim sent previously that remains unpaid.
4. A brief restatement of the billable hours and total amount requested.
5. A polite request for an update on payment status or documentation, signed with the carrier company name.

Return JSON with "subject" and "body" fields. The body should be plain text with line breaks.`;
  };

  const runGenerate = async (kind) => {
    if (!load) return;
    setGenerating(true);
    try {
      const prompt = buildPrompt(kind);

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: { subject: { type: "string" }, body: { type: "string" } },
        },
      });

      const updateData = {
        email_subject: res.subject,
        email_body: res.body,
      };
      if (kind === "initial") {
        updateData.status = "ready_to_send";
        updateData.generated_at = new Date().toISOString();
      } else {
        updateData[`reminder_sent_${kind}`] = true;
        updateData.last_followup_date = new Date().toISOString();
        updateData.status = "followup_required";
        // schedule next follow-up
        const nextDays = kind === 7 ? 14 : 30;
        updateData.next_followup_date = new Date(Date.now() + nextDays * 86400000).toISOString();
      }
      const updated = await base44.entities.Claim.update(claim.id, updateData);
      setClaim(updated);
      toast({
        title: kind === "initial" ? "Claim email generated" : `${kind}-day reminder generated`,
        description: kind === "initial" ? "Review and send it to your broker." : "Review and send the follow-up to your broker.",
      });
      return updated;
    } catch (e) {
      toast({ title: "Error", description: "Could not generate the email. Try again.", variant: "destructive" });
      return null;
    } finally {
      setGenerating(false);
    }
  };

  const generateEmail = () => runGenerate("initial");
  const generateReminder = (days) => () => runGenerate(days);

  const updateStatus = async (status, extra = {}) => {
    try {
      const updated = await base44.entities.Claim.update(claim.id, { status, ...extra });
      setClaim(updated);
      toast({ title: "Status updated", description: `Marked as ${STATUS_OPTIONS.find(s => s.value === status)?.label || status}.` });
      if (status === "paid" && load?.customer_phone) {
        base44.functions.invoke("sendCustomerMessage", {
          phone: load.customer_phone,
          message: `Great news — your detention claim against ${claim.broker_name || "the broker"} has been paid. Thank you for your patience. — Detention Shield`,
        }).catch(() => null);
      }
    } catch {
      toast({ title: "Error", description: "Could not update status.", variant: "destructive" });
    }
  };

  const sendToBroker = async (claimArg) => {
    const c = claimArg || claim;
    if (!c) return;
    const recipient = (brokerEmail || c.broker_contact_email || "").trim();
    if (!recipient) {
      toast({ title: "Broker email required", description: "Enter the broker's contact email before sending.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      if (recipient !== c.broker_contact_email) {
        const persisted = await base44.entities.Claim.update(c.id, { broker_contact_email: recipient });
        setClaim(persisted);
      }
      await base44.functions.invoke("sendClaimEmail", { claimId: c.id, to: recipient });
      const updated = await base44.entities.Claim.update(c.id, {
        status: "sent",
        sent_date: new Date().toISOString(),
        next_followup_date: new Date(Date.now() + 7 * 86400000).toISOString(),
      });
      setClaim(updated);
      scheduleFollowUpsForClaim(updated.id, updated).catch(() => {});
      toast({ title: "Email delivered to broker", description: `Claim sent to ${recipient}.` });
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || "Could not send email. You can retry.";
      toast({ title: "Send failed", description: msg, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const sendReply = async () => {
    setSendingReply(true);
    try {
      await base44.functions.invoke("sendClaimReply", { claimId: claim.id });
      const updated = await base44.entities.Claim.get(claim.id);
      setClaim(updated);
      toast({ title: "Reply sent to broker", description: "Your approved reply was delivered." });
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || "Could not send reply. You can retry.";
      toast({ title: "Send failed", description: msg, variant: "destructive" });
    } finally {
      setSendingReply(false);
    }
  };

  const discardReply = async () => {
    try {
      const updated = await base44.entities.Claim.update(claim.id, {
        pending_reply_subject: "",
        pending_reply_body: "",
        pending_reply_in_reply_to: "",
      });
      setClaim(updated);
    } catch {}
  };

  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    const left = 20;
    let y = 22;
    doc.setFontSize(18); doc.setTextColor(30); doc.text("Detention Time Claim", left, y); y += 7;
    doc.setFontSize(10); doc.setTextColor(120);
    doc.text(`Load ${load?.load_number || ""}   —   ${claim.broker_name || ""}`, left, y); y += 6;
    doc.text(`Status: ${claim.status}`, left, y); y += 10;

    doc.setFontSize(12); doc.setTextColor(30); doc.text("Carrier Information", left, y); y += 6;
    doc.setFontSize(10); doc.setTextColor(80);
    const cp = carrier || {};
    doc.text(`Company: ${cp.company_name || "—"}`, left, y); y += 5;
    doc.text(`Owner: ${cp.owner_name || "—"}`, left, y); y += 5;
    doc.text(`MC#: ${cp.mc_number || "N/A"}    DOT#: ${cp.dot_number || "N/A"}`, left, y); y += 5;
    if (cp.phone) { doc.text(`Phone: ${cp.phone}`, left, y); y += 5; }
    y += 4;

    doc.setFontSize(12); doc.setTextColor(30); doc.text("Load Details", left, y); y += 6;
    doc.setFontSize(10); doc.setTextColor(80);
    [
      `Load number: ${load?.load_number || "—"}`,
      `Broker: ${load?.broker_name || "—"}`,
      `Customer: ${load?.customer_name || "—"}`,
      `Route: ${load?.pickup_location || "—"} -> ${load?.delivery_location || "—"}`,
      `Appointment: ${load?.appointment_time || "—"}`,
      `Arrival: ${load?.arrival_time || "—"}`,
      `Departure: ${load?.departure_time || "—"}`,
    ].forEach((l) => { doc.text(l, left, y); y += 5; });
    y += 4;

    doc.setFontSize(12); doc.setTextColor(30); doc.text("Detention Calculation", left, y); y += 6;
    doc.setFontSize(10); doc.setTextColor(80);
    doc.text(`Total wait time: ${Number(load?.total_wait_hours || 0).toFixed(2)} hrs`, left, y); y += 5;
    doc.text(`Free detention: ${load?.free_detention_hours || 0} hrs`, left, y); y += 5;
    doc.text(`Billable hours: ${Number(load?.billable_hours || 0).toFixed(2)} hrs`, left, y); y += 5;
    doc.text(`Rate: $${load?.contract_rate || load?.detention_rate_per_hour || 0}/hr`, left, y); y += 5;
    doc.setFontSize(13); doc.setTextColor(30);
    doc.text(`Total claim amount: $${(claim.claim_amount || 0).toFixed(2)}`, left, y); y += 10;

    if (claim.email_subject) {
      doc.setFontSize(12); doc.setTextColor(30); doc.text("Claim Email", left, y); y += 6;
      doc.setFontSize(10); doc.setTextColor(80);
      doc.text(`Subject: ${doc.splitTextToSize(claim.email_subject, 170)[0]}`, left, y); y += 6;
      doc.text("Body:", left, y); y += 6;
      doc.splitTextToSize(claim.email_body || "", 170).forEach((ln) => {
        if (y > 280) { doc.addPage(); y = 22; }
        doc.text(ln, left, y); y += 5;
      });
    }

    doc.save(`claim-${claim.load_number || claim.id}.pdf`);
  };

  const copyEmail = () => {
    const text = `Subject: ${claim.email_subject}\n\n${claim.email_body}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (claim === null) {
    return <Card className="p-10 text-center text-muted-foreground">Loading claim…</Card>;
  }
  if (claim === false) {
    return (
      <Card className="p-10 text-center">
        <p className="font-medium">Claim not found.</p>
        <p className="text-sm text-muted-foreground mt-1">This claim may have been deleted or belongs to another account.</p>
        <Link to="/claims" className="inline-block mt-4 text-primary hover:underline text-sm">Back to claims</Link>
      </Card>
    );
  }

  const activeStep = STATUS_FLOW.findIndex((s) => s.key === claim.status);
  const analysis = analyzeClaim(claim, load);
  const canGenerateAndSend = claim.status === "draft" || claim.status === "ready_to_send" || !claim.sent_date;

  return (
    <div className="space-y-6 max-w-4xl">
      <Link to="/claims" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to claims
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-semibold tracking-tight">Claim {claim.load_number || ""}</h1>
            <StatusBadge status={claim.status} />
          </div>
          <p className="text-sm text-muted-foreground">Broker: {claim.broker_name || "—"}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Claim amount</p>
          <p className="text-3xl font-bold text-primary">${(claim.claim_amount || 0).toLocaleString()}</p>
          <div className="mt-2"><ScoreBadge score={computeScore(claim, load)} /></div>
        </div>
      </div>

      {/* Status flow */}
      <Card className="p-6">
        <div className="flex items-center justify-between overflow-x-auto gap-3">
          {STATUS_FLOW.map((s, i) => {
            const done = activeStep >= 0 ? i <= activeStep : false;
            const isCurrent = s.key === claim.status;
            return (
              <React.Fragment key={s.key}>
                <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${done ? "bg-primary text-primary-foreground" : isCurrent ? "bg-primary/20 text-primary ring-2 ring-primary" : "bg-muted text-muted-foreground"}`}>
                    <s.icon className="w-4 h-4" />
                  </div>
                  <span className={`text-[10px] font-medium ${done || isCurrent ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
                </div>
                {i < STATUS_FLOW.length - 1 && (
                  <div className={`h-0.5 flex-1 min-w-[20px] ${i < activeStep ? "bg-primary" : "bg-muted"}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </Card>

      {/* AI Claim Assistant */}
      {analysis && (
        <Card className="p-6 border-l-4 border-l-primary">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">AI Claim Assistant</h2>
              <p className="text-sm text-foreground mb-3">{analysis.message}</p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Recovery probability</span>
                  <ScoreBadge score={analysis.score} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Recommended</span>
                  {canGenerateAndSend ? (
                    <button
                      type="button"
                      onClick={generateEmail}
                      disabled={generating || !load}
                      className="text-sm font-medium text-primary hover:underline disabled:opacity-50 text-left"
                    >
                      {generating ? "Generating…" : analysis.nextAction}
                    </button>
                  ) : (
                    <span className="text-sm font-medium text-primary">{analysis.nextAction}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Broker response simulator */}
      <BrokerResponseSimulator claim={claim} load={load} carrier={carrier} onClaimUpdate={setClaim} />

      {/* Load summary */}
      {load && (
        <Card className="p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Load Details</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div><p className="text-muted-foreground">Load number</p><p className="font-medium">{load.load_number || "—"}</p></div>
            <div><p className="text-muted-foreground">Broker</p><p className="font-medium">{load.broker_name || "—"}</p></div>
            <div><p className="text-muted-foreground">Customer</p><p className="font-medium">{load.customer_name || "—"}</p></div>
            <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-muted-foreground" /><div><p className="text-muted-foreground">Pickup</p><p className="font-medium">{load.pickup_location || "—"}</p></div></div>
            <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-muted-foreground" /><div><p className="text-muted-foreground">Delivery</p><p className="font-medium">{load.delivery_location || "—"}</p></div></div>
            <div className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-muted-foreground" /><div><p className="text-muted-foreground">Total wait</p><p className="font-medium">{Number(load.total_wait_hours || 0).toFixed(2)} hrs</p></div></div>
            <div><p className="text-muted-foreground">Free detention</p><p className="font-medium">{load.free_detention_hours || 0} hrs</p></div>
            <div><p className="text-muted-foreground">Billable hours</p><p className="font-medium">{Number(load.billable_hours || 0).toFixed(2)} hrs</p></div>
            <div><p className="text-muted-foreground">Rate</p><p className="font-medium">${load.contract_rate || load.detention_rate_per_hour || 0}/hr</p></div>
          </div>
        </Card>
      )}

      {/* Claim Timeline */}
      <Card className="p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Claim Timeline</h2>
        <ClaimTimeline claim={claim} />
      </Card>

      {/* Email */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Claim Email</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={!load}>
              <FileDown className="w-4 h-4 mr-1.5" /> PDF
            </Button>
            {claim.email_body && (
              <Button variant="outline" size="sm" onClick={copyEmail}>
                {copied ? <><Check className="w-4 h-4 mr-1.5" /> Copied</> : <><Copy className="w-4 h-4 mr-1.5" /> Copy</>}
              </Button>
            )}
          </div>
        </div>

        {!claim.email_body ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <p className="font-medium">No email generated yet.</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">Let AI draft a professional detention claim email with all your load details.</p>
            <Button onClick={generateEmail} disabled={generating || !load} className="mt-5">
              <Sparkles className="w-4 h-4 mr-1.5" /> {generating ? "Generating…" : "Generate professional claim email"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Subject</p>
              <p className="font-medium p-3 rounded-lg bg-muted/50 border border-border">{claim.email_subject}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Body</p>
              <pre className="font-body whitespace-pre-wrap text-sm p-4 rounded-lg bg-muted/50 border border-border leading-relaxed">{claim.email_body}</pre>
            </div>
            <div className="flex flex-col gap-3 pt-2">
              <div>
                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Mail className="w-3 h-3" /> Broker contact email</p>
                <Input
                  type="email"
                  value={brokerEmail}
                  onChange={(e) => setBrokerEmail(e.target.value)}
                  placeholder="broker@company.com"
                  className="max-w-md"
                />
              </div>
              <div className="flex flex-wrap gap-2">
              <Button onClick={generateEmail} variant="outline" size="sm" disabled={generating}>
                <Sparkles className="w-4 h-4 mr-1.5" /> Regenerate
              </Button>
              {(claim.status === "ready_to_send" || claim.status === "generated" || claim.status === "sent") && (
                <Button size="sm" onClick={sendToBroker} disabled={sending}>
                  <Send className="w-4 h-4 mr-1.5" /> {sending ? "Sending…" : claim.status === "sent" ? "Resend" : "Approve & Send"}
                </Button>
              )}
              {["sent", "awaiting_response", "followup_required"].includes(claim.status) && (
                <>
                  <Button size="sm" variant="outline" onClick={generateReminder(7)} disabled={generating || claim.reminder_sent_7}>
                    <Clock className="w-4 h-4 mr-1.5" /> {claim.reminder_sent_7 ? "7-day sent" : "7-day follow-up"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={generateReminder(14)} disabled={generating || claim.reminder_sent_14}>
                    <Clock className="w-4 h-4 mr-1.5" /> {claim.reminder_sent_14 ? "14-day sent" : "14-day follow-up"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={generateReminder(30)} disabled={generating || claim.reminder_sent_30}>
                    <Clock className="w-4 h-4 mr-1.5" /> {claim.reminder_sent_30 ? "30-day sent" : "30-day escalation"}
                  </Button>
                </>
              )}
              <Button size="sm" variant="outline" onClick={() => updateStatus("approved")} className="text-emerald-400 hover:text-emerald-400">
                <CheckCircle className="w-4 h-4 mr-1.5" /> Approved
              </Button>
              <Button size="sm" variant="outline" onClick={() => updateStatus("paid", { paid_amount: claim.claim_amount || claim.approved_amount || 0 })} className="text-money hover:text-money">
                <CheckCircle className="w-4 h-4 mr-1.5" /> Mark paid
              </Button>
              <Button size="sm" variant="outline" onClick={() => updateStatus("denied")} className="text-red-400 hover:text-red-400">
                <XCircle className="w-4 h-4 mr-1.5" /> Denied
              </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      {claim.email_log && claim.email_log.length > 0 && (
        <Card className="p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Email Log</h2>
          <div className="space-y-2">
            {[...claim.email_log].reverse().map((e, i) => (
              <div key={i} className="flex items-start gap-3 text-sm border-b border-border/50 pb-2 last:border-0">
                <div className="mt-0.5">
                  {e.status === "delivered" ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <XCircle className="w-4 h-4 text-red-400" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{e.recipient}</span>
                    <span className="text-xs text-muted-foreground">{new Date(e.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-muted-foreground text-xs">{e.subject}</p>
                  {e.status === "failed" && e.message && <p className="text-red-400 text-xs mt-1">{e.message}</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {claim.last_loop_reply_body && (
        <Card className="p-6 border-l-4 border-l-blue-500">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">Broker Reply</h2>
          <p className="text-xs text-muted-foreground mb-2">
            {claim.broker_reply_received_at ? new Date(claim.broker_reply_received_at).toLocaleString() : ""} · from {claim.broker_contact_email || "broker"}
          </p>
          <p className="font-medium mb-2">{claim.last_loop_reply_subject || "(no subject)"}</p>
          <pre className="font-body whitespace-pre-wrap text-sm p-3 rounded-lg bg-muted/50 border border-border leading-relaxed">{claim.last_loop_reply_body}</pre>
        </Card>
      )}

      {claim.pending_reply_body && (
        <Card className="p-6 border-l-4 border-l-primary">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">AI Suggested Reply</h2>
            <Badge variant="secondary">Awaiting your approval</Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-1">Subject</p>
          <p className="font-medium p-3 rounded-lg bg-muted/50 border border-border mb-3">{claim.pending_reply_subject}</p>
          <p className="text-xs text-muted-foreground mb-1">Body</p>
          <pre className="font-body whitespace-pre-wrap text-sm p-3 rounded-lg bg-muted/50 border border-border leading-relaxed">{claim.pending_reply_body}</pre>
          <div className="flex flex-wrap gap-2 pt-3">
            <Button size="sm" onClick={sendReply} disabled={sendingReply}>
              <Send className="w-4 h-4 mr-1.5" /> {sendingReply ? "Sending…" : "Approve & Send Reply"}
            </Button>
            <Button size="sm" variant="outline" onClick={discardReply}>Discard</Button>
          </div>
        </Card>
      )}

      <EvidenceManager claimId={claim.id} />

      <ClaimDefense claim={claim} load={load} carrier={carrier} />

      <NegotiationPanel claim={claim} load={load} carrier={carrier} onClaimUpdate={setClaim} />

      <NegotiationLoop claim={claim} onClaimUpdate={setClaim} />
    </div>
  );
}
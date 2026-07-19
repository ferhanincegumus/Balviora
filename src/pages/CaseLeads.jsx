import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";

const STATUS = {
  new: "text-alert bg-alert/10",
  reviewing: "text-foreground bg-muted",
  won: "text-money bg-money/10",
  lost: "text-risk bg-risk/10",
  closed: "text-muted-foreground bg-muted",
};

// Admin workspace: inbound cases from the landing form. Customers never log in —
// they just receive SMS/WhatsApp updates. The founder works cases here and texts
// the customer directly from each card.
export default function CaseLeads() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState(null);
  const [msg, setMsg] = useState({});
  const [sending, setSending] = useState({});
  const [starting, setStarting] = useState({});

  const startRecovery = async (lead) => {
    setStarting({ ...starting, [lead.id]: true });
    try {
      const res = await base44.functions.invoke("startRecovery", { leadId: lead.id });
      navigate(`/claims/${res.data.claimId}`);
    } catch (e) {
      alert(e?.message || "Could not start recovery");
    } finally {
      setStarting({ ...starting, [lead.id]: false });
    }
  };

  const load = () =>
    base44.entities.CaseLead
      .list("-created_date", 50)
      .then(setLeads)
      .catch(() => setLeads([]));

  useEffect(() => {
    load();
  }, []);

  const send = async (lead) => {
    const m = (msg[lead.id] || "").trim();
    if (!m) return;
    setSending({ ...sending, [lead.id]: true });
    try {
      await base44.functions.invoke("sendCustomerMessage", {
        phone: lead.phone,
        message: m,
        leadId: lead.id,
      });
      setMsg({ ...msg, [lead.id]: "" });
      load();
    } catch (e) {
      alert(e?.message || "Send failed");
    } finally {
      setSending({ ...sending, [lead.id]: false });
    }
  };

  if (!leads) {
    return <div className="py-16 text-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight">Case leads</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Inbound cases from the landing form. Text customers from here — they get updates on their phone, no app.
        </p>
      </div>

      {leads.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center text-muted-foreground">
          No leads yet. They'll land here when someone submits the form on the landing page.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {leads.map((l) => (
            <div key={l.id} className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-lg">{l.name}</h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    STATUS[l.status] || STATUS.new
                  }`}
                >
                  {l.status}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {l.broker} · {l.hours}h waited · {l.phone}
              </p>
              {l.status === "new" && (
                <button
                  onClick={() => startRecovery(l)}
                  disabled={starting[l.id]}
                  className="mt-2 inline-flex items-center gap-1.5 bg-alert text-alert-foreground hover:bg-[#e69500] font-display font-bold uppercase tracking-[0.04em] text-xs px-3 py-1.5 rounded-lg disabled:opacity-60"
                >
                  {starting[l.id] ? "Opening…" : "Start recovery"}
                </button>
              )}
              {l.notes && (
                <p className="text-sm text-muted-foreground mt-2 italic">"{l.notes}"</p>
              )}
              {l.last_message_at && (
                <p className="text-xs text-muted-foreground/70 mt-2 font-mono">
                  Last message: {new Date(l.last_message_at).toLocaleString()}
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <input
                  value={msg[l.id] || ""}
                  onChange={(e) => setMsg({ ...msg, [l.id]: e.target.value })}
                  placeholder="Type an update to text them…"
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-alert"
                />
                <Button
                  size="sm"
                  disabled={sending[l.id]}
                  onClick={() => send(l)}
                  className="bg-alert text-alert-foreground hover:bg-alert/90"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
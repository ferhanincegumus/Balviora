import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Send, Trash2, ExternalLink, Mail } from "lucide-react";

// Triage queue for broker replies: claims where an AI-drafted reply is
// pending human approval. Owner approves & sends, discards, or opens the claim.
export default function BrokerReplyTriage() {
  const { toast } = useToast();
  const [claims, setClaims] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try {
      const all = await base44.entities.Claim.list("-updated_date", 200);
      setClaims(all.filter((c) => c.pending_reply_body));
    } catch {
      setClaims([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const approve = async (c) => {
    setBusyId(c.id);
    try {
      await base44.functions.invoke("sendClaimReply", { claimId: c.id });
      toast({ title: "Reply sent to broker" });
      await load();
    } catch (e) {
      toast({ title: "Send failed", description: e?.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const discard = async (c) => {
    setBusyId(c.id);
    try {
      await base44.entities.Claim.update(c.id, {
        pending_reply_subject: "",
        pending_reply_body: "",
        pending_reply_in_reply_to: "",
      });
      await load();
    } finally {
      setBusyId(null);
    }
  };

  if (!claims || claims.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Mail className="w-5 h-5 text-alert" />
        <h2 className="text-lg font-semibold">Broker replies awaiting you</h2>
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-alert/15 text-alert">{claims.length}</span>
      </div>
      {claims.map((c) => (
        <Card key={c.id} className="p-4 border-l-4 border-l-alert">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className="font-semibold">{c.load_number || "—"}</span>
            <span className="text-sm text-muted-foreground">· {c.broker_name || "—"}</span>
            {c.broker_reply_received_at && (
              <span className="text-xs text-muted-foreground">
                {new Date(c.broker_reply_received_at).toLocaleString()}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-1">Broker replied — AI drafted a response for your approval:</p>
          <p className="font-medium text-sm mb-1">{c.pending_reply_subject || "(no subject)"}</p>
          <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">{c.pending_reply_body}</p>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Button size="sm" onClick={() => approve(c)} disabled={busyId === c.id}>
              <Send className="w-4 h-4 mr-1.5" /> {busyId === c.id ? "Sending…" : "Approve & Send"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => discard(c)} disabled={busyId === c.id}>
              <Trash2 className="w-4 h-4 mr-1.5" /> Discard
            </Button>
            <Link to={`/claims/${c.id}`}>
              <Button size="sm" variant="ghost">
                <ExternalLink className="w-4 h-4 mr-1.5" /> Open claim
              </Button>
            </Link>
          </div>
        </Card>
      ))}
    </div>
  );
}
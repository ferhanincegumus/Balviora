import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { buildStrategy, buildNegotiationPrompt } from "@/lib/brokerNegotiation";
import { Truck, XCircle, CheckCircle, DollarSign, Sparkles } from "lucide-react";

const ACTIVE = ["sent", "awaiting_response", "followup_required"];

export default function BrokerResponseSimulator({ claim, load, carrier, onClaimUpdate }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(null);

  if (!claim) return null;

  const update = async (patch, label) => {
    setBusy(label);
    try {
      const updated = await base44.entities.Claim.update(claim.id, patch);
      onClaimUpdate(updated);
      toast({ title: "Broker response recorded", description: label });
    } catch {
      toast({ title: "Error", description: "Could not update claim.", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  // Once the broker has resolved (approved/paid/closed), the simulator's job is done.
  if (!ACTIVE.includes(claim.status) && claim.status !== "denied") return null;

  const amount = claim.claim_amount || 0;

  // Generate the AI counter-offer email, then simulate broker acceptance + payment.
  const counterOfferAndRecover = async () => {
    const label = "AI counter-offer sent, broker accepted & paid";
    setBusy(label);
    try {
      const workingClaim = { ...claim, broker_response: claim.broker_response, broker_offer_amount: claim.broker_offer_amount };
      const strategy = buildStrategy(workingClaim, load);
      const prompt = buildNegotiationPrompt(workingClaim, load, carrier, strategy);
      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: { subject: { type: "string" }, body: { type: "string" } },
        },
      });
      const updated = await base44.entities.Claim.update(claim.id, {
        email_subject: res.subject,
        email_body: res.body,
        last_loop_reply_subject: res.subject,
        last_loop_reply_body: res.body,
        negotiation_rounds: (claim.negotiation_rounds || 0) + 1,
        status: "paid",
        approved_amount: amount,
        paid_amount: amount,
        response_date: claim.response_date || new Date().toISOString(),
      });
      onClaimUpdate(updated);
      toast({ title: "Funds recovered", description: `AI counter-offer accepted — $${amount.toFixed(2)} paid.` });
    } catch {
      toast({ title: "Error", description: "Could not complete the counter-offer.", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const isDenied = claim.status === "denied";

  return (
    <Card className="p-5 border-l-4 border-l-amber-500">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center flex-shrink-0">
          <Truck className="w-5 h-5 text-amber-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Broker Response</h2>
          <p className="text-sm text-foreground mt-0.5">
            Simulate how the broker responds to move this claim through recovery. After a rejection, generate the AI counter-offer and recover funds in one step.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {!isDenied && (
          <Button
            variant="outline"
            size="sm"
            disabled={!!busy}
            onClick={() =>
              update(
                {
                  status: "denied",
                  broker_response:
                    "We are unable to approve this detention claim as submitted. Our records show the driver released the trailer within the free time window. Please provide signed BOL timestamp logs to dispute.",
                  denial_reason: "Driver released within free time window (per broker records)",
                  response_date: claim.response_date || new Date().toISOString(),
                },
                "Broker rejected the claim"
              )
            }
          >
            <XCircle className="w-4 h-4 mr-1.5 text-red-400" /> {busy === "Broker rejected the claim" ? "Saving…" : "Simulate rejection"}
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          disabled={!!busy}
          onClick={() =>
            update(
              {
                status: "approved",
                approved_amount: amount,
                response_date: claim.response_date || new Date().toISOString(),
              },
              "Broker approved full amount"
            )
          }
        >
          <CheckCircle className="w-4 h-4 mr-1.5 text-emerald-400" /> Approve full claim
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={!!busy}
          onClick={() =>
            update(
              {
                status: "paid",
                approved_amount: amount,
                paid_amount: amount,
                response_date: claim.response_date || new Date().toISOString(),
              },
              "Funds recovered — paid in full"
            )
          }
        >
          <DollarSign className="w-4 h-4 mr-1.5 text-emerald-400" /> Approve & mark paid
        </Button>

        {isDenied && (
          <Button
            size="sm"
            disabled={!!busy || !load}
            onClick={counterOfferAndRecover}
            className="bg-emerald-600 hover:bg-emerald-600/90 text-white"
          >
            <Sparkles className="w-4 h-4 mr-1.5" />
            {busy === "AI counter-offer sent, broker accepted & paid" ? "Generating…" : "Generate AI counter-offer & recover"}
          </Button>
        )}
      </div>
    </Card>
  );
}
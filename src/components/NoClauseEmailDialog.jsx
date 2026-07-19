import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Copy, Check } from "lucide-react";
import { generateNoClauseEmail } from "@/lib/rateConAnalysis";

// One-click AI-generated email asking the broker to add detention terms in
// writing. Reusable trigger (render-prop child) so it can sit on a load card
// or inside the rate-con analyzer.
export default function NoClauseEmailDialog({ load, children, onUpdated }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    let active = true;
    if (load?.no_clause_email_subject && load?.no_clause_email_body) {
      setEmail({ subject: load.no_clause_email_subject, body: load.no_clause_email_body });
      return;
    }
    setLoading(true);
    (async () => {
      try {
        let carrier = null;
        try {
          const profiles = await base44.entities.CarrierProfile.list();
          if (profiles.length) carrier = profiles[0];
        } catch {}
        const res = await generateNoClauseEmail({
          broker_name: load?.broker_name,
          load_number: load?.load_number,
          carrier,
        });
        if (!active) return;
        setEmail(res);
        try {
          const u = await base44.entities.Load.update(load.id, {
            no_clause_email_subject: res.subject,
            no_clause_email_body: res.body,
          });
          onUpdated?.(u);
        } catch {}
      } catch {
        toast({ title: "Could not generate email", variant: "destructive" });
        setOpen(false);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [open]);

  const copy = () => {
    navigator.clipboard.writeText(`Subject: ${email.subject}\n\n${email.body}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <span onClick={() => setOpen(true)} className="inline-flex cursor-pointer">
        {children}
      </span>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request detention terms in writing</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Generating email…</p>
        ) : email ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This rate con has no detention clause. Copy this and send it to {load?.broker_name || "your broker"} before accepting the load.
            </p>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Subject</p>
              <p className="font-medium p-3 rounded-lg bg-muted/50 border border-border">{email.subject}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Body</p>
              <pre className="font-body whitespace-pre-wrap text-sm p-4 rounded-lg bg-muted/50 border border-border leading-relaxed">{email.body}</pre>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={copy} disabled={!email}>
            {copied ? <><Check className="w-4 h-4 mr-1.5" /> Copied</> : <><Copy className="w-4 h-4 mr-1.5" /> Copy email</>}
          </Button>
          <Button onClick={() => setOpen(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
import React, { useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { UploadCloud, FileText, Sparkles, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { extractRateCon } from "@/lib/rateConAnalysis";
import NoClauseEmailDialog from "@/components/NoClauseEmailDialog";

// Rate Confirmation Analyzer: upload a PDF/image or paste text, the AI extracts
// strict JSON detention terms and saves them to the load. Shows a red warning
// with a one-click email if no detention clause exists.
export default function RateConAnalyzer({ load, onUpdated }) {
  const { toast } = useToast();
  const [mode, setMode] = useState("file");
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const fileInputRef = useRef(null);

  const analyzed = load?.detention_clause_exists === true || load?.detention_clause_exists === false;
  const hasClause = load?.detention_clause_exists === true;

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      let fileUrl = null;
      if (mode === "file") {
        if (!file) {
          toast({ title: "Select a rate con file", variant: "destructive" });
          setAnalyzing(false);
          return;
        }
        const up = await base44.integrations.Core.UploadFile({ file });
        fileUrl = up.file_url;
      } else {
        if (!text.trim()) {
          toast({ title: "Paste the rate con text", variant: "destructive" });
          setAnalyzing(false);
          return;
        }
      }

      const res = await extractRateCon({ fileUrl, text: mode === "text" ? text : null });

      const update = {
        detention_clause_exists: !!res.detention_clause_exists,
        notification_requirements: res.notification_requirements || "",
        claim_deadline: res.claim_deadline || "",
        required_documents: Array.isArray(res.required_documents) ? res.required_documents : [],
        clause_text: res.clause_text || "",
        rate_con_file_url: fileUrl || load.rate_con_file_url || "",
      };
      if (res.free_time_hours != null && !isNaN(Number(res.free_time_hours))) {
        update.free_detention_hours = Number(res.free_time_hours);
      }
      if (res.hourly_rate != null && !isNaN(Number(res.hourly_rate))) {
        update.detention_rate_per_hour = Number(res.hourly_rate);
        update.contract_rate = Number(res.hourly_rate);
      }

      const updated = await base44.entities.Load.update(load.id, update);
      onUpdated?.(updated);
      toast({
        title: res.detention_clause_exists ? "Detention clause found" : "No detention clause found",
        description: res.detention_clause_exists
          ? "Terms saved to this load."
          : "Send the broker a request for written terms before accepting.",
      });
    } catch {
      toast({ title: "Analysis failed", description: "Could not analyze the rate con. Try again.", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-primary" />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rate Confirmation Analyzer</p>
      </div>

      {/* Existing analysis summary */}
      {analyzed && (
        <div className="mb-4 space-y-2">
          <div className={`flex items-start gap-2 p-3 rounded-lg border ${hasClause ? "bg-emerald-500/10 border-emerald-500/30" : "bg-red-500/10 border-red-500/30"}`}>
            {hasClause ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />}
            <div className="text-sm">
              <p className={hasClause ? "text-emerald-400 font-medium" : "text-red-400 font-medium"}>
                {hasClause ? "Detention clause detected" : "No detention clause detected"}
              </p>
              <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>Free time: <strong className="text-foreground">{load.free_detention_hours ?? "—"} hrs</strong></span>
                <span>Rate: <strong className="text-foreground">${load.contract_rate ?? load.detention_rate_per_hour ?? "—"}/hr</strong></span>
                {load.claim_deadline && <span>Deadline: <strong className="text-foreground">{load.claim_deadline}</strong></span>}
                {(load.required_documents || []).length > 0 && <span>Docs: <strong className="text-foreground">{load.required_documents.join(", ")}</strong></span>}
              </div>
              {hasClause && load.clause_text && (
                <p className="mt-2 text-xs italic text-muted-foreground border-l-2 border-border pl-2">{load.clause_text}</p>
              )}
              {load.notification_requirements && (
                <p className="mt-1 text-xs text-amber-400">⚠ Notify: {load.notification_requirements}</p>
              )}
            </div>
          </div>

          {!hasClause && (
            <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
              <p className="text-xs text-muted-foreground">Get detention terms in writing before accepting this load.</p>
              <NoClauseEmailDialog load={load} onUpdated={onUpdated}>
                <Button size="sm" variant="outline" className="h-7 text-xs border-red-500/40 text-red-400 hover:text-red-400">
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Email broker
                </Button>
              </NoClauseEmailDialog>
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 mb-3 w-fit">
        {["file", "text"].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${mode === m ? "bg-background text-foreground shadow" : "text-muted-foreground"}`}
          >
            {m === "file" ? "Upload file" : "Paste text"}
          </button>
        ))}
      </div>

      {mode === "file" ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-border rounded-lg p-5 text-center cursor-pointer hover:border-primary/50 transition-colors"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <UploadCloud className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
          {file ? (
            <p className="text-sm font-medium">{file.name}</p>
          ) : (
            <p className="text-sm text-muted-foreground">Drop or click to upload a rate con (PDF or image)</p>
          )}
        </div>
      ) : (
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste the rate confirmation text here…"
          rows={5}
        />
      )}

      <Button onClick={handleAnalyze} disabled={analyzing} className="w-full mt-3" size="sm">
        {analyzing ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Analyzing…</> : <><Sparkles className="w-4 h-4 mr-1.5" /> Analyze rate con</>}
      </Button>
    </Card>
  );
}
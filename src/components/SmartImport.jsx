import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Camera, Upload, Sparkles, Loader2, CheckCircle2, FileText } from "lucide-react";

export default function SmartImport({ onExtract }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState(null);
  const photoRef = useRef(null);
  const fileRef = useRef(null);

  const handle = async (file) => {
    if (!file) return;
    setBusy(true);
    setDone(false);
    setFileName(file.name);
    setPreview(file.type.startsWith("image/") ? URL.createObjectURL(file) : null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an expert freight document parser. Extract load details from this document — it may be a Bill of Lading, rate confirmation, Proof of Delivery, gate pass, or a photo of a dock receipt.

Return ONLY the JSON object. Rules:
- For any field not present in the document, return an empty string ("").
- For times, return ISO 8601 in the format YYYY-MM-DDTHH:mm (24h). If only a time is visible with no date, assume today's date. If the date is partial, do your best.
- free_detention_hours and detention_rate_per_hour: return numbers (e.g. 2 and 50). Use 0 if not found.`,
        response_json_schema: {
          type: "object",
          properties: {
            broker_name: { type: "string" },
            customer_name: { type: "string" },
            load_number: { type: "string" },
            pickup_location: { type: "string" },
            delivery_location: { type: "string" },
            appointment_time: { type: "string" },
            arrival_time: { type: "string" },
            departure_time: { type: "string" },
            free_detention_hours: { type: "number" },
            detention_rate_per_hour: { type: "number" },
          },
        },
        file_urls: [file_url],
      });
      onExtract(res);
      setDone(true);
      toast({
        title: "Document scanned",
        description: "Fields auto-filled — please review and correct anything that's off.",
      });
    } catch {
      toast({
        title: "Scan failed",
        description: "Could not read the document. Try a clearer photo or a text-based PDF.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
      if (photoRef.current) photoRef.current.value = "";
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Card className="p-6 border-primary/30 bg-primary/5">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Smart Import</h2>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Snap a photo of your BOL or rate confirmation, or upload a PDF — we'll fill in the fields for you.
      </p>

      {busy ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          {preview ? (
            <img src={preview} alt="Scanning" className="w-24 h-24 object-cover rounded-lg mb-3 ring-2 ring-primary" />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mb-3">
              <FileText className="w-6 h-6 text-primary" />
            </div>
          )}
          <Loader2 className="w-5 h-5 animate-spin text-primary mb-2" />
          <p className="text-sm font-medium">Scanning {fileName || "document"}…</p>
          <p className="text-xs text-muted-foreground">Reading text and extracting fields.</p>
        </div>
      ) : done ? (
        <div className="flex items-center gap-3 py-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Fields auto-filled below</p>
            <p className="text-xs text-muted-foreground">Review and edit anything, then save.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setDone(false); setPreview(null); setFileName(null); }}>
            Scan another
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          <Button variant="default" className="h-auto py-4 flex-col gap-1.5" onClick={() => photoRef.current?.click()}>
            <Camera className="w-5 h-5" />
            <span className="text-sm font-medium">Take photo</span>
            <span className="text-[11px] opacity-80">BOL / receipt / gate pass</span>
          </Button>
          <Button variant="outline" className="h-auto py-4 flex-col gap-1.5" onClick={() => fileRef.current?.click()}>
            <Upload className="w-5 h-5" />
            <span className="text-sm font-medium">Upload file</span>
            <span className="text-[11px] opacity-70">PDF or image</span>
          </Button>
        </div>
      )}

      <input
        ref={photoRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0])}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => handle(e.target.files?.[0])}
      />
    </Card>
  );
}
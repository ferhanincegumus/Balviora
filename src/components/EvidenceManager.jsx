import React, { useEffect, useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { Paperclip, FileText, Mail, Trash2, Upload, Plus, X, CheckCircle, FolderArchive } from "lucide-react";

const TYPES = [
  { value: "bol", label: "BOL", icon: FileText, hint: "Bill of Lading" },
  { value: "pod", label: "POD", icon: CheckCircle, hint: "Proof of Delivery" },
  { value: "email_thread", label: "Email Thread", icon: Mail, hint: "Broker correspondence" },
  { value: "other", label: "Other", icon: Paperclip, hint: "Any other proof" },
];

const TYPE_STYLE = {
  bol: "bg-blue-500/15 text-blue-400",
  pod: "bg-emerald-500/15 text-emerald-400",
  email_thread: "bg-amber-500/15 text-amber-400",
  other: "bg-muted text-muted-foreground",
};

function guessType(name) {
  const n = (name || "").toLowerCase();
  if (n.includes("bol") || n.includes("lading")) return "bol";
  if (n.includes("pod") || n.includes("delivery")) return "pod";
  if (/\.(eml|msg)$/.test(n)) return "email_thread";
  return "other";
}

function typeMeta(value) {
  return TYPES.find((t) => t.value === value) || TYPES[3];
}

export default function EvidenceManager({ claimId }) {
  const { toast } = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showThread, setShowThread] = useState(false);
  const [thread, setThread] = useState({ subject: "", content: "", notes: "" });
  const [openItem, setOpenItem] = useState(null);
  const fileRef = useRef(null);

  const load = async () => {
    try {
      const list = await base44.entities.Evidence.filter({ claim_id: claimId }, "-uploaded_at");
      setItems(list);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!claimId) return;
    setLoading(true);
    load();
  }, [claimId]);

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const f of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
        await base44.entities.Evidence.create({
          claim_id: claimId,
          type: guessType(f.name),
          file_url,
          filename: f.name,
          uploaded_at: new Date().toISOString(),
        });
      }
      toast({ title: "Evidence uploaded", description: `${files.length} file(s) added to this claim.` });
      await load();
    } catch {
      toast({ title: "Upload failed", description: "Could not upload the file. Try again.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const saveThread = async () => {
    if (!thread.content.trim()) {
      toast({ title: "Thread is empty", description: "Paste the email thread content first.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      await base44.entities.Evidence.create({
        claim_id: claimId,
        type: "email_thread",
        email_subject: thread.subject,
        content: thread.content,
        notes: thread.notes,
        uploaded_at: new Date().toISOString(),
      });
      setThread({ subject: "", content: "", notes: "" });
      setShowThread(false);
      toast({ title: "Email thread saved" });
      await load();
    } catch {
      toast({ title: "Save failed", description: "Could not save the thread.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const remove = async (item) => {
    try {
      await base44.entities.Evidence.delete(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      if (openItem === item.id) setOpenItem(null);
      toast({ title: "Evidence removed" });
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  const counts = TYPES.reduce((acc, t) => {
    acc[t.value] = items.filter((i) => i.type === t.value).length;
    return acc;
  }, {});

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Evidence</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Upload BOLs, PODs, and email threads to prove detention time.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowThread((v) => !v)} disabled={uploading}>
            <Mail className="w-4 h-4 mr-1.5" /> {showThread ? "Cancel" : "Paste email"}
          </Button>
          <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            <Upload className="w-4 h-4 mr-1.5" /> {uploading ? "Uploading…" : "Upload file"}
          </Button>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={onFiles}
            accept="image/*,.pdf,.eml,.msg,.txt,.doc,.docx,.html"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        {TYPES.map((t) => (
          <div key={t.value} className="rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <span className={`w-7 h-7 rounded-md flex items-center justify-center ${TYPE_STYLE[t.value]}`}>
                <t.icon className="w-4 h-4" />
              </span>
              <div>
                <p className="text-xs font-medium leading-none">{t.label}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{t.hint}</p>
              </div>
            </div>
            <p className="text-xl font-bold mt-2">{counts[t.value] || 0}</p>
          </div>
        ))}
      </div>

      {showThread && (
        <div className="rounded-lg border border-border bg-muted/30 p-4 mb-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Paste email thread</p>
            <button onClick={() => setShowThread(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>
          <Input
            placeholder="Email subject (optional)"
            value={thread.subject}
            onChange={(e) => setThread((s) => ({ ...s, subject: e.target.value }))}
          />
          <Textarea
            placeholder="Paste the full email thread here…"
            rows={6}
            value={thread.content}
            onChange={(e) => setThread((s) => ({ ...s, content: e.target.value }))}
          />
          <Input
            placeholder="Notes (optional)"
            value={thread.notes}
            onChange={(e) => setThread((s) => ({ ...s, notes: e.target.value }))}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={saveThread} disabled={uploading}>
              <Plus className="w-4 h-4 mr-1.5" /> Save thread
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-6">Loading evidence…</p>
      ) : items.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-border rounded-lg">
          <FolderArchive className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium">No evidence attached yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Upload BOLs, PODs, or paste broker email threads.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const meta = typeMeta(item.type);
            const expanded = openItem === item.id;
            return (
              <li key={item.id} className="rounded-lg border border-border bg-card p-3">
                <div className="flex items-center gap-3">
                  <span className={`w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 ${TYPE_STYLE[item.type]}`}>
                    <meta.icon className="w-4 h-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {item.filename || item.email_subject || "Email thread"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {meta.label}
                      {item.uploaded_at ? ` · ${format(new Date(item.uploaded_at), "MMM d, yyyy")}` : ""}
                    </p>
                  </div>
                  {item.type === "email_thread" && (
                    <Button variant="ghost" size="sm" onClick={() => setOpenItem(expanded ? null : item.id)}>
                      {expanded ? "Hide" : "View"}
                    </Button>
                  )}
                  {item.file_url && (
                    <a href={item.file_url} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
                      Open
                    </a>
                  )}
                  <button
                    onClick={() => remove(item)}
                    className="text-muted-foreground hover:text-red-400 p-1"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {expanded && item.content && (
                  <pre className="mt-3 text-xs whitespace-pre-wrap bg-muted/40 border border-border rounded-md p-3 max-h-64 overflow-auto font-body">
                    {item.content}
                  </pre>
                )}
                {item.notes && (
                  <p className="text-xs text-muted-foreground mt-2 pl-1">{item.notes}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
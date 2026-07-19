import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import StatusBadge from "@/components/StatusBadge";
import ScoreBadge from "@/components/ScoreBadge";
import { computeScore } from "@/lib/claimScore";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, FileText, Search, Pencil, Trash2, ExternalLink } from "lucide-react";
import { useSidePanel } from "@/components/panels/SidePanelContext";

const STATUSES = [
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

export default function Claims() {
  const { openPanel } = useSidePanel();
  const [claims, setClaims] = useState(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState({ claim_amount: "", status: "draft" });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const refresh = () => base44.entities.Claim.list("-updated_date", 100).then(setClaims).catch(() => setClaims([]));
  useEffect(() => { refresh(); }, []);

  const filtered = claims
    ? claims.filter(
        (c) =>
          (c.load_number || "").toLowerCase().includes(query.toLowerCase()) ||
          (c.broker_name || "").toLowerCase().includes(query.toLowerCase())
      )
    : [];

  const openEdit = (c) => {
    setEditing(c);
    setEditForm({ claim_amount: String(c.claim_amount ?? ""), status: c.status || "draft" });
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await base44.entities.Claim.update(editing.id, {
        claim_amount: Number(editForm.claim_amount) || 0,
        status: editForm.status,
      });
      toast({ title: "Claim updated" });
      setEditing(null);
      refresh();
    } catch {
      toast({ title: "Error", description: "Could not update claim.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (claimId) => {
    try {
      await base44.entities.Claim.delete(claimId);
      setClaims((prev) => (prev || []).filter((c) => c.id !== claimId));
      toast({ title: "Claim deleted" });
    } catch {
      toast({ title: "Error", description: "Could not delete claim.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Claims</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage and track all your detention claims.</p>
        </div>
        <Link to="/loads/new">
          <Button><Plus className="w-4 h-4 mr-1.5" /> New load</Button>
        </Link>
      </div>

      {claims && claims.length > 0 && (
        <div className="relative max-w-xs">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search load # or broker…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9" />
        </div>
      )}

      {claims === null ? (
        <Card className="p-10 text-center text-muted-foreground">Loading claims…</Card>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
            <FileText className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="font-medium">{query ? "No matching claims." : "No claims yet."}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {query ? "Try a different search." : "Add a load to create your first claim."}
          </p>
          {!query && (
            <Link to="/loads/new" className="inline-block mt-5">
              <Button><Plus className="w-4 h-4 mr-1.5" /> Add a load</Button>
            </Link>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Load #</th>
                  <th className="px-4 py-3 font-medium">Broker</th>
                  <th className="px-4 py-3 font-medium text-right">Claim</th>
                  <th className="px-4 py-3 font-medium">Success</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3 font-medium">
                      <button onClick={() => openPanel("claim", { id: c.id }, { title: `Claim ${c.load_number || ""}` })} className="hover:text-primary text-left">
                        {c.load_number || "—"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.broker_name ? (
                        <button onClick={() => openPanel("broker", { brokerName: c.broker_name }, { title: c.broker_name })} className="hover:text-primary text-left">
                          {c.broker_name}
                        </button>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">${(c.claim_amount || 0).toLocaleString()}</td>
                    <td className="px-4 py-3"><ScoreBadge score={computeScore(c)} /></td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link to={`/claims/${c.id}`}>
                          <Button variant="ghost" size="sm" className="px-2" title="Open claim detail">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="sm" className="px-2" onClick={() => openEdit(c)} title="Quick edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="px-2 text-red-400 hover:text-red-400">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this claim?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Claim for {c.load_number || "this load"} will be permanently removed. The load record stays.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(c.id)} className="bg-destructive hover:bg-destructive">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit claim{editing ? ` — ${editing.load_number || ""}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-1.5 block">Claim amount ($)</Label>
              <Input type="number" value={editForm.claim_amount} onChange={(e) => setEditForm((f) => ({ ...f, claim_amount: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1.5 block">Status</Label>
              <Select value={editForm.status} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
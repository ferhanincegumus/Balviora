import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Package, Clock, DollarSign, Pencil, Trash2, Upload, AlertTriangle } from "lucide-react";
import { useSidePanel } from "@/components/panels/SidePanelContext";
import NoClauseEmailDialog from "@/components/NoClauseEmailDialog";

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim() !== "");
  if (lines.length < 2) return { headers: [], rows: [] };
  const parseLine = (line) => {
    const out = []; let cur = ""; let q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { q = !q; continue; }
      if (ch === "," && !q) { out.push(cur); cur = ""; continue; }
      cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

export default function Loads() {
  const { openPanel } = useSidePanel();
  const [loads, setLoads] = useState(null);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState(null);
  const fileRef = useRef(null);
  const { toast } = useToast();

  const refresh = () => base44.entities.Load.list("-updated_date", 100).then(setLoads).catch(() => setLoads([]));
  useEffect(() => { refresh(); }, []);

  const handleDelete = async (loadId) => {
    try {
      const linked = await base44.entities.Claim.filter({ load_id: loadId });
      for (const c of linked) await base44.entities.Claim.delete(c.id);
      await base44.entities.Load.delete(loadId);
      setLoads((prev) => (prev || []).filter((l) => l.id !== loadId));
      toast({ title: "Load deleted", description: "The load and its linked claim were removed." });
    } catch {
      toast({ title: "Error", description: "Could not delete the load.", variant: "destructive" });
    }
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const { headers, rows } = parseCSV(text);
      const idx = (name) => headers.findIndex((h) => h.toLowerCase() === name);
      const iBroker = idx("broker_name");
      const iLoad = idx("load_number");
      const iArr = idx("arrival_time");
      const iDep = idx("departure_time");
      const iFree = idx("free_detention_hours");
      const iRate = idx("detention_rate_per_hour");

      const loadsToCreate = [];
      const errors = [];
      rows.forEach((r, n) => {
        const rowNum = n + 2;
        const broker = r[iBroker];
        const loadNo = r[iLoad];
        const arr = r[iArr];
        const dep = r[iDep];
        const free = Number(r[iFree]) || 0;
        const rate = Number(r[iRate]) || 0;
        if (!broker || !loadNo || !arr || !dep) { errors.push(`Row ${rowNum}: missing required fields`); return; }
        const a = new Date(arr);
        const d = new Date(dep);
        if (isNaN(a) || isNaN(d) || d <= a) { errors.push(`Row ${rowNum}: invalid arrival/departure times`); return; }
        const totalWait = (d - a) / (1000 * 60 * 60);
        const billable = Math.max(0, totalWait - free);
        const claim = billable * rate;
        if (claim <= 0) { errors.push(`Row ${rowNum}: claim amount is $0`); return; }
        loadsToCreate.push({
          broker_name: broker, load_number: loadNo, arrival_time: arr, departure_time: dep,
          free_detention_hours: free, detention_rate_per_hour: rate,
          total_wait_hours: Number(totalWait.toFixed(2)), billable_hours: Number(billable.toFixed(2)),
          claim_amount: Number(claim.toFixed(2)),
        });
      });

      if (loadsToCreate.length === 0) {
        setSummary({ imported: 0, errors });
      } else {
        const created = await base44.entities.Load.bulkCreate(loadsToCreate);
        await base44.entities.Claim.bulkCreate(
          created.map((l) => ({
            load_id: l.id, broker_name: l.broker_name, load_number: l.load_number,
            status: "draft", claim_amount: l.claim_amount,
          }))
        );
        setSummary({ imported: created.length, errors });
        refresh();
      }
    } catch {
      toast({ title: "Error", description: "Could not read the CSV file.", variant: "destructive" });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Loads</h1>
          <p className="text-sm text-muted-foreground mt-1">All loads with detention details.</p>
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
            <Upload className="w-4 h-4 mr-1.5" /> {importing ? "Importing…" : "Bulk import CSV"}
          </Button>
          <Link to="/loads/new">
            <Button><Plus className="w-4 h-4 mr-1.5" /> Add load</Button>
          </Link>
        </div>
      </div>

      {loads === null ? (
        <Card className="p-10 text-center text-muted-foreground">Loading loads…</Card>
      ) : loads.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Package className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="font-medium">No loads yet.</p>
          <p className="text-sm text-muted-foreground mt-1">Add your first load or import a CSV to start recovering detention pay.</p>
          <div className="flex items-center justify-center gap-2 mt-5">
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>
              <Upload className="w-4 h-4 mr-1.5" /> Import CSV
            </Button>
            <Link to="/loads/new">
              <Button><Plus className="w-4 h-4 mr-1.5" /> Add your first load</Button>
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-4">
            CSV columns: broker_name, load_number, arrival_time, departure_time, free_detention_hours, detention_rate_per_hour
          </p>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {loads.map((l) => (
            <Card key={l.id} className="p-5 flex flex-col hover:border-primary/50 transition-colors">
              <button
                onClick={() => openPanel("load", { id: l.id }, { title: `Load ${l.load_number || ""}` })}
                className="flex items-start justify-between mb-3 text-left"
              >
                <div>
                  <p className="font-semibold text-foreground">{l.load_number || "—"}</p>
                  <p className="text-sm text-muted-foreground">{l.broker_name || "—"}</p>
                </div>
                <span className="text-lg font-bold text-primary">${(l.claim_amount || 0).toLocaleString()}</span>
              </button>
              {l.detention_clause_exists === false && (
                <div className="mb-3 p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-red-400">No detention clause</p>
                    <p className="text-[11px] text-muted-foreground leading-tight">Get terms in writing before accepting.</p>
                  </div>
                  <NoClauseEmailDialog load={l} onUpdated={refresh}>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-red-500/40 text-red-400 hover:text-red-400">Email broker</Button>
                  </NoClauseEmailDialog>
                </div>
              )}
              <div className="space-y-1.5 text-sm text-muted-foreground flex-1">
                {l.pickup_location && l.delivery_location && (
                  <p className="truncate">{l.pickup_location} → {l.delivery_location}</p>
                )}
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {Number(l.billable_hours || 0).toFixed(1)}h billable</span>
                  <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> ${l.detention_rate_per_hour || 0}/hr</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border flex items-center gap-2">
                <Link to={`/loads/${l.id}/edit`}>
                  <Button variant="outline" size="sm"><Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit</Button>
                </Link>
                <Link to="/claims" className="text-sm text-primary hover:underline ml-auto">Claim →</Link>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-400 px-2">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this load?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Load {l.load_number} and its linked claim will be permanently removed. This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(l.id)} className="bg-destructive hover:bg-destructive">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Import summary */}
      <Dialog open={!!summary} onOpenChange={(o) => !o && setSummary(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import summary</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <p>
              <span className="font-medium text-emerald-400">{summary?.imported || 0}</span> loads imported successfully.
            </p>
            {summary?.errors?.length > 0 ? (
              <div>
                <p className="text-muted-foreground mb-1">{summary.errors.length} row(s) skipped:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 max-h-48 overflow-auto">
                  {summary.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            ) : (
              <p className="text-muted-foreground">No errors.</p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setSummary(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
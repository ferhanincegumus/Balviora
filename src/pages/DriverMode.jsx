import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Navigation, Square, Camera, Check, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { enqueue, getAll, remove } from "@/lib/offlineQueue";
import DriverAccrualCard from "@/components/DriverAccrualCard";

// Driver lite mode — mobile-only. Sees ONLY the assigned load.
// Three functions: Arrived/Departed stamps, camera-first document upload,
// and missing-document alerts. Never shows amounts, emails, or negotiations.
const REQUIRED = [
  { key: "bol", label: "Bill of Lading (BOL)" },
  { key: "pod", label: "Proof of Delivery (POD)" },
  { key: "sheet", label: "Signed in/out sheet" },
];

function typeFor(filename) {
  if (/pod/i.test(filename)) return "pod";
  if (/bol|bill\s*of\s*lading/i.test(filename)) return "bol";
  return "other";
}

export default function DriverMode() {
  const { user } = useAuth();
  const [load, setLoad] = useState(undefined);
  const [claim, setClaim] = useState(null);
  const [evidences, setEvidences] = useState([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const { toast } = useToast();

  const loadAll = async () => {
    if (!user) return;
    const myLoads = await base44.entities.Load.filter({ driver_user_id: user.id }).catch(() => []);
    const active = myLoads.find((l) => !l.departure_time) || myLoads[0] || null;
    setLoad(active);
    if (active) {
      const claims = await base44.entities.Claim.filter({ load_id: active.id }).catch(() => []);
      const c = claims[0] || null;
      setClaim(c);
      if (c) {
        const evs = await base44.entities.Evidence.filter({ claim_id: c.id }).catch(() => []);
        setEvidences(evs);
      } else {
        setEvidences([]);
      }
    } else {
      setClaim(null);
      setEvidences([]);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const flushQueue = async () => {
    const items = await getAll().catch(() => []);
    for (const item of items) {
      try {
        if (item.kind === "load_update") {
          await base44.entities.Load.update(item.loadId, item.patch);
        } else if (item.kind === "evidence_upload") {
          const { file_url } = await base44.integrations.Core.UploadFile({ file: item.blob });
          await base44.entities.Evidence.create({
            claim_id: item.claimId,
            type: item.type,
            file_url,
            filename: item.filename,
            uploaded_at: new Date().toISOString(),
          });
        }
        await remove(item.id);
      } catch {
        break;
      }
    }
    await loadAll();
  };

  useEffect(() => {
    const onOnline = () => {
      flushQueue();
      toast({ title: "Back online — syncing" });
    };
    window.addEventListener("online", onOnline);
    if (navigator.onLine) flushQueue();
    return () => window.removeEventListener("online", onOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const arrived = async () => {
    if (!load) return;
    setBusy(true);
    try {
      const patch = { arrival_time: new Date().toISOString() };
      if (!navigator.onLine) {
        await enqueue({ kind: "load_update", loadId: load.id, patch });
        toast({ title: "Saved — will sync when you're back online" });
      } else {
        await base44.entities.Load.update(load.id, patch);
      }
      await loadAll();
    } finally {
      setBusy(false);
    }
  };

  const departed = async () => {
    if (!load) return;
    setBusy(true);
    try {
      const patch = { departure_time: new Date().toISOString() };
      if (!navigator.onLine) {
        await enqueue({ kind: "load_update", loadId: load.id, patch });
        toast({ title: "Saved — will sync when you're back online" });
      } else {
        await base44.entities.Load.update(load.id, patch);
      }
      await loadAll();
    } finally {
      setBusy(false);
    }
  };

  const onFiles = async (files) => {
    if (!claim || !files.length) return;
    setUploading(true);
    try {
      if (!navigator.onLine) {
        for (const file of files) {
          await enqueue({
            kind: "evidence_upload",
            claimId: claim.id,
            filename: file.name,
            type: typeFor(file.name),
            blob: file,
          });
        }
        toast({ title: "Saved — will sync when you're back online" });
      } else {
        for (const file of files) {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          await base44.entities.Evidence.create({
            claim_id: claim.id,
            type: typeFor(file.name),
            file_url,
            filename: file.name,
            uploaded_at: new Date().toISOString(),
          });
        }
      }
      await loadAll();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const hasDoc = (key) => {
    if (key === "sheet") return evidences.some((e) => e.type === "other" && /sheet|in.?out/i.test(e.filename || ""));
    return evidences.some((e) => e.type === key);
  };

  if (!user) return null;

  if (load === undefined) {
    return (
      <div className="min-h-screen p-6 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (load === null) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <p className="font-display font-bold text-2xl">No load assigned yet</p>
          <p className="text-muted-foreground mt-2">Ask your dispatcher to assign you a load.</p>
          <Button variant="outline" className="mt-6" onClick={() => base44.auth.logout("/login")}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  const departedAt = load.departure_time ? new Date(load.departure_time) : null;
  const overdueDocs =
    !!departedAt && Date.now() - departedAt.getTime() > 3600000 && REQUIRED.some((d) => !hasDoc(d.key));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-16 flex items-center justify-between px-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-foreground text-background flex items-center justify-center font-display font-bold">
            DS
          </div>
          <span className="font-display font-bold">Detention Shield</span>
        </div>
        <button onClick={() => base44.auth.logout("/login")} className="text-sm text-muted-foreground">
          Sign out
        </button>
      </header>

      <main className="flex-1 p-4 space-y-6 max-w-md w-full mx-auto">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Load</p>
          <p className="font-display font-bold text-xl mt-0.5">{load.load_number || "—"}</p>
          <p className="text-sm text-muted-foreground mt-1">{load.broker_name || "—"}</p>
          <p className="text-sm text-muted-foreground">
            {load.pickup_location || ""} → {load.delivery_location || ""}
          </p>
        </div>

        {/* Arrived / Departed */}
        <div className="space-y-3">
          {!load.arrival_time ? (
            <Button onClick={arrived} disabled={busy} className="w-full h-20 text-xl font-semibold">
              <Navigation className="w-6 h-6 mr-2" /> Arrived
            </Button>
          ) : !load.departure_time ? (
            <>
              <DriverAccrualCard load={load} />
              <Button
                onClick={departed}
                disabled={busy}
                variant="outline"
                className="w-full h-20 text-xl font-semibold"
              >
                <Square className="w-5 h-5 mr-2" /> Departed
              </Button>
            </>
          ) : (
            <div className="rounded-xl border border-money/40 bg-money/10 p-4 text-center">
              <Check className="w-6 h-6 text-money mx-auto" />
              <p className="font-medium text-money mt-1">Load complete</p>
            </div>
          )}
          {load.arrival_time && (
            <p className="text-xs text-muted-foreground text-center">
              Arrived {new Date(load.arrival_time).toLocaleString()}
              {load.departure_time && ` · Departed ${new Date(load.departure_time).toLocaleString()}`}
            </p>
          )}
        </div>

        {/* Documents */}
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Documents</p>
          {claim ? (
            <>
              {overdueDocs && (
                <div className="rounded-lg border border-risk/40 bg-risk/10 p-3 flex items-start gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-risk shrink-0 mt-0.5" />
                  <p className="text-sm text-risk">
                    Upload your missing documents — over 1 hour since departure.
                  </p>
                </div>
              )}
              <ul className="space-y-2.5 mb-4">
                {REQUIRED.map((d) => (
                  <li key={d.key} className="flex items-center gap-2.5 text-sm">
                    {hasDoc(d.key) ? (
                      <Check className="w-4 h-4 text-money" />
                    ) : (
                      <span className="w-4 h-4 rounded-full border border-muted-foreground/40" />
                    )}
                    <span className={hasDoc(d.key) ? "text-foreground" : "text-muted-foreground"}>{d.label}</span>
                  </li>
                ))}
              </ul>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={(e) => onFiles(Array.from(e.target.files))}
              />
              <Button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full h-14 text-base font-semibold"
              >
                <Camera className="w-5 h-5 mr-2" /> {uploading ? "Uploading…" : "Snap a document"}
              </Button>
              {evidences.length > 0 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  {evidences.length} document(s) uploaded
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Document upload opens once your dispatcher starts the claim.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
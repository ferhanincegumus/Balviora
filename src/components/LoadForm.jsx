import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Building2, User, FileText, MapPin, Clock, ArrowRight, Navigation,
  ChevronDown, ChevronUp, AlertTriangle, Check, Square, Copy, Mail,
} from "lucide-react";
import SmartImport from "@/components/SmartImport";
import LoadCaptureBar from "@/components/LoadCaptureBar";
import { extractRateCon, generateNoClauseEmail } from "@/lib/rateConAnalysis";

function calcDetention(arrival, departure, freeHours, rate) {
  if (!arrival || !departure) return null;
  const a = new Date(arrival);
  const d = new Date(departure);
  if (isNaN(a) || isNaN(d) || d <= a) return null;
  const totalWait = (d - a) / (1000 * 60 * 60);
  const free = Number(freeHours) || 0;
  const billable = Math.max(0, totalWait - free);
  const r = Number(rate) || 0;
  return { totalWait, billable, claim: billable * r };
}

const toInput = (iso) => (iso ? String(iso).slice(0, 16) : "");
const labelMap = { broker_name: "Broker name", load_number: "Load number", arrival_time: "Arrival time", departure_time: "Departure time" };

export default function LoadForm({ initialLoad, onSaved, mode = "office" }) {
  const { toast } = useToast();
  const isEdit = !!initialLoad;
  const isDriver = mode === "driver";
  const [saving, setSaving] = useState(false);
  const [captures, setCaptures] = useState([]);
  const [checkin, setCheckin] = useState(null);
  const [rateConText, setRateConText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [verdict, setVerdict] = useState(null);
  const [showManual, setShowManual] = useState(true);
  const [emailModal, setEmailModal] = useState(null);
  const [tick, setTick] = useState(0);

  const [form, setForm] = useState(
    isEdit
      ? {
          broker_name: initialLoad.broker_name || "",
          customer_name: initialLoad.customer_name || "",
          load_number: initialLoad.load_number || "",
          pickup_location: initialLoad.pickup_location || "",
          delivery_location: initialLoad.delivery_location || "",
          appointment_time: toInput(initialLoad.appointment_time),
          arrival_time: toInput(initialLoad.arrival_time),
          departure_time: toInput(initialLoad.departure_time),
          free_detention_hours: String(initialLoad.free_detention_hours ?? 2),
          detention_rate_per_hour: String(initialLoad.detention_rate_per_hour ?? 50),
          detention_clause_exists: initialLoad.detention_clause_exists ?? null,
          clause_text: initialLoad.clause_text || "",
          notification_requirements: initialLoad.notification_requirements || "",
          claim_deadline: initialLoad.claim_deadline || "",
          required_documents: initialLoad.required_documents || [],
        }
      : {
          broker_name: "", customer_name: "", load_number: "",
          pickup_location: "", delivery_location: "",
          appointment_time: "", arrival_time: "", departure_time: "",
          free_detention_hours: "2", detention_rate_per_hour: "50",
          detention_clause_exists: null, clause_text: "", notification_requirements: "",
          claim_deadline: "", required_documents: [],
        }
  );

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const formRef = useRef(null);
  const result = calcDetention(form.arrival_time, form.departure_time, form.free_detention_hours, form.detention_rate_per_hour);

  const requiredKeys = isDriver ? ["broker_name", "load_number", "arrival_time"] : ["broker_name", "load_number", "arrival_time", "departure_time"];
  const missing = Object.fromEntries(requiredKeys.map((k) => [k, !form[k]]));
  const errClass = (k) => (submitAttempted && missing[k] ? "border-destructive focus-visible:ring-destructive" : "");

  // Live detention clock — only ticks while arrived and not yet departed
  useEffect(() => {
    if (!form.arrival_time || form.departure_time) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [form.arrival_time, form.departure_time]);

  const arrivedAt = form.arrival_time ? new Date(form.arrival_time) : null;
  const departedAt = form.departure_time ? new Date(form.departure_time) : null;
  void tick;
  const liveNow = departedAt || new Date();
  const elapsedH = arrivedAt ? Math.max(0, (liveNow - arrivedAt) / 3600000) : 0;
  const freeH = Number(form.free_detention_hours) || 0;
  const rate = Number(form.detention_rate_per_hour) || 0;
  const remainingFreeMin = arrivedAt && !departedAt ? Math.max(0, (freeH - elapsedH) * 60) : null;
  const accruing = arrivedAt && elapsedH > freeH ? (elapsedH - freeH) * rate : 0;

  const mergeExtract = (res) => {
    if (!res) return;
    const toTime = (v) => (v ? toInput(v) : "");
    const toNum = (v) => (v !== "" && v != null ? String(v) : null);
    setForm((f) => ({
      ...f,
      broker_name: res.broker_name || f.broker_name,
      customer_name: res.customer_name || f.customer_name,
      load_number: res.load_number || f.load_number,
      pickup_location: res.pickup_location || f.pickup_location,
      delivery_location: res.delivery_location || f.delivery_location,
      appointment_time: toTime(res.appointment_time) || f.appointment_time,
      arrival_time: toTime(res.arrival_time) || f.arrival_time,
      departure_time: toTime(res.departure_time) || f.departure_time,
      free_detention_hours: toNum(res.free_detention_hours) || f.free_detention_hours,
      detention_rate_per_hour: toNum(res.detention_rate_per_hour) || f.detention_rate_per_hour,
    }));
  };

  const analyze = async () => {
    if (!rateConText.trim()) {
      toast({ title: "Paste your rate con first", variant: "destructive" });
      return;
    }
    setAnalyzing(true);
    try {
      const res = await extractRateCon({ text: rateConText });
      setVerdict(res);
      setForm((f) => ({
        ...f,
        detention_clause_exists: !!res.detention_clause_exists,
        free_detention_hours: res.free_time_hours != null ? String(res.free_time_hours) : f.free_detention_hours,
        detention_rate_per_hour: res.hourly_rate != null ? String(res.hourly_rate) : f.detention_rate_per_hour,
        notification_requirements: res.notification_requirements || "",
        clause_text: res.clause_text || "",
        claim_deadline: res.claim_deadline || "",
        required_documents: res.required_documents || [],
        broker_name: res.broker_name || f.broker_name,
      }));
    } catch {
      toast({ title: "Could not analyze", description: "Try again or enter terms manually.", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const emailBroker = async () => {
    setAnalyzing(true);
    try {
      const res = await generateNoClauseEmail({ broker_name: form.broker_name, load_number: form.load_number });
      setEmailModal(res);
    } catch {
      toast({ title: "Could not generate email", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  const stampArrivalNow = () => {
    const now = new Date().toISOString();
    if (!navigator.geolocation) {
      set("arrival_time", toInput(now));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setForm((f) => ({ ...f, arrival_time: toInput(now) }));
        setCheckin({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy });
        toast({ title: "Arrival stamped", description: `GPS: ${p.coords.latitude.toFixed(4)}, ${p.coords.longitude.toFixed(4)}` });
      },
      () => set("arrival_time", toInput(now)),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };
  const stampDepartedNow = () => set("departure_time", toInput(new Date().toISOString()));

  const handleSave = async () => {
    setSubmitAttempted(true);
    const getVal = (k) => {
      const el = formRef.current?.querySelector(`[name="${k}"]`);
      return el ? el.value : form[k];
    };
    const vals = {
      ...form,
      broker_name: getVal("broker_name"), customer_name: getVal("customer_name"),
      load_number: getVal("load_number"), pickup_location: getVal("pickup_location"),
      delivery_location: getVal("delivery_location"), appointment_time: getVal("appointment_time"),
      arrival_time: getVal("arrival_time"), departure_time: getVal("departure_time"),
      free_detention_hours: getVal("free_detention_hours"), detention_rate_per_hour: getVal("detention_rate_per_hour"),
    };
    setForm(vals);
    const missingNames = requiredKeys.filter((k) => !vals[k]).map((k) => labelMap[k]);
    if (missingNames.length > 0) {
      toast({ title: "Missing required fields", description: `Please fill in: ${missingNames.join(", ")}.`, variant: "destructive" });
      return;
    }
    const calc = calcDetention(vals.arrival_time, vals.departure_time, vals.free_detention_hours, vals.detention_rate_per_hour);
    if (!isDriver && (!calc || calc.claim <= 0)) {
      toast({ title: "No claim", description: "The calculated claim amount is $0. Check your times and contract terms.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...vals,
        free_detention_hours: Number(vals.free_detention_hours) || 0,
        detention_rate_per_hour: Number(vals.detention_rate_per_hour) || 0,
        contract_rate: Number(vals.detention_rate_per_hour) || 0,
        detention_clause_exists: vals.detention_clause_exists,
        clause_text: vals.clause_text,
        notification_requirements: vals.notification_requirements,
        claim_deadline: vals.claim_deadline,
        required_documents: vals.required_documents,
        total_wait_hours: calc ? Number(calc.totalWait.toFixed(2)) : 0,
        billable_hours: calc ? Number(calc.billable.toFixed(2)) : 0,
        claim_amount: calc ? Number(calc.claim.toFixed(2)) : 0,
      };
      if (isDriver && checkin) {
        payload.checkin_lat = checkin.lat;
        payload.checkin_lng = checkin.lng;
        payload.checkin_accuracy_m = Math.round(checkin.acc);
        payload.checkin_method = "manual_gps_stamp";
        payload.checkin_at = new Date().toISOString();
      }
      if (isEdit) {
        await base44.entities.Load.update(initialLoad.id, payload);
        try {
          const linked = await base44.entities.Claim.filter({ load_id: initialLoad.id });
          if (linked.length > 0) {
            await base44.entities.Claim.update(linked[0].id, {
              broker_name: vals.broker_name, load_number: vals.load_number, claim_amount: payload.claim_amount,
            });
          }
        } catch {}
        toast({ title: "Load updated", description: "The load and linked claim have been updated." });
      } else {
        const load = await base44.entities.Load.create(payload);
        const claim = await base44.entities.Claim.create({
          load_id: load.id, broker_name: vals.broker_name, load_number: vals.load_number,
          status: "draft", claim_amount: payload.claim_amount,
        });
        if (isDriver && captures.length) {
          for (const file of captures) {
            try {
              const { file_url } = await base44.integrations.Core.UploadFile({ file });
              const type = /pod/i.test(file.name) ? "pod" : /bol|bill\s*of\s*lading/i.test(file.name) ? "bol" : "other";
              await base44.entities.Evidence.create({ claim_id: claim.id, type, file_url, filename: file.name, uploaded_at: new Date().toISOString() });
            } catch {}
          }
        }
        toast(isDriver
          ? { title: "Load captured", description: `${captures.length} file(s) attached. Add departure later to finish the claim.` }
          : { title: "Load added", description: "A draft claim has been created. Generate your email next." });
      }
      onSaved();
    } catch (e) {
      toast({ title: "Error", description: "Could not save the load.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const inputFields = [
    { key: "broker_name", label: "Broker name", icon: Building2, required: true },
    { key: "customer_name", label: "Customer name", icon: User },
    { key: "load_number", label: "Load number", icon: FileText, required: true },
    { key: "pickup_location", label: "Pickup location", icon: MapPin },
    { key: "delivery_location", label: "Delivery location", icon: MapPin },
  ];
  const timeFields = [
    { key: "appointment_time", label: "Appointment time" },
    { key: "arrival_time", label: "Arrival time", required: true },
    { key: "departure_time", label: "Departure time", required: !isDriver },
  ];
  const contractFields = [
    { key: "free_detention_hours", label: "Free detention (hours)", type: "number" },
    { key: "detention_rate_per_hour", label: "Detention rate ($/hr)", type: "number" },
  ];

  const fmtClock = (mins) => {
    const m = Math.floor(mins);
    const s = Math.floor((mins - m) * 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div ref={formRef} className="space-y-6">
      {isDriver ? (
        <LoadCaptureBar files={captures} onAdd={(f) => setCaptures((c) => [...c, ...f])} onRemove={(i) => setCaptures((c) => c.filter((_, idx) => idx !== i))} />
      ) : (
        <>
          {/* Paste rate con / email */}
          <div className="rounded-xl border border-border bg-surface p-4">
            <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Paste rate con / email</Label>
            <textarea
              value={rateConText}
              onChange={(e) => setRateConText(e.target.value)}
              rows={4}
              placeholder="Paste the rate confirmation text or broker email here…"
              className="mt-2 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-base resize-y focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <Button onClick={analyze} disabled={analyzing} className="w-full h-12 mt-3 font-semibold">
              {analyzing ? "Analyzing…" : "Analyze for detention terms"}
            </Button>
            <div className="mt-3">
              <SmartImport onExtract={mergeExtract} />
            </div>
          </div>

          {/* Verdict banner */}
          {verdict && (
            verdict.detention_clause_exists ? (
              <div className="rounded-xl border border-money/40 bg-money/10 p-4 flex items-start gap-3">
                <Check className="w-5 h-5 text-money shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-money">Detention clause found</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {verdict.free_time_hours != null ? `${verdict.free_time_hours}h free` : "Free time not specified"}
                    {verdict.hourly_rate != null ? `, $${verdict.hourly_rate}/h` : ""}
                    {verdict.notification_requirements ? " — notify before free time ends" : ""}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-risk/40 bg-risk/10 p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-risk shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-risk">No detention clause found</p>
                  <p className="text-sm text-muted-foreground mt-0.5">Ask the broker to add one before you accept this load.</p>
                  <Button onClick={emailBroker} disabled={analyzing} variant="outline" className="mt-3 h-10">
                    <Mail className="w-4 h-4 mr-1.5" /> Email broker
                  </Button>
                </div>
              </div>
            )
          )}

          {/* Manual entry (collapsible) */}
          <div className="rounded-xl border border-border bg-surface">
            <button onClick={() => setShowManual((v) => !v)} className="w-full flex items-center justify-between p-4">
              <span className="font-medium">Manual entry</span>
              {showManual ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
            </button>
            {showManual && (
              <div className="px-4 pb-4 space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  {inputFields.map((f) => (
                    <div key={f.key} className={f.key === "load_number" ? "sm:col-span-2" : ""}>
                      <Label className="mb-1.5 flex items-center gap-1.5 text-sm">
                        <f.icon className="w-3.5 h-3.5 text-muted-foreground" />
                        {f.label}{f.required && <span className="text-alert">*</span>}
                      </Label>
                      <Input name={f.key} value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} className={errClass(f.key)} />
                      {submitAttempted && missing[f.key] && <p className="text-xs text-risk mt-1">Required</p>}
                    </div>
                  ))}
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  {timeFields.map((f) => (
                    <div key={f.key}>
                      <Label className="mb-1.5 block text-sm">{f.label}{f.required && <span className="text-alert">*</span>}</Label>
                      <Input name={f.key} type="datetime-local" value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} className={errClass(f.key)} />
                      {submitAttempted && missing[f.key] && <p className="text-xs text-risk mt-1">Required</p>}
                    </div>
                  ))}
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  {contractFields.map((f) => (
                    <div key={f.key}>
                      <Label className="mb-1.5 block text-sm">{f.label}</Label>
                      <Input name={f.key} type={f.type} value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Live detention clock (both modes) */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Clock className="w-4 h-4" /> Detention clock
        </p>
        {!arrivedAt ? (
          <Button onClick={stampArrivalNow} className="w-full h-16 text-lg font-semibold">
            <Navigation className="w-5 h-5 mr-2" /> Arrived
          </Button>
        ) : (
          <div className="space-y-3">
            {remainingFreeMin != null && remainingFreeMin > 0 ? (
              <div className="rounded-lg bg-alert/10 border border-alert/30 p-4 text-center">
                <p className="text-xs font-medium uppercase tracking-wider text-alert">Detention starts in</p>
                <p className="font-display text-4xl font-bold text-alert tnum mt-1">{fmtClock(remainingFreeMin)}</p>
              </div>
            ) : departedAt ? (
              <div className="rounded-lg bg-money/10 border border-money/30 p-4 text-center">
                <p className="text-xs font-medium uppercase tracking-wider text-money">Claim amount</p>
                <p className="font-display text-4xl font-bold text-money tnum mt-1">${(result?.claim || 0).toFixed(2)}</p>
              </div>
            ) : (
              <div className="rounded-lg bg-alert/10 border border-alert/30 p-4 text-center">
                <p className="text-xs font-medium uppercase tracking-wider text-alert">Detention accruing</p>
                <p className="font-display text-4xl font-bold text-alert tnum mt-1">${accruing.toFixed(2)}</p>
              </div>
            )}
            {!departedAt && (
              <Button onClick={stampDepartedNow} variant="outline" className="w-full h-14 text-base font-semibold">
                <Square className="w-4 h-4 mr-2" /> Departed
              </Button>
            )}
            {checkin && (
              <p className="text-xs text-muted-foreground text-center">
                GPS: {checkin.lat.toFixed(4)}, {checkin.lng.toFixed(4)} (±{Math.round(checkin.acc)} m)
              </p>
            )}
          </div>
        )}
      </div>

      {/* Driver manual fields (compact) */}
      {isDriver && (
        <div className="rounded-xl border border-border bg-surface p-4 space-y-4">
          {inputFields.map((f) => (
            <div key={f.key}>
              <Label className="mb-1.5 flex items-center gap-1.5 text-sm">
                <f.icon className="w-3.5 h-3.5 text-muted-foreground" />
                {f.label}{f.required && <span className="text-alert">*</span>}
              </Label>
              <Input name={f.key} value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} className={errClass(f.key)} />
              {submitAttempted && missing[f.key] && <p className="text-xs text-risk mt-1">Required</p>}
            </div>
          ))}
          <div>
            <Label className="mb-1.5 block text-sm">Arrival time{!isDriver ? "" : ""}<span className="text-alert">*</span></Label>
            <Input name="arrival_time" type="datetime-local" value={form.arrival_time} onChange={(e) => set("arrival_time", e.target.value)} className={errClass("arrival_time")} />
          </div>
          <p className="text-xs text-muted-foreground">Defaults: 2 hrs free, $50/hr. The office updates terms when processing.</p>
        </div>
      )}

      {/* Save */}
      <Button onClick={handleSave} disabled={saving} className="w-full h-14 text-base font-semibold">
        {saving ? "Saving…" : isEdit ? "Save changes" : isDriver ? "Save & capture" : "Save & create claim"}
        {!saving && <ArrowRight className="w-4 h-4 ml-2" />}
      </Button>

      {/* No-clause email modal */}
      <Dialog open={!!emailModal} onOpenChange={(o) => !o && setEmailModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email broker — add detention clause</DialogTitle>
          </DialogHeader>
          {emailModal && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Subject</Label>
                <p className="font-medium">{emailModal.subject}</p>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Body</Label>
                <pre className="whitespace-pre-wrap text-sm font-body bg-muted rounded-lg p-3 max-h-72 overflow-y-auto">{emailModal.body}</pre>
              </div>
              <p className="text-xs text-muted-foreground">Copy and paste into your email to the broker.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { navigator.clipboard?.writeText(`${emailModal?.subject || ""}\n\n${emailModal?.body || ""}`); toast({ title: "Copied" }); }}>
              <Copy className="w-4 h-4 mr-1.5" /> Copy email
            </Button>
            <Button onClick={() => setEmailModal(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { roleOf } from "@/lib/roles";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Clock, DollarSign, Users, Info } from "lucide-react";

// Rate profiles: company-level default detention terms (free hours, contract
// rate, payout rate), overridable per driver. Per-load overrides happen on the
// load form. The contract_rate is broker-facing (used for all broker calcs);
// payout_rate is internal. Solo owner-operators set rates per load only.
export default function RateProfiles() {
  const { toast } = useToast();
  const { user } = useAuth();
  const role = roleOf(user);
  const [company, setCompany] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    company_name: "",
    default_free_hours: 2,
    default_rate_per_hour: 50,
    default_payout_rate_per_hour: 25,
  });
  const [driverDraft, setDriverDraft] = useState({});

  const load = async () => {
    const [companies, drv] = await Promise.all([
      base44.entities.Company.list().catch(() => []),
      base44.entities.Driver.list().catch(() => []),
    ]);
    const c = companies[0] || null;
    setCompany(c);
    setDrivers(drv);
    if (c) {
      setDraft({
        company_name: c.company_name || "",
        default_free_hours: c.default_free_hours ?? 2,
        default_rate_per_hour: c.default_rate_per_hour ?? 50,
        default_payout_rate_per_hour: c.default_payout_rate_per_hour ?? 25,
      });
    }
    const dd = {};
    drv.forEach((d) => {
      dd[d.id] = {
        payout_rate_per_hour: d.payout_rate_per_hour ?? "",
        free_detention_hours: d.free_detention_hours ?? "",
      };
    });
    setDriverDraft(dd);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const saveCompany = async () => {
    setSaving(true);
    try {
      const payload = {
        company_name: draft.company_name || "My Company",
        default_free_hours: Number(draft.default_free_hours) || 0,
        default_rate_per_hour: Number(draft.default_rate_per_hour) || 0,
        default_payout_rate_per_hour: Number(draft.default_payout_rate_per_hour) || 0,
      };
      let c = company;
      if (c) c = await base44.entities.Company.update(c.id, payload);
      else c = await base44.entities.Company.create(payload);
      setCompany(c);
      // Link this company to the current user so company-wide Load RLS
      // (dispatcher sees every truck's loads) resolves correctly.
      try {
        await base44.auth.updateMe({ company_id: c.id });
      } catch {
        /* non-fatal: RLS still works for the company creator via created_by_id */
      }
      toast({ title: "Company rate profile saved" });
    } catch {
      toast({ title: "Could not save", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveDriver = async (d) => {
    setSaving(true);
    try {
      const dd = driverDraft[d.id] || {};
      await base44.entities.Driver.update(d.id, {
        payout_rate_per_hour: dd.payout_rate_per_hour === "" ? null : Number(dd.payout_rate_per_hour),
        free_detention_hours: dd.free_detention_hours === "" ? null : Number(dd.free_detention_hours),
      });
      toast({ title: `${d.name} rate updated` });
      await load();
    } catch {
      toast({ title: "Could not update driver", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6">
        <div className="h-24 rounded-lg bg-muted animate-pulse" />
      </Card>
    );
  }

  if (role === "owner_operator") {
    return (
      <Card className="p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <DollarSign className="w-4 h-4" /> Rate profiles
        </h2>
        <div className="flex items-start gap-2 text-sm text-muted-foreground">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <p>You set the contract rate and driver payout per load when you add it. No company-wide defaults needed for a solo operator.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
        <DollarSign className="w-4 h-4" /> Rate profiles
      </h2>
      <p className="text-sm text-muted-foreground mb-5">
        Company defaults apply to every load. Override per driver below, or per load when you add it. The{" "}
        <span className="text-foreground font-medium">contract rate</span> is what the broker owes (from the rate con); the{" "}
        <span className="text-foreground font-medium">payout rate</span> is internal to the driver.
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <Label htmlFor="cn">Company name</Label>
          <Input
            id="cn"
            className="mt-1.5"
            value={draft.company_name}
            onChange={(e) => setDraft({ ...draft, company_name: e.target.value })}
            placeholder="Acme Trucking"
          />
        </div>
        <div>
          <Label htmlFor="fh" className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Default free hours
          </Label>
          <Input
            id="fh"
            type="number"
            className="mt-1.5"
            value={draft.default_free_hours}
            onChange={(e) => setDraft({ ...draft, default_free_hours: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="cr">Default contract rate ($/hr)</Label>
          <Input
            id="cr"
            type="number"
            className="mt-1.5"
            value={draft.default_rate_per_hour}
            onChange={(e) => setDraft({ ...draft, default_rate_per_hour: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="pr">Default payout rate ($/hr)</Label>
          <Input
            id="pr"
            type="number"
            className="mt-1.5"
            value={draft.default_payout_rate_per_hour}
            onChange={(e) => setDraft({ ...draft, default_payout_rate_per_hour: e.target.value })}
          />
        </div>
      </div>
      <Button className="mt-5" onClick={saveCompany} disabled={saving}>
        {saving ? "Saving…" : "Save company defaults"}
      </Button>

      {drivers.length > 0 && (
        <div className="mt-8 pt-6 border-t border-border">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" /> Driver overrides
          </h3>
          <div className="space-y-4">
            {drivers.map((d) => {
              const dd = driverDraft[d.id] || {};
              const setD = (k, v) => setDriverDraft({ ...driverDraft, [d.id]: { ...dd, [k]: v } });
              return (
                <div key={d.id} className="grid sm:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end">
                  <div>
                    <Label>Driver</Label>
                    <p className="font-medium mt-1.5">
                      {d.name}
                      {d.truck ? ` · ${d.truck}` : ""}
                    </p>
                  </div>
                  <div>
                    <Label>Payout rate ($/hr)</Label>
                    <Input
                      type="number"
                      className="mt-1.5"
                      placeholder="default"
                      value={dd.payout_rate_per_hour}
                      onChange={(e) => setD("payout_rate_per_hour", e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Free hours</Label>
                    <Input
                      type="number"
                      className="mt-1.5"
                      placeholder="default"
                      value={dd.free_detention_hours}
                      onChange={(e) => setD("free_detention_hours", e.target.value)}
                    />
                  </div>
                  <Button variant="outline" onClick={() => saveDriver(d)} disabled={saving}>
                    Save
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
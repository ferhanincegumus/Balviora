import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Plus, Wallet, Clock, Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

const STATUS_LABEL = {
  draft: "Draft",
  ready_to_send: "Ready",
  sent: "Sent",
  awaiting_response: "Waiting",
  followup_required: "Waiting",
  approved: "Approved",
  partially_approved: "Countered",
  denied: "Denied",
  paid: "Paid",
  closed: "Closed",
};

const STATUS_CHIP = {
  draft: "text-muted-foreground bg-muted",
  ready_to_send: "text-alert bg-alert/10",
  sent: "text-foreground bg-muted",
  awaiting_response: "text-alert bg-alert/10",
  followup_required: "text-alert bg-alert/10",
  approved: "text-money bg-money/10",
  partially_approved: "text-alert bg-alert/10",
  denied: "text-risk bg-risk/10",
  paid: "text-money bg-money/10",
  closed: "text-muted-foreground bg-muted",
};

function Chip({ status }) {
  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium whitespace-nowrap", STATUS_CHIP[status] || STATUS_CHIP.draft)}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

function money(n) {
  return `$${Math.round(n || 0).toLocaleString()}`;
}

export default function Dashboard() {
  const [claims, setClaims] = useState(null);
  const [loads, setLoads] = useState(null);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.Claim.list("-updated_date", 100).catch(() => []),
      base44.entities.Load.list("-updated_date", 100).catch(() => []),
    ]).then(([c, l]) => {
      setClaims(c);
      setLoads(l);
    });
  }, []);

  const seedDemo = async () => {
    setSeeding(true);
    try {
      await base44.functions.invoke("seedDemoData");
      const [c, l] = await Promise.all([
        base44.entities.Claim.list("-updated_date", 100).catch(() => []),
        base44.entities.Load.list("-updated_date", 100).catch(() => []),
      ]);
      setClaims(c);
      setLoads(l);
    } catch (e) {
      console.error(e);
    } finally {
      setSeeding(false);
    }
  };

  const loading = claims === null || loads === null;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const recoveredThisMonth =
    !loading &&
    claims
      .filter((c) => c.status === "paid" && c.updated_date && new Date(c.updated_date) >= monthStart)
      .reduce((s, c) => s + (c.paid_amount || c.approved_amount || c.claim_amount || 0), 0);

  const openClaims =
    !loading &&
    claims.filter((c) => !["approved", "partially_approved", "denied", "paid", "closed"].includes(c.status));
  const openClaimsValue = !loading && openClaims.reduce((s, c) => s + (c.claim_amount || 0), 0);

  const loadOf = (c) => (loads || []).find((l) => l.id === c.load_id);

  const needsYou = [];
  if (!loading) {
    claims.forEach((c) => {
      if (c.status === "ready_to_send") {
        needsYou.push({ c, action: "Send to broker", ctx: "ready to send", sort: 0 });
      } else if (c.status === "awaiting_response" && c.broker_response) {
        needsYou.push({ c, action: "Reply", ctx: "broker replied", sort: 1 });
      } else if (c.status === "followup_required") {
        needsYou.push({ c, action: "Send now", ctx: "follow-up due", sort: 1 });
      } else if (c.status === "draft") {
        const ld = loadOf(c);
        if (ld && ld.detention_clause_exists === false) {
          needsYou.push({ c, action: "Add clause", ctx: "no detention clause", sort: 2 });
        }
      }
    });
    needsYou.sort((a, b) => a.sort - b.sort || (b.c.claim_amount || 0) - (a.c.claim_amount || 0));
  }
  const topNeeds = needsYou.slice(0, 6);

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="h-8 w-44 rounded-lg bg-muted animate-pulse" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (claims.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="font-display font-bold text-3xl tracking-tight">No loads yet.</p>
        <p className="mt-2 text-muted-foreground">Add your first load and see what you're owed.</p>
        <div className="flex flex-col items-center gap-3 mt-6">
          <Link to="/loads/new">
            <Button className="h-12 px-6 font-semibold">
              <Plus className="w-4 h-4 mr-1.5" /> Add a load
            </Button>
          </Link>
          <Button variant="outline" onClick={seedDemo} disabled={seeding} className="h-11 px-5">
            {seeding ? "Loading demo scenarios…" : "Load 10 demo scenarios"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl sm:text-3xl tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Your recovery at a glance.</p>
        </div>
        <Link to="/loads/new" className="hidden sm:inline-block">
          <Button size="sm" className="h-9 px-4">
            <Plus className="w-4 h-4 mr-1.5" /> New load
          </Button>
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Recovered this month</p>
            <span className="w-9 h-9 rounded-lg bg-money/10 flex items-center justify-center">
              <Wallet className="w-5 h-5 text-money" />
            </span>
          </div>
          <p className="mt-4 font-display font-bold text-3xl sm:text-4xl text-money tnum">
            {money(recoveredThisMonth)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">From paid claims</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Open claims</p>
            <span className="w-9 h-9 rounded-lg bg-alert/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-alert" />
            </span>
          </div>
          <p className="mt-4 font-display font-bold text-3xl sm:text-4xl text-alert tnum">
            {money(openClaimsValue)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{openClaims.length} claims waiting</p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total loads</p>
            <span className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
              <Package className="w-5 h-5 text-muted-foreground" />
            </span>
          </div>
          <p className="mt-4 font-display font-bold text-3xl sm:text-4xl tnum">{loads.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Tracked loads</p>
        </div>
      </div>

      {/* Needs you */}
      <div>
        <h2 className="font-display font-bold text-xl tracking-tight mb-4">Needs you</h2>
        {topNeeds.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface p-6 text-center">
            <p className="text-foreground font-medium">You're all caught up.</p>
            <p className="text-sm text-muted-foreground mt-1">Nothing needs action today.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {topNeeds.map(({ c, action, ctx }) => (
              <div key={c.id} className="rounded-2xl border border-border bg-surface p-5 flex flex-col transition-colors hover:border-alert/40">
                <div className="flex items-center justify-between">
                  <p className="font-display text-2xl font-bold tnum">{money(c.claim_amount || 0)}</p>
                  <Chip status={c.status} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {c.broker_name || "—"} · {ctx}
                </p>
                <Link
                  to={`/claims/${c.id}`}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-foreground"
                >
                  {action} <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
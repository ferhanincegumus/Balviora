import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { cn } from "@/lib/utils";
import StatusBadge from "@/components/StatusBadge";
import { ChevronUp, ChevronDown, AlertTriangle } from "lucide-react";
import DriverAssignSelect from "@/components/DriverAssignSelect";

const REQUIRED_DOCS = [
  { key: "bol", label: "BOL" },
  { key: "pod", label: "POD" },
  { key: "sheet", label: "In/Out sheet" },
];

function missingDocs(evidences) {
  if (!evidences || evidences.length === 0) return REQUIRED_DOCS.map((d) => d.label);
  const types = new Set(evidences.map((e) => e.type));
  const hasSheet = evidences.some((e) => e.type === "other" && /sheet|in.?out/i.test(e.filename || ""));
  return REQUIRED_DOCS.filter((d) => {
    if (d.key === "sheet") return !hasSheet;
    return !types.has(d.key);
  }).map((d) => d.label);
}

const COLUMNS = [
  { key: "driver", label: "Driver" },
  { key: "load", label: "Load" },
  { key: "broker", label: "Broker" },
  { key: "amount", label: "Detention" },
  { key: "status", label: "Status" },
  { key: "missing", label: "Missing evidence" },
];

export default function DispatchDashboard() {
  const [loads, setLoads] = useState(null);
  const [claims, setClaims] = useState([]);
  const [evidences, setEvidences] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [sortKey, setSortKey] = useState("broker_name");
  const [sortDir, setSortDir] = useState("asc");

  const reload = () => {
    Promise.all([
      base44.entities.Load.list("-updated_date", 200).catch(() => []),
      base44.entities.Claim.list("-updated_date", 200).catch(() => []),
      base44.entities.Evidence.list("-updated_date", 200).catch(() => []),
      base44.entities.Driver.list("-updated_date", 200).catch(() => []),
    ]).then(([l, c, e, d]) => {
      setLoads(l);
      setClaims(c);
      setEvidences(e);
      setDrivers(d);
    });
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const claimByLoad = useMemo(() => {
    const m = {};
    claims.forEach((c) => {
      if (c.load_id) m[c.load_id] = c;
    });
    return m;
  }, [claims]);

  const evidencesByClaim = useMemo(() => {
    const m = {};
    evidences.forEach((e) => {
      (m[e.claim_id] = m[e.claim_id] || []).push(e);
    });
    return m;
  }, [evidences]);

  const driverById = useMemo(() => {
    const m = {};
    drivers.forEach((d) => {
      m[d.id] = d;
    });
    return m;
  }, [drivers]);

  const rows = useMemo(() => {
    if (!loads) return [];
    const now = Date.now();
    return loads.map((l) => {
      const claim = claimByLoad[l.id];
      const evs = claim ? evidencesByClaim[claim.id] || [] : [];
      const missing = missingDocs(evs);
      const departed = l.departure_time ? new Date(l.departure_time) : null;
      const overdueDocs = !!departed && now - departed.getTime() > 3600000 && missing.length > 0;
      const driver = l.driver_id ? driverById[l.driver_id] : null;
      return {
        id: l.id,
        claimId: claim?.id || null,
        driver: driver?.name || l.driver_name || "Unassigned",
        load: l.load_number || "—",
        broker: l.broker_name || "—",
        amount: claim?.claim_amount || l.claim_amount || 0,
        status: claim?.status || "draft",
        missing,
        overdueDocs,
      };
    });
  }, [loads, claimByLoad, evidencesByClaim, driverById]);

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      let av, bv;
      if (sortKey === "amount") {
        av = Number(a.amount) || 0;
        bv = Number(b.amount) || 0;
      } else if (sortKey === "missing") {
        av = a.missing.length;
        bv = b.missing.length;
      } else {
        av = String(a[sortKey]).toLowerCase();
        bv = String(b[sortKey]).toLowerCase();
      }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  if (!loads) {
    return (
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  const openClaimsCount = claims.filter(
    (c) => !["approved", "partially_approved", "denied", "paid", "closed"].includes(c.status)
  ).length;
  const unassignedCount = loads.filter((l) => !l.driver_id && !l.driver_name).length;
  const overdueCount = rows.filter((r) => r.overdueDocs).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl tracking-tight">Dispatch</h1>
        <p className="text-sm text-muted-foreground mt-1">All trucks and drivers — claims operations.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Active loads", value: loads.length, accent: "" },
          { label: "Open claims", value: openClaimsCount, accent: "" },
          { label: "Unassigned", value: unassignedCount, accent: unassignedCount > 0 ? "text-alert" : "" },
          { label: "Overdue docs", value: overdueCount, accent: overdueCount > 0 ? "text-risk" : "" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
            <p className={cn("font-display font-bold text-2xl mt-1 tnum", s.accent)}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              {COLUMNS.map((c) => (
                <th key={c.key} className="px-4 py-3 font-medium">
                  <button onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-foreground">
                    {c.label}
                    {sortKey === c.key &&
                      (sortDir === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-12 text-center text-muted-foreground">
                  No loads yet. Create a load and assign a driver.
                </td>
              </tr>
            ) : (
              sorted.map((r) => {
                const to = r.claimId ? `/claims/${r.claimId}` : `/loads/${r.id}/edit`;
                const load = loads.find((l) => l.id === r.id);
                return (
                  <tr key={r.id} className={cn("border-b border-border last:border-0", r.overdueDocs && "bg-risk/10")}>
                    <td className="px-4 py-3">
                      <DriverAssignSelect load={load} drivers={drivers} onAssigned={reload} />
                    </td>
                    <td className="px-4 py-3">
                      <Link to={to} className="hover:underline">
                        {r.load}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.broker}</td>
                    <td className="px-4 py-3 font-medium tnum">${r.amount.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3">
                      {r.missing.length === 0 ? (
                        <span className="text-money text-xs font-medium">Complete</span>
                      ) : (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 text-xs",
                            r.overdueDocs ? "text-risk font-medium" : "text-alert"
                          )}
                        >
                          {r.overdueDocs && <AlertTriangle className="w-3.5 h-3.5" />}
                          {r.missing.join(", ")}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
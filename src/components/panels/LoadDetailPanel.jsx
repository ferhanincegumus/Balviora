import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/StatusBadge";
import ScoreBadge from "@/components/ScoreBadge";
import { computeScore } from "@/lib/claimScore";
import { useSidePanel } from "@/components/panels/SidePanelContext";
import RateConAnalyzer from "@/components/RateConAnalyzer";
import LoadDetentionTimer from "@/components/LoadDetentionTimer";
import GeoCheckIn from "@/components/GeoCheckIn";
import { Pencil, ExternalLink, MapPin, Clock, DollarSign, FileText, ChevronRight, AlertTriangle } from "lucide-react";

export default function LoadDetailPanel({ id, onClose }) {
  const { openPanel } = useSidePanel();
  const [load, setLoad] = useState(null);
  const [claims, setClaims] = useState([]);

  useEffect(() => {
    if (!id) return;
    setLoad(null);
    base44.entities.Load.get(id)
      .then(async (l) => {
        setLoad(l);
        try {
          setClaims(await base44.entities.Claim.filter({ load_id: id }));
        } catch (_) { setClaims([]); }
      })
      .catch(() => setLoad(false));
  }, [id]);

  if (load === null) return <div className="p-10 text-center text-muted-foreground">Loading load…</div>;
  if (load === false) {
    return (
      <div className="p-10 text-center">
        <p className="font-medium">Load not found.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={onClose}>Close</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border bg-card">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold truncate">{load.load_number || "—"}</h2>
            <p className="text-xs text-muted-foreground truncate">{load.broker_name || "—"}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-xl font-bold text-primary leading-none">${(load.claim_amount || 0).toLocaleString()}</p>
            <p className="text-[11px] text-muted-foreground mt-1">claim value</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-3">
          <Link to={`/loads/${load.id}/edit`} onClick={onClose} className="flex-1">
            <Button variant="outline" size="sm" className="w-full"><Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit load</Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={() => openPanel("broker", { brokerName: load.broker_name }, { title: load.broker_name || "Broker" })}
            disabled={!load.broker_name}
          >
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Broker
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {load.detention_clause_exists === false && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-red-400">No detention clause in this rate con</p>
              <p className="text-xs text-muted-foreground mt-0.5">Get detention terms in writing before accepting this load.</p>
            </div>
          </div>
        )}

        <GeoCheckIn load={load} onUpdated={setLoad} />

        <LoadDetentionTimer load={load} onUpdated={setLoad} />

        <RateConAnalyzer load={load} onUpdated={setLoad} />

        <Card className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Load Details</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Customer</p><p className="font-medium truncate">{load.customer_name || "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Rate</p><p className="font-medium">${load.detention_rate_per_hour || 0}/hr</p></div>
            <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Pickup</p><p className="font-medium truncate">{load.pickup_location || "—"}</p></div></div>
            <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Delivery</p><p className="font-medium truncate">{load.delivery_location || "—"}</p></div></div>
            <div><p className="text-xs text-muted-foreground">Appointment</p><p className="font-medium text-xs">{load.appointment_time ? new Date(load.appointment_time).toLocaleString() : "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Arrival</p><p className="font-medium text-xs">{load.arrival_time ? new Date(load.arrival_time).toLocaleString() : "—"}</p></div>
            <div><p className="text-xs text-muted-foreground">Departure</p><p className="font-medium text-xs">{load.departure_time ? new Date(load.departure_time).toLocaleString() : "—"}</p></div>
            <div className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Wait</p><p className="font-medium">{Number(load.total_wait_hours || 0).toFixed(1)} hrs</p></div></div>
            <div><p className="text-xs text-muted-foreground">Free detention</p><p className="font-medium">{load.free_detention_hours || 0} hrs</p></div>
            <div><p className="text-xs text-muted-foreground">Billable</p><p className="font-medium">{Number(load.billable_hours || 0).toFixed(1)} hrs</p></div>
          </div>
        </Card>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Associated Claims</p>
            <span className="ml-auto text-xs text-muted-foreground">{claims.length}</span>
          </div>
          {claims.length === 0 ? (
            <Card className="p-6 text-center text-sm text-muted-foreground">No claims for this load.</Card>
          ) : (
            <div className="space-y-2">
              {claims.map((c) => (
                <button
                  key={c.id}
                  onClick={() => openPanel("claim", { id: c.id }, { title: `Claim ${c.load_number || ""}` })}
                  className="w-full text-left"
                >
                  <Card className="p-3 hover:border-primary/50 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{c.load_number || "—"}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <StatusBadge status={c.status} />
                          <ScoreBadge score={computeScore(c, load)} label={false} />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-bold text-primary">${(c.claim_amount || 0).toLocaleString()}</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Card>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
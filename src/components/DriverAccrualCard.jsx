import React, { useEffect, useState } from "react";

// Live detention accrual counter shown to drivers between Arrived and Departed.
// Uses the broker-facing contract_rate; falls back to billable hours if no rate.
function money(n) {
  return `$${(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function DriverAccrualCard({ load }) {
  const rate = Number(load.contract_rate || load.detention_rate_per_hour || 0);
  const free = Number(load.free_detention_hours || 0);
  const arrival = load.arrival_time ? new Date(load.arrival_time) : null;

  const [, tick] = useState(0);
  useEffect(() => {
    if (!arrival || load.departure_time) return;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [arrival, load.departure_time]);

  if (!arrival) return null;

  const end = load.departure_time ? new Date(load.departure_time) : new Date();
  const elapsedH = (end - arrival) / 3600000;
  const billableH = Math.max(0, elapsedH - free);
  const amount = billableH * rate;
  const inFreeTime = elapsedH < free;

  return (
    <div className="rounded-xl border border-alert/40 bg-alert/10 p-4 text-center">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">Detention accruing</p>
      <p className="font-display font-bold text-4xl text-alert tnum mt-1">
        {rate > 0 ? money(amount) : `${billableH.toFixed(1)} hrs`}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {inFreeTime
          ? `${(free - elapsedH).toFixed(1)} free hrs left`
          : `${billableH.toFixed(2)} billable hrs × $${rate}/hr`}
      </p>
    </div>
  );
}
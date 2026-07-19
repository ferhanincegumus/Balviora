import React, { useState } from "react";
import { base44 } from "@/api/base44Client";

// Inline driver assignment for the dispatch table. Sets driver_id,
// driver_name, and driver_user_id (used for driver RLS visibility) in one update.
export default function DriverAssignSelect({ load, drivers, onAssigned }) {
  const [saving, setSaving] = useState(false);
  const value = load?.driver_id || "";

  const onChange = async (e) => {
    const id = e.target.value;
    if (!load) return;
    setSaving(true);
    try {
      const drv = drivers.find((d) => d.id === id);
      const patch = drv
        ? { driver_id: drv.id, driver_name: drv.name, driver_user_id: drv.user_id }
        : { driver_id: "", driver_name: "", driver_user_id: "" };
      await base44.entities.Load.update(load.id, patch);
      onAssigned?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <select
      value={value}
      onChange={onChange}
      disabled={saving}
      className="bg-transparent text-sm font-medium border border-border/60 rounded-md px-2 py-1 max-w-[150px] focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
    >
      <option value="" className="bg-surface text-muted-foreground">Unassigned</option>
      {drivers.map((d) => (
        <option key={d.id} value={d.id} className="bg-surface text-foreground">
          {d.name}
        </option>
      ))}
    </select>
  );
}
import React, { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import LoadForm from "@/components/LoadForm";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";

export default function EditLoad() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [load, setLoad] = useState(undefined);

  useEffect(() => {
    base44.entities.Load.get(id)
      .then((l) => setLoad(l || null))
      .catch(() => setLoad(null));
  }, [id]);

  if (load === undefined) {
    return <Card className="p-10 text-center text-muted-foreground">Loading load…</Card>;
  }
  if (load === null) {
    return (
      <Card className="p-10 text-center">
        <p className="font-medium">Load not found.</p>
        <p className="text-sm text-muted-foreground mt-1">This load may have been deleted or belongs to another account.</p>
        <Link to="/loads" className="inline-block mt-4 text-primary hover:underline text-sm">Back to loads</Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <Link to="/loads" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to loads
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Load</h1>
        <p className="text-sm text-muted-foreground mt-1">Update load details — the claim recalculates automatically.</p>
      </div>
      <LoadForm initialLoad={load} onSaved={() => navigate("/loads")} />
    </div>
  );
}
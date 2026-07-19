import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Satellite, Loader2, CheckCircle2, MapPin, Radio } from "lucide-react";
import { geocodeAddress, haversine } from "@/lib/geoCheckIn";

const GEOFENCE_RADIUS = 200; // meters — within this of the facility = arrived

// GPS auto check-in: when the driver gets within the geofence of the facility,
// the app timestamps arrival automatically and saves the GPS coordinates +
// accuracy as defensible Evidence — no manual check-in to rely on.
export default function GeoCheckIn({ load, onUpdated }) {
  const { toast } = useToast();
  const [tracking, setTracking] = useState(false);
  const [pos, setPos] = useState(null);
  const [facility, setFacility] = useState(null);
  const [geocoding, setGeocoding] = useState(false);
  const [status, setStatus] = useState("");
  const watchId = useRef(null);
  const checkedIn = useRef(false);

  const address = load.delivery_location || load.pickup_location;
  const autoCheckedIn = load.checkin_method === "auto_geofence" && load.arrival_time;

  // Restore a previously geocoded facility.
  useEffect(() => {
    if (load.facility_lat != null && load.facility_lng != null) {
      setFacility({
        lat: load.facility_lat,
        lng: load.facility_lng,
        display: load.facility_display || address,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load.id]);

  useEffect(
    () => () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    },
    []
  );

  const ensureFacility = async () => {
    if (facility) return facility;
    if (!address) {
      toast({
        title: "No facility address",
        description: "Add a delivery or pickup address to enable GPS check-in.",
        variant: "destructive",
      });
      return null;
    }
    setGeocoding(true);
    try {
      const g = await geocodeAddress(address);
      if (!g) {
        toast({
          title: "Couldn't locate the facility",
          description: "Check the delivery/pickup address spelling.",
          variant: "destructive",
        });
        return null;
      }
      setFacility(g);
      try {
        await base44.entities.Load.update(load.id, {
          facility_lat: g.lat,
          facility_lng: g.lng,
          facility_display: g.display,
        });
      } catch {}
      return g;
    } finally {
      setGeocoding(false);
    }
  };

  const startTracking = async () => {
    if (!navigator.geolocation) {
      toast({ title: "GPS not supported on this device", variant: "destructive" });
      return;
    }
    const fac = await ensureFacility();
    if (!fac) return;
    setTracking(true);
    setStatus("Locating you…");
    watchId.current = navigator.geolocation.watchPosition(
      (p) => handlePos(p, fac),
      (err) => {
        toast({ title: "Location error", description: err.message, variant: "destructive" });
        stopTracking();
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 30000 }
    );
  };

  const stopTracking = () => {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setTracking(false);
  };

  const handlePos = async (p, fac) => {
    const { latitude, longitude, accuracy } = p.coords;
    setPos({ lat: latitude, lng: longitude, accuracy });
    const dist = haversine(latitude, longitude, fac.lat, fac.lng);
    setStatus(
      `You are ${Math.round(dist)} m from the facility · GPS accuracy ±${Math.round(accuracy)} m`
    );
    if (!checkedIn.current && !load.arrival_time && dist <= GEOFENCE_RADIUS + accuracy) {
      checkedIn.current = true;
      await autoCheckIn(latitude, longitude, accuracy, dist, fac);
    }
  };

  const autoCheckIn = async (lat, lng, acc, dist, fac) => {
    try {
      const ts = new Date().toISOString();
      const updated = await base44.entities.Load.update(load.id, {
        arrival_time: ts,
        checkin_lat: lat,
        checkin_lng: lng,
        checkin_accuracy_m: Math.round(acc),
        checkin_method: "auto_geofence",
        checkin_at: ts,
        notified_15min: false,
        notified_billing_start: false,
      });
      onUpdated?.(updated);
      // Save the GPS reading as defensible Evidence on the linked claim.
      try {
        const linked = await base44.entities.Claim.filter({ load_id: load.id });
        if (linked[0]) {
          await base44.entities.Evidence.create({
            claim_id: linked[0].id,
            type: "other",
            filename: "GPS auto check-in",
            content:
              `Automatic geofence check-in on facility entry.\n` +
              `Time: ${new Date(ts).toLocaleString()}\n` +
              `Location: ${lat.toFixed(6)}, ${lng.toFixed(6)}\n` +
              `GPS accuracy: ±${Math.round(acc)} m\n` +
              `Distance to facility: ${Math.round(dist)} m\n` +
              `Facility: ${fac.display || address}\n` +
              `Method: auto_geofence`,
            notes: "Device GPS captured on facility entry — defensible arrival proof",
            uploaded_at: ts,
          });
        }
      } catch {}
      toast({
        title: "Auto check-in captured",
        description: "Arrival timestamped via GPS and saved as evidence.",
      });
      stopTracking();
    } catch {
      toast({ title: "Check-in failed", description: "Could not save the GPS check-in.", variant: "destructive" });
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Satellite className="w-4 h-4 text-primary" />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">GPS Auto Check-in</p>
      </div>

      {autoCheckedIn ? (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-emerald-400">Arrival captured via GPS</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(load.checkin_at || load.arrival_time).toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {Number(load.checkin_lat).toFixed(5)}, {Number(load.checkin_lng).toFixed(5)} · ±{load.checkin_accuracy_m} m
            </p>
            {facility?.display && (
              <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                <MapPin className="w-3 h-3 mt-0.5 shrink-0" /> {facility.display}
              </p>
            )}
          </div>
        </div>
      ) : tracking ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Radio className="w-4 h-4 text-primary animate-pulse" />
            <span className="text-muted-foreground">{status}</span>
          </div>
          {pos && (
            <p className="text-xs text-muted-foreground">
              {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
            </p>
          )}
          <Button variant="outline" size="sm" className="w-full" onClick={stopTracking}>
            Stop tracking
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Enable GPS and the app timestamps your arrival automatically when you enter the facility —
            saved as proof you can use to defend the claim.
          </p>
          <Button size="sm" className="w-full" onClick={startTracking} disabled={geocoding || !address}>
            {geocoding ? (
              <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Locating facility…</>
            ) : (
              <><Satellite className="w-4 h-4 mr-1.5" /> Enable GPS check-in</>
            )}
          </Button>
          {!address && (
            <p className="text-xs text-muted-foreground">Add a delivery or pickup address to enable GPS check-in.</p>
          )}
        </div>
      )}
    </Card>
  );
}
import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, LogOut, Bell, Shield } from "lucide-react";
import RateProfiles from "@/components/RateProfiles";

export default function Settings() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const handleLogout = () => base44.auth.logout("/login");

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account preferences.</p>
      </div>

      <Card className="p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
          <User className="w-4 h-4" /> Account
        </h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span className="font-medium">{user?.full_name || "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Email</span><span className="font-medium">{user?.email || "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Role</span><span className="font-medium capitalize">{user?.role || "—"}</span></div>
        </div>
        <div className="mt-6 pt-6 border-t border-border">
          <Button variant="outline" onClick={handleLogout} className="text-red-400 hover:text-red-400">
            <LogOut className="w-4 h-4 mr-1.5" /> Sign out
          </Button>
        </div>
      </Card>

      <RateProfiles />

      <Card className="p-6 opacity-60">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
          <Bell className="w-4 h-4" /> Notifications
        </h2>
        <p className="text-sm text-muted-foreground">Claim status notifications coming soon.</p>
      </Card>

      <Card className="p-6 opacity-60">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4" /> Security
        </h2>
        <p className="text-sm text-muted-foreground">Password and security settings coming soon.</p>
      </Card>
    </div>
  );
}
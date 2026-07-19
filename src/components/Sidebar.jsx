import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Package, FileText, CalendarClock, Building2, Inbox,
  MessageSquare, User, Settings, LogOut, Bell, ChevronDown, CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import Logo from "@/components/Logo";

const OPEN_ACTIONABLE = ["ready_to_send", "followup_required"];

function useNavCounts() {
  const [counts, setCounts] = useState({ claimsAction: 0, overdueFollowups: 0, newOpportunities: 0, urgent: [] });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [claims, followups, recoveries] = await Promise.all([
          base44.entities.Claim.list("-updated_date", 200).catch(() => []),
          base44.entities.FollowUp.list("-updated_date", 200).catch(() => []),
          base44.entities.PotentialRecovery.list("-updated_date", 200).catch(() => []),
        ]);
        if (cancelled) return;
        const now = new Date();
        const actionClaims = claims.filter((c) => OPEN_ACTIONABLE.includes(c.status));
        const overdue = followups.filter((f) => f.status === "scheduled" && f.scheduled_date && new Date(f.scheduled_date) < now);
        const newOpps = recoveries.filter((r) => r.status === "new");

        const urgent = [];
        actionClaims.slice(0, 8).forEach((c) =>
          urgent.push({ type: "claim", label: `Claim ${c.load_number || ""} needs action`, sub: c.broker_name || "", to: `/claims/${c.id}`, id: c.id })
        );
        overdue.slice(0, 6).forEach((f) =>
          urgent.push({ type: "followup", label: `Overdue follow-up`, sub: f.email_subject || "", to: `/followups` })
        );
        newOpps.slice(0, 4).forEach((r) =>
          urgent.push({ type: "opportunity", label: `New recovery opportunity`, sub: r.broker_name || r.load_number || "", to: `/recovery` })
        );

        setCounts({
          claimsAction: actionClaims.length,
          overdueFollowups: overdue.length,
          newOpportunities: newOpps.length,
          urgent,
        });
      } catch (_) {
        if (!cancelled) setCounts({ claimsAction: 0, overdueFollowups: 0, newOpportunities: 0, urgent: [] });
      }
    };
    load();
    const t = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  return counts;
}

export default function Sidebar({ mobileOpen, onClose }) {
  const location = useLocation();
  const { claimsAction, overdueFollowups, newOpportunities, urgent } = useNavCounts();
  const [bellOpen, setBellOpen] = useState(false);

  const totalUrgent = claimsAction + overdueFollowups + newOpportunities;

  const handleLogout = async () => {
    await import("@/api/base44Client").then(({ base44 }) => base44.auth.logout("/login"));
  };

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + "/");

  const groups = [
    {
      label: null,
      items: [
        { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
        { label: "Case Leads", path: "/leads", icon: MessageSquare },
      ],
    },
    {
      label: "Recovery Workflow",
      items: [
        { label: "Loads", path: "/loads", icon: Package, badge: 0 },
        { label: "Claims", path: "/claims", icon: FileText, badge: claimsAction },
        { label: "Follow-ups", path: "/followups", icon: CalendarClock, badge: overdueFollowups },
        { label: "Recovery Inbox", path: "/recovery", icon: Inbox, badge: newOpportunities },
      ],
    },
    {
      label: "Intelligence",
      items: [{ label: "Broker Analysis", path: "/brokers", icon: Building2 }],
    },
    {
      label: "Account",
      items: [
        { label: "Profile", path: "/profile", icon: User },
        { label: "Settings", path: "/settings", icon: Settings },
      ],
    },
  ];

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={onClose} />}

      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-16 flex items-center px-5 border-b border-sidebar-border">
          <Logo size={32} />
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {groups.map((group, gi) => (
            <div key={gi} className={cn("space-y-0.5", gi > 0 && "mt-5")}>
              {group.label && (
                <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {group.label}
                </p>
              )}
              {group.items.map((item) => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60"
                    )}
                  >
                    <item.icon className="w-[18px] h-[18px] shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Notification bell */}
        <div className="relative px-3 pb-2">
          <button
            onClick={() => setBellOpen((v) => !v)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 transition-colors"
          >
            <div className="relative">
              <Bell className="w-[18px] h-[18px]" />
              {totalUrgent > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {totalUrgent > 99 ? "99+" : totalUrgent}
                </span>
              )}
            </div>
            <span className="flex-1 text-left">Notifications</span>
            <ChevronDown className={cn("w-4 h-4 transition-transform", bellOpen && "rotate-180")} />
          </button>

          {bellOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-1 rounded-lg border border-sidebar-border bg-popover shadow-xl max-h-80 overflow-y-auto">
              {urgent.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground">
                  <CheckCircle className="w-5 h-5 mx-auto mb-1.5 text-emerald-400" />
                  All caught up — nothing urgent.
                </div>
              ) : (
                <div className="py-1">
                  {urgent.map((u, i) => (
                    <Link
                      key={i}
                      to={u.to}
                      onClick={() => { setBellOpen(false); onClose?.(); }}
                      className="block px-3 py-2 hover:bg-sidebar-accent transition-colors"
                    >
                      <p className="text-xs font-medium text-foreground truncate">{u.label}</p>
                      {u.sub && <p className="text-[11px] text-muted-foreground truncate">{u.sub}</p>}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-sidebar-border">
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-[18px] h-[18px] mr-3" />
            Sign out
          </Button>
        </div>
      </aside>
    </>
  );
}
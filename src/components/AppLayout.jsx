import React, { useState } from "react";
import { Outlet, Link, useLocation, useNavigate, Navigate } from "react-router-dom";
import {
  Home as HomeIcon,
  Package,
  FileText,
  Inbox,
  MoreHorizontal,
  Plus,
  BarChart2,
  CalendarClock,
  Settings,
  User,
  LogOut,
  X,
  LayoutDashboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { roleOf } from "@/lib/roles";

const OWNER_TABS = [
  { label: "Home", path: "/dashboard", icon: HomeIcon },
  { label: "Loads", path: "/loads", icon: Package },
  { label: "Claims", path: "/claims", icon: FileText },
  { label: "Inbox", path: "/recovery", icon: Inbox },
];
const OWNER_MORE = [
  { label: "Broker Intelligence", path: "/brokers", icon: BarChart2 },
  { label: "Follow-ups", path: "/followups", icon: CalendarClock },
  { label: "Profile", path: "/profile", icon: User },
  { label: "Settings", path: "/settings", icon: Settings },
];

const DISPATCH_TABS = [
  { label: "Dispatch", path: "/dispatch", icon: LayoutDashboard },
  { label: "Claims", path: "/claims", icon: FileText },
  { label: "Inbox", path: "/recovery", icon: Inbox },
  { label: "Brokers", path: "/brokers", icon: BarChart2 },
];
const DISPATCH_MORE = [
  { label: "Follow-ups", path: "/followups", icon: CalendarClock },
  { label: "Profile", path: "/profile", icon: User },
  { label: "Settings", path: "/settings", icon: Settings },
];

function isPathActive(pathname, path) {
  return pathname === path || pathname.startsWith(path + "/");
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-lg bg-foreground text-background flex items-center justify-center font-display font-bold">
        DS
      </div>
      <span className="font-display font-bold tracking-tight">Detention Shield</span>
    </div>
  );
}

export default function AppLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  if (!user) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  const role = roleOf(user);
  if (role === "driver") return <Navigate to="/driver" replace />;

  const tabs = role === "dispatcher" ? DISPATCH_TABS : OWNER_TABS;
  const more = role === "dispatcher" ? DISPATCH_MORE : OWNER_MORE;

  const handleLogout = () => base44.auth.logout("/login");

  const DesktopSidebar = (
    <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-border h-screen sticky top-0">
      <div className="h-16 flex items-center px-5 border-b border-border">
        <Logo />
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {tabs.map((item) => {
          const active = isPathActive(location.pathname, item.path);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {item.label}
            </Link>
          );
        })}
        <div className="pt-3 mt-3 border-t border-border space-y-1">
          <p className="px-3 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">More</p>
          {more.map((item) => {
            const active = isPathActive(location.pathname, item.path);
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="p-3 border-t border-border">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          <LogOut className="w-5 h-5" /> Sign out
        </button>
      </div>
    </aside>
  );

  const BottomTabBar = (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background">
      <div className="grid grid-cols-5 h-16">
        {tabs.map((item) => {
          const Icon = item.icon;
          const active = isPathActive(location.pathname, item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn("flex flex-col items-center justify-center gap-1", active ? "text-foreground" : "text-muted-foreground")}
            >
              <Icon className="w-6 h-6" />
              <span className="text-[11px] font-medium">{item.label}</span>
            </Link>
          );
        })}
        <button onClick={() => setMoreOpen(true)} className="flex flex-col items-center justify-center gap-1 text-muted-foreground">
          <MoreHorizontal className="w-6 h-6" />
          <span className="text-[11px] font-medium">More</span>
        </button>
      </div>
    </nav>
  );

  const MoreSheet = moreOpen && (
    <div className="lg:hidden fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/60" onClick={() => setMoreOpen(false)} />
      <div className="absolute bottom-0 inset-x-0 rounded-t-2xl border-t border-border bg-surface p-4 pb-8">
        <div className="flex items-center justify-between mb-4">
          <span className="font-display font-bold text-lg">More</span>
          <button onClick={() => setMoreOpen(false)} className="p-2 -mr-2 text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="space-y-1">
          {more.map((item) => {
            const Icon = item.icon;
            const active = isPathActive(location.pathname, item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMoreOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition-colors",
                  active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <Icon className="w-5 h-5" /> {item.label}
              </Link>
            );
          })}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 rounded-lg px-3 py-3 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <LogOut className="w-5 h-5" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {DesktopSidebar}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-28 lg:pb-10">
          <Outlet />
        </main>
      </div>
      <button
        onClick={() => navigate("/loads/new")}
        aria-label="Add load"
        className="fixed right-4 bottom-20 lg:bottom-6 z-30 w-14 h-14 rounded-full bg-foreground text-background flex items-center justify-center shadow-lg hover:opacity-90 transition"
      >
        <Plus className="w-7 h-7" />
      </button>
      {BottomTabBar}
      {MoreSheet}
    </div>
  );
}
import { useState } from "react";
import {
  Activity,
  BarChart3,
  BookOpenCheck,
  LayoutDashboard,
  Settings2,
  TicketPercent,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminOverview } from "./admin/AdminOverview";
import { AdminUsers } from "./admin/AdminUsers";
import { AdminAuditLogs } from "./admin/AdminAuditLogs";
import { AdminObligations } from "./admin/AdminObligations";
import { AdminCoupons } from "./admin/AdminCoupons";
import { AdminSettings } from "./admin/AdminSettings";

type AdminSection =
  | "overview"
  | "users"
  | "analytics"
  | "obligations"
  | "audit"
  | "coupons"
  | "settings";

const sections: { id: AdminSection; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "users", label: "Users", icon: Users },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "obligations", label: "Udhari & Split Bills", icon: BookOpenCheck },
  { id: "audit", label: "Audit Logs", icon: Activity },
  { id: "coupons", label: "Coupons", icon: TicketPercent },
  { id: "settings", label: "Platform Settings", icon: Settings2 },
];

export default function Admin() {
  const [section, setSection] = useState<AdminSection>("overview");

  return (
    <div className="pb-24 md:pb-8 space-y-6 animate-in fade-in duration-300">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">FinTrack · Admin</p>
        <h1 className="text-2xl md:text-3xl font-display font-bold">Control Center</h1>
        <p className="text-sm text-muted-foreground">Platform operations and account oversight.</p>
      </header>

      <nav aria-label="Admin sections" className="flex gap-2 overflow-x-auto border-b border-border pb-2">
        {sections.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setSection(id)}
            aria-current={section === id ? "page" : undefined}
            className={cn(
              "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
              section === id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </nav>

      {section === "overview" && <AdminOverview />}
      {section === "users" && <AdminUsers />}
      {section === "analytics" && <AdminOverview analyticsOnly />}
      {section === "obligations" && <AdminObligations />}
      {section === "audit" && <AdminAuditLogs />}
      {section === "coupons" && <AdminCoupons />}
      {section === "settings" && <AdminSettings />}
    </div>
  );
}

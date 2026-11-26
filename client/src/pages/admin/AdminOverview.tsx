import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminOverviewData } from "./types";

const rupees = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const numberFormat = new Intl.NumberFormat("en-IN");
const subscriptionColors = ["#2563eb", "#f59e0b"];

async function fetchOverview(path: string): Promise<AdminOverviewData> {
  const response = await fetch(path, { credentials: "include" });
  if (!response.ok) throw new Error("Unable to load the admin overview.");
  return response.json();
}

function MetricCard({
  label,
  value,
  note,
  accent = "text-foreground",
}: {
  label: string;
  value: string | number;
  note?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-bold tabular-nums ${accent}`}>{value}</p>
      {note && <p className="mt-0.5 text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}

function MetricGroup({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: string | number; note?: string; accent?: string }[];
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {items.map(item => <MetricCard key={item.label} {...item} />)}
      </div>
    </section>
  );
}

function ChartCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <Card className={`min-w-0 rounded-2xl border-border shadow-sm ${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-[280px] px-2 pb-4 sm:px-4">{children}</CardContent>
    </Card>
  );
}

function ActivityList({
  title,
  items,
  empty,
  render,
}: {
  title: string;
  items: any[];
  empty: string;
  render: (item: any) => React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? items.map((item, index) => (
          <div key={item.id ?? index} className="border-b border-border/70 pb-3 last:border-0 last:pb-0">
            {render(item)}
          </div>
        )) : <p className="py-3 text-sm text-muted-foreground">{empty}</p>}
      </CardContent>
    </Card>
  );
}

function AdminCharts({ data }: { data: AdminOverviewData }) {
  const [range, setRange] = useState<"daily" | "monthly">("daily");
  const growth = range === "daily" ? data.charts.dailyUserGrowth : data.charts.monthlyUserGrowth;
  const transactions = range === "daily" ? data.charts.dailyTransactions : data.charts.monthlyTransactions;

  const growthValue = (value: number | null) => value === null ? "No baseline" : `${value > 0 ? "+" : ""}${value}%`;
  const budgetUsage = data.metrics.platform.activeBudgetUsagePercent === null
    ? "No current budgets"
    : `${data.metrics.platform.activeBudgetUsagePercent}%`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Platform analytics</h2>
        <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => setRange("daily")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${range === "daily" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            Last 30 days
          </button>
          <button
            type="button"
            onClick={() => setRange("monthly")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${range === "monthly" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            Last 12 months
          </button>
        </div>
      </div>

      <MetricGroup title="User activity & growth" items={[
        { label: "Daily active users", value: numberFormat.format(data.metrics.users.dau), note: "Distinct accounts with a recorded login today" },
        { label: "Weekly active users", value: numberFormat.format(data.metrics.users.wau), note: "Distinct accounts logged in over 7 days" },
        { label: "Monthly active users", value: numberFormat.format(data.metrics.users.mau), note: "Distinct accounts logged in over 30 days" },
        { label: "New users · last 30 days", value: numberFormat.format(data.metrics.users.usersLast30Days) },
        { label: "User growth vs prior 30 days", value: growthValue(data.metrics.users.userGrowthPercent), accent: "text-indigo-600" },
      ]} />
      <MetricGroup title="Transactions, budgets & wealth" items={[
        { label: "Transactions · last 30 days", value: numberFormat.format(data.metrics.platform.transactionsLast30Days) },
        { label: "Transaction growth vs prior 30 days", value: growthValue(data.metrics.platform.transactionGrowthPercent), accent: "text-teal-700" },
        { label: "Average transaction", value: rupees.format(data.metrics.platform.averageTransactionAmount) },
        { label: "Current-month budgets", value: numberFormat.format(data.metrics.platform.activeBudgets), note: `${rupees.format(data.metrics.platform.activeBudgetTotal)} planned` },
        { label: "Budget usage", value: budgetUsage, note: `${rupees.format(data.metrics.platform.activeBudgetSpent)} spent` },
        { label: "Latest snapshot assets", value: rupees.format(data.metrics.platform.latestWealthAssets), note: `${data.metrics.platform.latestWealthProfiles} profiles with snapshots` },
        { label: "Latest snapshot liabilities", value: rupees.format(data.metrics.platform.latestWealthLiabilities) },
      ]} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="User Growth">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={growth} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="adminUserGrowth" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={20} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={36} />
              <Tooltip />
              <Area type="monotone" dataKey="users" name="New users" stroke="#4f46e5" strokeWidth={2} fill="url(#adminUserGrowth)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Transaction Activity">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={transactions} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={20} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={36} />
              <Tooltip />
              <Bar dataKey="transactions" name="Transactions" fill="#0f766e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Income vs Expense">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={transactions} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={20} />
              <YAxis tick={{ fontSize: 10 }} width={56} tickFormatter={value => numberFormat.format(Number(value))} />
              <Tooltip formatter={value => rupees.format(Number(value))} />
              <Legend />
              <Bar dataKey="income" name="Income" fill="#16a34a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="#dc2626" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Free vs Paid">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data.charts.subscriptionDistribution} dataKey="value" nameKey="name" innerRadius={58} outerRadius={94} paddingAngle={4}>
                {data.charts.subscriptionDistribution.map((entry, index) => (
                  <Cell key={entry.name} fill={subscriptionColors[index % subscriptionColors.length]} />
                ))}
              </Pie>
              <Tooltip formatter={value => numberFormat.format(Number(value))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

export function AdminOverview({ analyticsOnly = false }: { analyticsOnly?: boolean }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [analyticsOnly ? "/api/admin/analytics" : "/api/admin/overview"],
    queryFn: () => fetchOverview(analyticsOnly ? "/api/admin/analytics" : "/api/admin/overview"),
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <Skeleton className="h-[280px] rounded-2xl" />
          <Skeleton className="h-[280px] rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6">
        <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Admin data could not be loaded</div>
        <p className="mt-1 text-sm text-muted-foreground">Check the connection, then retry.</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      </div>
    );
  }

  if (analyticsOnly) return <AdminCharts data={data} />;

  const { users, platform, udhari, splitBills } = data.metrics;
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Platform overview</h2>
          <p className="text-sm text-muted-foreground">Live totals calculated from FinTrack database records.</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Refreshed {new Date(data.generatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })} IST
        </p>
      </div>

      <MetricGroup title="Users" items={[
        { label: "Total Users", value: numberFormat.format(users.total) },
        { label: "Active Users", value: numberFormat.format(users.active), accent: "text-emerald-600" },
        { label: "Inactive Users", value: numberFormat.format(users.inactive) },
        { label: "Suspended Users", value: numberFormat.format(users.suspended), accent: "text-rose-600" },
        { label: "New Users Today", value: numberFormat.format(users.newToday) },
        { label: "New Users This Week", value: numberFormat.format(users.newThisWeek) },
        { label: "New Users This Month", value: numberFormat.format(users.newThisMonth) },
      ]} />
      <MetricGroup title="Subscriptions" items={[
        { label: "Free Users", value: numberFormat.format(users.free) },
        { label: "Paid Users", value: numberFormat.format(users.paid), accent: "text-amber-600" },
      ]} />
      <MetricGroup title="Platform Usage" items={[
        { label: "Transactions", value: numberFormat.format(platform.transactions) },
        { label: "Total Income", value: rupees.format(platform.income), accent: "text-emerald-600" },
        { label: "Total Expenses", value: rupees.format(platform.expenses), accent: "text-rose-600" },
        { label: "Budgets", value: numberFormat.format(platform.budgets) },
        { label: "Profiles", value: numberFormat.format(platform.profiles) },
      ]} />
      <MetricGroup title="Udhari Khata" items={[
        { label: "Total Udhari", value: rupees.format(udhari.totalAmount), note: `${numberFormat.format(udhari.totalRecords)} records` },
        { label: "Pending Udhari", value: numberFormat.format(udhari.pendingRecords), note: "Unsettled records" },
        { label: "Outstanding Receivables", value: rupees.format(udhari.outstandingReceivables), accent: "text-emerald-600" },
        { label: "Outstanding Payables", value: rupees.format(udhari.outstandingPayables), accent: "text-rose-600" },
      ]} />
      <MetricGroup title="Split Bills" items={[
        { label: "Total Split Bills", value: numberFormat.format(splitBills.total) },
        { label: "Active Split Bills", value: numberFormat.format(splitBills.active) },
        { label: "Settled Split Bills", value: numberFormat.format(splitBills.settled) },
        { label: "Pending Settlements", value: numberFormat.format(splitBills.pendingSettlements) },
      ]} />
      <MetricGroup title="Wealth" items={[
        { label: "Wealth Snapshots", value: numberFormat.format(platform.wealthSnapshots) },
      ]} />

      <AdminCharts data={data} />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Recent activity</h2>
          <p className="text-sm text-muted-foreground">Activity available from the current account and audit records.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ActivityList title="Recent Registrations" items={data.activity.recentRegistrations} empty="No registrations yet." render={item => (
            <div className="flex justify-between gap-3 text-sm">
              <div className="min-w-0"><p className="truncate font-medium">{item.name || "FinTrack user"}</p><p className="truncate text-xs text-muted-foreground">{item.email}</p></div>
              <time className="shrink-0 text-xs text-muted-foreground">{item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-IN") : "—"}</time>
            </div>
          )} />
          <ActivityList title="Recent Login Activity" items={data.activity.recentLogins} empty="No login activity recorded yet." render={item => (
            <div className="flex justify-between gap-3 text-sm">
              <div className="min-w-0"><p className="truncate font-medium">{item.name || "FinTrack user"}</p><p className="truncate text-xs text-muted-foreground">{item.email}</p></div>
              <time className="shrink-0 text-xs text-muted-foreground">{item.lastLogin ? new Date(item.lastLogin).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "—"}</time>
            </div>
          )} />
          <ActivityList title="Recent Admin Actions" items={data.activity.recentAdminActions} empty="No admin actions recorded yet." render={item => (
            <div className="flex justify-between gap-3 text-sm">
              <div className="min-w-0"><p className="truncate font-medium">{item.action.replace("admin:", "").replaceAll("_", " ")}</p><p className="truncate text-xs text-muted-foreground">By {item.actorName || item.actorEmail} · {item.details || item.entityType}</p></div>
              <time className="shrink-0 text-xs text-muted-foreground">{item.createdAt ? new Date(item.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "—"}</time>
            </div>
          )} />
          <ActivityList title="Recent Platform Activity" items={data.activity.recentPlatformActivity} empty="No platform activity recorded yet." render={item => (
            <div className="flex justify-between gap-3 text-sm">
              <div className="min-w-0"><p className="truncate font-medium">{item.action.replaceAll("_", " ")} · {item.entityType}</p><p className="truncate text-xs text-muted-foreground">By {item.actorName || "FinTrack user"}</p></div>
              <time className="shrink-0 text-xs text-muted-foreground">{item.createdAt ? new Date(item.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "—"}</time>
            </div>
          )} />
        </div>
      </section>
    </div>
  );
}

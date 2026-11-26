import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useProfiles, useAnalyticsSummary, useTransactions, useBudget, useOutstandingObligations } from "@/hooks/use-fin-track";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  AlertCircle,
  ArrowRight,
  MoreHorizontal,
  Zap,
  CheckCircle2,
  ArrowUpCircle,
  ArrowDownCircle,
  Shield,
  Calendar,
  Pencil,
  Trash2,
  HandCoins,
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  Clock,
  Users
} from "lucide-react";
import { useLocation } from "wouter";
import { AddTransactionDialog } from "@/components/AddTransactionDialog";
import { Progress } from "@/components/ui/progress";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { data: profiles, isLoading: isProfilesLoading } = useProfiles();
  const isPro = (user as any)?.subscriptionStatus === 'paid';
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const monthOptions = useMemo(() => [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ], []);

  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [currentYear - 1, currentYear, currentYear + 1];
  }, []);

  const activeProfileId = (user as any)?.activeProfileId as number | undefined;
  const activeProfile = profiles?.find((p: any) => p.id === activeProfileId) || profiles?.[0]; 

  const { data: summary, isLoading: isSummaryDataLoading } = useAnalyticsSummary(
    activeProfile?.id, 
    selectedMonth, 
    selectedYear
  );

  const { data: recentTransactions, isLoading: isTxDataLoading } = useTransactions(
    activeProfile?.id, 
    { month: selectedMonth, year: selectedYear }
  );

  const { data: obligationsData, isLoading: isObligationsLoading } = useOutstandingObligations(activeProfile?.id);

  const { data: budget } = useBudget(activeProfile?.id, selectedMonth, selectedYear);

  const isSummaryLoading = isAuthLoading || isProfilesLoading || isSummaryDataLoading;
  const isTxLoading = isAuthLoading || isProfilesLoading || isTxDataLoading || isObligationsLoading;

  if (!activeProfile) {
    return (
      <div className="p-8">
        <div className="flex items-center space-x-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
      </div>
    );
  }

  const budgetProgress = summary && summary.expenses !== undefined && budget 
    ? Math.min((Number(summary.expenses) / Number(budget.amount)) * 100, 100)
    : 0;

  const obligationSummary = obligationsData?.summary || {
    totalReceivable: 0,
    totalPayable: 0,
    totalPendingSplits: 0,
    totalUdhariNet: 0,
  };
  const totalReceivable = Number(obligationSummary.totalReceivable || 0);
  const totalPayable = Number(obligationSummary.totalPayable || 0);
  const totalPendingSplits = Number(obligationSummary.totalPendingSplits || 0);
  const totalUdhariNet = Number(obligationSummary.totalUdhariNet ?? (totalReceivable - totalPayable));
  const pendingDebts: any[] = obligationsData?.pendingDebts || [];
  const pendingSplits: any[] = obligationsData?.pendingSplits || [];
  const actionRequired: any[] = obligationsData?.actionRequired || [];
  const agingBuckets: any[] = obligationsData?.aging || [];
  const allPendingItems = [
    ...pendingDebts.map((item: any) => ({ ...item, kind: item.type === "gave" ? "Receivable" : "Payable" })),
    ...pendingSplits.map((item: any) => ({ ...item, kind: "Split" })),
  ];
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const dueTodayItems = allPendingItems.filter((item: any) => (
    format(new Date(item.originalDate), "yyyy-MM-dd") === todayKey
  ));

  return (
    <div className="pb-24 md:pb-8 space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground">
            Dashboard
          </h2>
          <p className="text-muted-foreground mt-1">
            Overview for <span className="font-medium text-foreground">{activeProfile.name}</span> • {monthOptions.find(m => m.value === selectedMonth)?.label} {selectedYear}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-muted/50 p-2 sm:p-1 rounded-lg border border-border w-full sm:w-auto">
            <Select 
              value={selectedMonth.toString()} 
              onValueChange={(val) => setSelectedMonth(parseInt(val))}
            >
              <SelectTrigger className="w-full sm:w-[130px] h-9 border-0 bg-transparent focus:ring-0">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((month) => (
                  <SelectItem key={month.value} value={month.value.toString()}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={selectedYear.toString()} 
              onValueChange={(val) => setSelectedYear(parseInt(val))}
            >
              <SelectTrigger className="w-full sm:w-[100px] h-9 border-0 bg-transparent focus:ring-0">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <AddTransactionDialog profileId={activeProfile.id} />
          {isPro && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded-xl text-xs font-bold">
              <Zap className="h-3 w-3 fill-current" />
              PRO ACTIVE
            </div>
          )}
        </div>
      </header>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-5">
        <Card className="p-4 md:p-5 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-950">
          <div className="flex items-center gap-2 md:gap-4 mb-3">
            <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <Wallet className="h-4 w-4 md:h-5 md:w-5" />
            </div>
            <span className="text-xs md:text-sm font-medium text-muted-foreground leading-tight">Total Balance</span>
          </div>
          {isSummaryLoading ? (
            <Skeleton className="h-8 w-24 md:w-32" />
          ) : (
            <div className="text-xl md:text-2xl lg:text-3xl font-display font-bold text-foreground tracking-tight">
              ₹{summary?.balance.toLocaleString('en-IN') ?? "0"}
            </div>
          )}
        </Card>

        <Card className="p-4 md:p-5 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-white to-green-50/30 dark:from-gray-900 dark:to-green-900/10">
          <div className="flex items-center gap-2 md:gap-4 mb-3">
            <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-4 w-4 md:h-5 md:w-5" />
            </div>
            <span className="text-xs md:text-sm font-medium text-muted-foreground">Income</span>
          </div>
          {isSummaryLoading ? (
            <Skeleton className="h-8 w-24 md:w-32" />
          ) : (
            <div className="text-xl md:text-2xl lg:text-3xl font-display font-bold text-emerald-600 tracking-tight">
              +₹{summary?.income.toLocaleString('en-IN') ?? "0"}
            </div>
          )}
        </Card>

        <Card className="p-4 md:p-5 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow bg-gradient-to-br from-white to-red-50/30 dark:from-gray-900 dark:to-red-900/10">
          <div className="flex items-center gap-2 md:gap-4 mb-3">
            <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
              <TrendingDown className="h-4 w-4 md:h-5 md:w-5" />
            </div>
            <span className="text-xs md:text-sm font-medium text-muted-foreground">Expenses</span>
          </div>
          {isSummaryLoading ? (
            <Skeleton className="h-8 w-24 md:w-32" />
          ) : (
            <div className="text-xl md:text-2xl lg:text-3xl font-display font-bold text-red-600 tracking-tight">
              -₹{summary?.expenses.toLocaleString('en-IN') ?? "0"}
            </div>
          )}
        </Card>

      </div>

      {/* Outstanding Money */}
      <section className="bg-card rounded-2xl border border-border shadow-sm p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-600 flex items-center justify-center">
              <HandCoins className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold font-display">Outstanding Money</h3>
              <p className="text-xs text-muted-foreground">All unsettled Udhari and split bill obligations</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-9 w-fit px-3 text-primary" onClick={() => setLocation("/transactions")}>
            Manage
          </Button>
        </div>

        {isObligationsLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-28 rounded-xl" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">To Receive</span>
                </div>
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400">₹{totalReceivable.toLocaleString("en-IN")}</p>
              </div>
              <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ArrowUpRight className="h-4 w-4 text-rose-600" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-400">To Pay</span>
                </div>
                <p className="text-xl font-bold text-rose-700 dark:text-rose-400">₹{totalPayable.toLocaleString("en-IN")}</p>
              </div>
              <div className="rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-sky-600" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-400">Pending Split Settlements</span>
                </div>
                <p className="text-xl font-bold text-sky-700 dark:text-sky-400">₹{totalPendingSplits.toLocaleString("en-IN")}</p>
              </div>
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="h-4 w-4 text-amber-600" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">Net Position</span>
                </div>
                <p className={cn(
                  "text-xl font-bold",
                  totalUdhariNet >= 0 ? "text-amber-700 dark:text-amber-400" : "text-rose-700 dark:text-rose-400"
                )}>
                  {totalUdhariNet >= 0 ? "+" : "-"}₹{Math.abs(totalUdhariNet).toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5">
              <div className="lg:col-span-2 rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <h4 className="font-bold text-sm">Action Required</h4>
                  </div>
                  <span className="text-xs text-muted-foreground">{actionRequired.length} pending over 30 days</span>
                </div>
                {actionRequired.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-emerald-500" />
                    Nothing needs attention.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                    {actionRequired.map((item: any, index: number) => {
                      const isSplit = item.source === "split";
                      const description = isSplit
                        ? `${item.contactName} split settlement`
                        : item.type === "gave"
                          ? `${item.contactName} owes you`
                          : `You owe ${item.contactName}`;
                      return (
                        <div key={`${item.source}-${item.id}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            {isSplit ? <Users className="h-4 w-4 text-sky-500 shrink-0" /> : <Clock className="h-4 w-4 text-amber-500 shrink-0" />}
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">{description}</p>
                              <p className="text-xs text-muted-foreground">{isSplit ? "Split Bill" : "Udhari"} · {item.daysPending} days pending</p>
                            </div>
                          </div>
                          <span className="text-sm font-bold whitespace-nowrap">₹{Number(item.amount).toLocaleString("en-IN")}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-primary" />
                  <h4 className="font-bold text-sm">Due Today</h4>
                </div>
                {dueTodayItems.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    No obligations due today.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dueTodayItems.map((item: any, index: number) => (
                      <div key={`${item.source}-${item.id}-${index}`} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-background px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">
                            {item.source === "split" ? "Split settlement due" : `${item.contactName} payment expected`}
                          </p>
                          <p className="text-xs text-muted-foreground">{item.source === "split" ? "Split Bill" : "Udhari"}</p>
                        </div>
                        <span className="text-sm font-bold whitespace-nowrap">₹{Number(item.amount).toLocaleString("en-IN")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-bold text-sm">Aging Summary</h4>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {agingBuckets.map((bucket: any, index: number) => {
                  const colors = [
                    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400",
                    "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-400",
                    "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-800 dark:bg-orange-950/20 dark:text-orange-400",
                    "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/20 dark:text-red-400",
                  ];
                  return (
                    <div key={bucket.label || index} className={cn("rounded-lg border p-3", colors[index] || colors[3])}>
                      <p className="text-xs font-semibold">{bucket.label}</p>
                      <p className="mt-1 text-lg font-bold">₹{Number(bucket.total || 0).toLocaleString("en-IN")}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Main Content Column */}
        <div className="lg:col-span-2 space-y-6 md:space-y-8">
          
          {/* Recent Transactions */}
          <section>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h3 className="text-lg font-bold font-display">Recent Activity</h3>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-primary" onClick={() => setLocation("/transactions")}>
                View All <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
            <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
              {isTxLoading ? (
                <div className="p-8 space-y-4">
                  {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
                </div>
              ) : recentTransactions?.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground">
                  <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="h-6 w-6" />
                  </div>
                  <p>No transactions yet this month.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {recentTransactions?.slice(0, 5).map((tx) => (
                    <div key={tx.id} className="p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors">
                      <div className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center text-lg font-bold",
                        tx.category?.color ? `text-white` : "bg-gray-100 text-gray-600"
                      )} style={{ backgroundColor: tx.category?.color || undefined }}>
                        {tx.category?.name.charAt(0) || "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-foreground truncate">{tx.category?.name || "Uncategorized"}</p>
                          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
                            {format(new Date(tx.date), "MMM d, yyyy")}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{tx.note || "No details"}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "font-bold tabular-nums whitespace-nowrap",
                          tx.type === 'income' ? "text-emerald-600" : "text-foreground"
                        )}>
                          {tx.type === 'income' ? "+" : "-"} ₹ {Math.abs(Number(tx.amount)).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6 md:space-y-8">
          {/* Budget Widget */}
          <section className="bg-card rounded-2xl border border-border shadow-sm p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
              <h3 className="font-bold font-display">Monthly Budget</h3>
              {summary?.budgetStatus === 'exceeded' && (
                <span className="px-2 py-1 rounded-md bg-red-100 text-red-700 text-xs font-bold">Exceeded</span>
              )}
            </div>
            
            {budget ? (
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Spent</span>
                  <span className="font-medium">₹ {summary?.expenses.toLocaleString('en-IN')} / ₹ {Number(budget.amount).toLocaleString('en-IN')}</span>
                </div>
                <Progress value={budgetProgress} className={cn("h-3 rounded-full", summary?.budgetStatus === 'exceeded' ? "[&>div]:bg-red-500" : "[&>div]:bg-primary")} />
                <p className="text-xs text-muted-foreground text-center pt-2">
                  {summary?.remainingBudget && summary.remainingBudget > 0 
                    ? `You can spend ₹ ${summary.remainingBudget.toLocaleString('en-IN')} more.`
                    : "You have exceeded your monthly budget."}
                </p>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground mb-4">No budget set for this month.</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => setLocation("/analytics")}
                >
                  Set Budget
                </Button>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

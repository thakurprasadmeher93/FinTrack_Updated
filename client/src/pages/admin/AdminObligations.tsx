import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, HandCoins, ReceiptText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminOverviewData } from "./types";

async function getOverview(): Promise<AdminOverviewData> {
  const response = await fetch("/api/admin/overview", { credentials: "include" });
  if (!response.ok) throw new Error("Unable to load obligation metrics.");
  return response.json();
}

function Metric({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: typeof HandCoins;
  color: string;
}) {
  return (
    <Card className="rounded-2xl border-border shadow-sm">
      <CardContent className="flex items-center justify-between gap-3 p-4">
        <div><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 text-xl font-bold tabular-nums ${color}`}>{value}</p></div>
        <div className="rounded-xl bg-muted/60 p-2"><Icon className={`h-5 w-5 ${color}`} /></div>
      </CardContent>
    </Card>
  );
}

export function AdminObligations() {
  const query = useQuery({
    queryKey: ["/api/admin/overview"],
    queryFn: getOverview,
    staleTime: 30_000,
  });
  const metrics = query.data?.metrics;
  const money = (value: number) => new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Udhari &amp; Split Bills</h2>
        <p className="text-sm text-muted-foreground">Platform-wide totals apply the same settlement, future-date, and split-link rules as the customer-facing obligation view.</p>
      </div>
      {query.isLoading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
        : query.isError || !metrics ? <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">Obligation metrics could not be loaded.</p>
          : (
            <Tabs defaultValue="udhari" className="space-y-4">
              <TabsList className="grid h-auto w-full grid-cols-2 sm:w-fit">
                <TabsTrigger value="udhari">Udhari Khata</TabsTrigger>
                <TabsTrigger value="split">Split Bills</TabsTrigger>
              </TabsList>
              <TabsContent value="udhari" className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <Metric label="Total recorded Udhari" value={money(metrics.udhari.totalAmount)} icon={HandCoins} color="text-indigo-600" />
                  <Metric label="Total records" value={metrics.udhari.totalRecords.toLocaleString("en-IN")} icon={ReceiptText} color="text-slate-600" />
                  <Metric label="Pending records" value={metrics.udhari.pendingRecords.toLocaleString("en-IN")} icon={ReceiptText} color="text-amber-600" />
                  <Metric label="Settled records" value={metrics.udhari.settledRecords.toLocaleString("en-IN")} icon={ReceiptText} color="text-emerald-600" />
                  <Metric label="Settled amount" value={money(metrics.udhari.settledAmount)} icon={HandCoins} color="text-teal-700" />
                  <Metric label="Total outstanding" value={money(metrics.udhari.totalOutstanding)} icon={HandCoins} color="text-rose-600" />
                  <Metric label="Outstanding receivables" value={money(metrics.udhari.outstandingReceivables)} icon={ArrowDownLeft} color="text-emerald-600" />
                  <Metric label="Outstanding payables" value={money(metrics.udhari.outstandingPayables)} icon={ArrowUpRight} color="text-rose-600" />
                </div>
                <Card className="rounded-2xl border-border shadow-sm">
                  <CardHeader><CardTitle className="text-base">Outstanding aging</CardTitle></CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {metrics.udhari.aging.map(row => (
                      <div key={row.range} className="rounded-xl border border-border p-3">
                        <p className="text-xs text-muted-foreground">{row.range} days</p>
                        <p className="mt-1 font-semibold tabular-nums">{money(row.total)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Receivable/payable: {money(row.debts)}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <p className="text-xs text-muted-foreground">Split-linked debt records are excluded so their amount is not counted twice.</p>
              </TabsContent>
              <TabsContent value="split" className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <Metric label="Total split bills" value={metrics.splitBills.total.toLocaleString("en-IN")} icon={ReceiptText} color="text-sky-700" />
                  <Metric label="Active split bills" value={metrics.splitBills.active.toLocaleString("en-IN")} icon={ReceiptText} color="text-amber-600" />
                  <Metric label="Settled split bills" value={metrics.splitBills.settled.toLocaleString("en-IN")} icon={ReceiptText} color="text-emerald-600" />
                  <Metric label="Settled share amount" value={money(metrics.splitBills.settledAmount)} icon={HandCoins} color="text-teal-700" />
                  <Metric label="Pending participant shares" value={metrics.splitBills.pendingSettlements.toLocaleString("en-IN")} icon={ReceiptText} color="text-rose-600" />
                  <Metric label="Outstanding share amount" value={money(metrics.splitBills.pendingAmount)} icon={HandCoins} color="text-rose-600" />
                </div>
                <Card className="rounded-2xl border-border shadow-sm">
                  <CardHeader><CardTitle className="text-base">Split-bill aging</CardTitle></CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {metrics.udhari.aging.map(row => (
                      <div key={row.range} className="rounded-xl border border-border p-3">
                        <p className="text-xs text-muted-foreground">{row.range} days</p>
                        <p className="mt-1 font-semibold tabular-nums">{money(row.splits)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Outstanding participant shares</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
    </div>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, FilterX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminAuditPage } from "./types";

type AuditFilters = { actor: string; action: string; target: string; targetUserId: string; from: string; to: string; result: string };
const emptyFilters: AuditFilters = { actor: "", action: "", target: "", targetUserId: "", from: "", to: "", result: "all" };

async function loadAuditLogs(page: number, pageSize: number, filters: AuditFilters): Promise<AdminAuditPage> {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), ...filters });
  const response = await fetch(`/api/admin/audit-logs?${params}`, { credentials: "include" });
  if (!response.ok) throw new Error("Unable to load the audit log.");
  return response.json();
}

function timestamp(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
}

function actionName(action: string) {
  return action.replace(/^admin:/, "").replaceAll("_", " ");
}

export function AdminAuditLogs() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filters, setFilters] = useState(emptyFilters);
  const updateFilter = (key: keyof AuditFilters, value: string) => {
    setFilters(current => ({ ...current, [key]: value }));
    setPage(1);
  };
  const query = useQuery({
    queryKey: ["/api/admin/audit-logs", page, pageSize, filters],
    queryFn: () => loadAuditLogs(page, pageSize, filters),
    placeholderData: previous => previous,
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Audit logs</h2>
        <p className="text-sm text-muted-foreground">Filter platform activity by date, actor, action, target user, and result.</p>
      </div>
      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="space-y-4">
          <CardTitle className="text-base">Filters</CardTitle>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <Input aria-label="Filter by actor" value={filters.actor} onChange={event => updateFilter("actor", event.target.value)} placeholder="Actor name or email" />
            <Input aria-label="Filter by action" value={filters.action} onChange={event => updateFilter("action", event.target.value)} placeholder="Action, e.g. login or coupon" />
            <Input aria-label="Filter by target" value={filters.target} onChange={event => updateFilter("target", event.target.value)} placeholder="Target type, ID, name, or email" />
            <label className="space-y-1 text-xs text-muted-foreground">From date
              <Input type="date" value={filters.from} onChange={event => updateFilter("from", event.target.value)} />
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">To date
              <Input type="date" value={filters.to} onChange={event => updateFilter("to", event.target.value)} />
            </label>
            <div className="flex gap-2">
              <Select value={filters.result} onValueChange={value => updateFilter("result", value)}>
                <SelectTrigger aria-label="Filter by result"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All results</SelectItem><SelectItem value="success">Successful</SelectItem><SelectItem value="failure">Failed</SelectItem></SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={() => { setFilters(emptyFilters); setPage(1); }}><FilterX className="h-4 w-4" /> Reset</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {query.isLoading ? <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
            : query.isError || !query.data ? <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">Audit logs could not be loaded. <Button variant="outline" size="sm" className="ml-2" onClick={() => query.refetch()}>Retry</Button></div>
              : (
                <>
                  <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
                    <table className="w-full min-w-[1060px] text-sm">
                      <thead className="bg-muted/40"><tr>
                        <th className="px-3 py-3 text-left">Timestamp (IST)</th>
                        <th className="px-3 py-3 text-left">Actor</th>
                        <th className="px-3 py-3 text-left">Action</th>
                        <th className="px-3 py-3 text-left">Target</th>
                        <th className="px-3 py-3 text-left">Result</th>
                        <th className="px-3 py-3 text-left">Details / metadata</th>
                      </tr></thead>
                      <tbody className="divide-y divide-border">
                        {query.data.items.map(item => (
                          <tr key={item.id}>
                            <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{timestamp(item.createdAt)}</td>
                            <td className="px-3 py-3"><div className="font-medium">{item.actorName || "FinTrack user"}</div><div className="text-xs text-muted-foreground">{item.actorEmail}</div></td>
                            <td className="px-3 py-3 font-medium capitalize">{actionName(item.action)}</td>
                            <td className="px-3 py-3"><div className="capitalize">{item.entityType}{item.entityId ? ` #${item.entityId}` : ""}</div>{item.targetEmail && <div className="text-xs text-muted-foreground">{item.targetName || item.targetEmail}</div>}</td>
                            <td className="px-3 py-3"><Badge variant={item.success ? "default" : "destructive"}>{item.success ? "Success" : "Failure"}</Badge></td>
                            <td className="max-w-[320px] px-3 py-3 text-muted-foreground">
                              <p>{item.details || "—"}</p>
                              {Object.keys(item.metadata).length > 0 && <details className="mt-1"><summary className="cursor-pointer text-xs">Metadata</summary><pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap text-[11px]">{JSON.stringify(item.metadata, null, 2)}</pre></details>}
                            </td>
                          </tr>
                        ))}
                        {!query.data.items.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No audit activity matches these filters.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <div className="space-y-3 md:hidden">
                    {query.data.items.map(item => (
                      <div key={item.id} className="rounded-xl border border-border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium capitalize">{actionName(item.action)}</p>
                          <div className="flex items-center gap-2"><Badge variant={item.success ? "default" : "destructive"}>{item.success ? "Success" : "Failure"}</Badge><time className="text-xs text-muted-foreground">{timestamp(item.createdAt)}</time></div>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">Actor: {item.actorName || "FinTrack user"} · {item.actorEmail}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Target: {item.targetName || item.targetEmail || `${item.entityType}${item.entityId ? ` #${item.entityId}` : ""}`}</p>
                        {item.details && <p className="mt-2 text-sm">{item.details}</p>}
                        {Object.keys(item.metadata).length > 0 && <details className="mt-2"><summary className="cursor-pointer text-xs text-muted-foreground">Metadata</summary><pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap rounded bg-muted/40 p-2 text-[11px]">{JSON.stringify(item.metadata, null, 2)}</pre></details>}
                      </div>
                    ))}
                    {!query.data.items.length && <p className="py-8 text-center text-sm text-muted-foreground">No audit activity matches these filters.</p>}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{query.data.total.toLocaleString("en-IN")} records</span>
                      <Select value={String(pageSize)} onValueChange={value => { setPageSize(Number(value)); setPage(1); }}>
                        <SelectTrigger className="h-8 w-[82px]" aria-label="Audit page size"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="25">25</SelectItem><SelectItem value="50">50</SelectItem><SelectItem value="100">100</SelectItem></SelectContent>
                      </Select>
                      <span>Page {query.data.page} of {Math.max(1, query.data.totalPages)}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" disabled={page <= 1 || query.isFetching} onClick={() => setPage(value => Math.max(1, value - 1))}><ChevronLeft className="h-4 w-4" /> Previous</Button>
                      <Button size="sm" variant="outline" disabled={page >= query.data.totalPages || query.isFetching} onClick={() => setPage(value => value + 1)}>Next <ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </>
              )}
        </CardContent>
      </Card>
    </div>
  );
}

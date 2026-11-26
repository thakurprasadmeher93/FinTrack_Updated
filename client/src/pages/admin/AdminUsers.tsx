import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Eye, LogOut, Search, ShieldAlert, UserRound, UserRoundCheck, UserRoundX } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminUser, AdminUserDetail, AdminUserPage } from "./types";

const pageSizes = [25, 50, 100];
const statusOptions = [
  { value: "all", label: "All users" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
  { value: "free", label: "Free plan" },
  { value: "paid", label: "Paid plan" },
  { value: "admin", label: "Admins" },
];

function formatDate(value: string | null | undefined, includeTime = false) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
  });
}

function statusBadge(status: AdminUser["accountStatus"]) {
  const classes = {
    active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    inactive: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
    suspended: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  };
  return <Badge variant="outline" className={`border-transparent capitalize ${classes[status]}`}>{status}</Badge>;
}

async function loadUsers(params: {
  page: number;
  pageSize: number;
  search: string;
  filter: string;
  sortBy: string;
  sortDir: "asc" | "desc";
}): Promise<AdminUserPage> {
  const query = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize),
    search: params.search,
    filter: params.filter,
    sortBy: params.sortBy,
    sortDir: params.sortDir,
  });
  const response = await fetch(`/api/admin/users?${query}`, { credentials: "include" });
  if (!response.ok) throw new Error("Unable to load users.");
  return response.json();
}

async function loadUserDetail(id: number): Promise<AdminUserDetail> {
  const response = await fetch(`/api/admin/users/${id}`, { credentials: "include" });
  if (!response.ok) throw new Error("Unable to load this user.");
  return response.json();
}

export function AdminUsers() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const usersQuery = useQuery({
    queryKey: ["/api/admin/users", page, pageSize, search, filter, sortBy, sortDir],
    queryFn: () => loadUsers({ page, pageSize, search, filter, sortBy, sortDir }),
    placeholderData: previous => previous,
    staleTime: 15_000,
  });
  const detailQuery = useQuery({
    queryKey: ["/api/admin/users", selectedUserId],
    queryFn: () => loadUserDetail(selectedUserId as number),
    enabled: selectedUserId !== null,
  });

  const refreshAdminData = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
    queryClient.invalidateQueries({ queryKey: ["/api/admin/overview"] });
    if (selectedUserId !== null) {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", selectedUserId] });
    }
  };

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: AdminUser["accountStatus"] }) => {
      const response = await fetch(`/api/admin/users/${id}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error((await response.json()).message || "Status update failed.");
      return response.json();
    },
    onSuccess: (_result, variables) => {
      toast({ title: "Account status updated" });
      refreshAdminData();
      if (variables.status !== "active") setSelectedUserId(variables.id);
    },
    onError: error => toast({ title: "Could not update account status", description: error.message, variant: "destructive" }),
  });

  const forceLogoutMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/admin/users/${id}/force-logout`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error((await response.json()).message || "Session invalidation failed.");
      return response.json() as Promise<{ sessionsInvalidated: number }>;
    },
    onSuccess: result => {
      toast({ title: "User sessions invalidated", description: `${result.sessionsInvalidated} session(s) were logged out.` });
      refreshAdminData();
    },
    onError: error => toast({ title: "Could not force logout", description: error.message, variant: "destructive" }),
  });

  const usersPage = usersQuery.data;
  const detail = detailQuery.data;
  const userRows = useMemo(() => usersPage?.items || [], [usersPage?.items]);

  const runSearch = () => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const changeSort = (key: string) => {
    setPage(1);
    if (sortBy === key) setSortDir(current => current === "asc" ? "desc" : "asc");
    else {
      setSortBy(key);
      setSortDir(key === "name" || key === "email" ? "asc" : "desc");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">User management</h2>
          <p className="text-sm text-muted-foreground">Search, review and manage accounts. Sensitive credentials are never shown.</p>
        </div>
        {usersPage && <p className="text-xs text-muted-foreground">{usersPage.total.toLocaleString("en-IN")} users</p>}
      </div>

      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Registered users</CardTitle>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <form className="flex min-w-0 flex-1 gap-2" onSubmit={event => { event.preventDefault(); runSearch(); }}>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchInput}
                  onChange={event => setSearchInput(event.target.value)}
                  placeholder="Search name or email"
                  aria-label="Search users by name or email"
                  className="pl-9"
                />
              </div>
              <Button type="submit" variant="secondary">Search</Button>
            </form>
            <Select value={filter} onValueChange={value => { setFilter(value); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-48" aria-label="Filter users">
                <SelectValue placeholder="Filter users" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={value => {
              setSortBy(value);
              setSortDir(value === "name" || value === "email" ? "asc" : "desc");
              setPage(1);
            }}>
              <SelectTrigger className="w-full sm:w-48" aria-label="Sort users">
                <SelectValue placeholder="Sort users" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="createdAt">Registration date</SelectItem>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="status">Account status</SelectItem>
                <SelectItem value="subscription">Subscription</SelectItem>
                <SelectItem value="lastLogin">Last login</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="px-3 md:px-6">
          {usersQuery.isLoading ? (
            <div className="space-y-3">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div>
          ) : usersQuery.isError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm">
              <p className="font-medium">Users could not be loaded.</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => usersQuery.refetch()}>Retry</Button>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
                <table className="w-full min-w-[1000px] text-sm">
                  <thead className="bg-muted/40">
                    <tr>
                      {[
                        ["name", "User"],
                        ["email", "Email"],
                        ["status", "Status"],
                        ["subscription", "Subscription"],
                        ["createdAt", "Registration Date"],
                        ["lastLogin", "Last Login"],
                      ].map(([key, label]) => (
                        <th key={key} className="px-3 py-3 text-left font-semibold">
                          <button type="button" onClick={() => changeSort(key)} className="inline-flex items-center gap-1 hover:text-primary">
                            {label}
                            {sortBy === key && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                          </button>
                        </th>
                      ))}
                      <th className="px-3 py-3 text-right font-semibold">Transactions</th>
                      <th className="px-3 py-3 text-right font-semibold">Profiles</th>
                      <th className="px-3 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {userRows.map(row => (
                      <tr key={row.id} className="hover:bg-muted/30">
                        <td className="px-3 py-3">
                          <div className="font-medium">{row.displayName || "FinTrack user"}</div>
                          <div className="text-xs text-muted-foreground">ID {row.id}{row.adminRole !== "user" ? ` · ${row.adminRole.replaceAll("_", " ")}` : ""}</div>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">{row.email}</td>
                        <td className="px-3 py-3">{statusBadge(row.accountStatus)}</td>
                        <td className="px-3 py-3"><Badge variant={row.subscriptionStatus === "paid" ? "default" : "secondary"}>{row.subscriptionStatus === "paid" ? "Paid" : "Free"}</Badge></td>
                        <td className="px-3 py-3 text-muted-foreground">{formatDate(row.createdAt)}</td>
                        <td className="px-3 py-3 text-muted-foreground">{formatDate(row.lastLogin, true)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{row.transactionCount.toLocaleString("en-IN")}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{row.profileCount.toLocaleString("en-IN")}</td>
                        <td className="px-3 py-3 text-right">
                          <Button variant="outline" size="sm" onClick={() => setSelectedUserId(row.id)}>
                            <Eye className="h-4 w-4" /> View
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {!userRows.length && <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">No users match these search options.</td></tr>}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {userRows.map(row => (
                  <div key={row.id} className="rounded-xl border border-border p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{row.displayName || "FinTrack user"}</p>
                        <p className="truncate text-xs text-muted-foreground">{row.email}</p>
                        <p className="mt-1 text-xs text-muted-foreground">ID {row.id}{row.adminRole !== "user" ? ` · ${row.adminRole.replaceAll("_", " ")}` : ""}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {statusBadge(row.accountStatus)}
                        <Badge variant={row.subscriptionStatus === "paid" ? "default" : "secondary"}>{row.subscriptionStatus === "paid" ? "Paid" : "Free"}</Badge>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-xs">
                      <p><span className="text-muted-foreground">Joined: </span>{formatDate(row.createdAt)}</p>
                      <p><span className="text-muted-foreground">Last login: </span>{formatDate(row.lastLogin, true)}</p>
                      <p><span className="text-muted-foreground">Transactions: </span>{row.transactionCount}</p>
                      <p><span className="text-muted-foreground">Profiles: </span>{row.profileCount}</p>
                    </div>
                    <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setSelectedUserId(row.id)}>
                      <Eye className="h-4 w-4" /> View details
                    </Button>
                  </div>
                ))}
                {!userRows.length && <p className="py-8 text-center text-sm text-muted-foreground">No users match these search options.</p>}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Rows per page</span>
                  <Select value={String(pageSize)} onValueChange={value => { setPageSize(Number(value)); setPage(1); }}>
                    <SelectTrigger className="h-8 w-[82px]" aria-label="Rows per page"><SelectValue /></SelectTrigger>
                    <SelectContent>{pageSizes.map(size => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent>
                  </Select>
                  <span>{usersPage?.total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, usersPage.total)} of ${usersPage.total}` : "0 users"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1 || usersQuery.isFetching} onClick={() => setPage(value => Math.max(1, value - 1))}>
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </Button>
                  <span className="min-w-16 text-center text-xs text-muted-foreground">Page {usersPage?.page || page} / {Math.max(1, usersPage?.totalPages || 1)}</span>
                  <Button variant="outline" size="sm" disabled={!usersPage || page >= usersPage.totalPages || usersQuery.isFetching} onClick={() => setPage(value => value + 1)}>
                    Next <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={selectedUserId !== null} onOpenChange={open => { if (!open) setSelectedUserId(null); }}>
        <DialogContent className="flex max-h-[95vh] flex-col overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 pb-4 pt-6">
            <DialogTitle>User details</DialogTitle>
            <DialogDescription>Account overview and controls. Passwords, reset tokens and session secrets are never displayed.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {detailQuery.isLoading ? <Skeleton className="h-48 w-full" /> : detailQuery.isError || !detail ? (
              <div className="rounded-lg border border-destructive/30 p-4 text-sm text-destructive">User details could not be loaded.</div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><UserRound className="h-5 w-5" /></div>
                    <div>
                      <h3 className="font-semibold">{detail.user.displayName || "FinTrack user"}</h3>
                      <p className="text-sm text-muted-foreground">{detail.user.email}</p>
                      <p className="text-xs text-muted-foreground">User ID {detail.user.id}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {statusBadge(detail.user.accountStatus)}
                    <Badge variant={detail.user.subscriptionStatus === "paid" ? "default" : "secondary"}>{detail.user.subscriptionStatus === "paid" ? "Paid" : "Free"}</Badge>
                    {detail.user.adminRole !== "user" && <Badge variant="outline" className="capitalize">{detail.user.adminRole.replaceAll("_", " ")}</Badge>}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl border border-border p-4 sm:grid-cols-2">
                  <Info label="Registration date" value={formatDate(detail.user.createdAt, true)} />
                  <Info label="Last login" value={formatDate(detail.user.lastLogin, true)} />
                  <Info label="Account status" value={detail.user.accountStatus} />
                  <Info label="Admin role" value={detail.user.adminRole.replaceAll("_", " ")} />
                  <Info label="Subscription" value={detail.user.subscriptionStatus === "paid" ? "Paid" : "Free"} />
                </div>

                <section>
                  <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Usage</h3>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <Usage label="Profiles" value={detail.usage.profiles} />
                    <Usage label="Transactions" value={detail.usage.transactions} />
                    <Usage label="Income" value={detail.usage.income} money />
                    <Usage label="Expenses" value={detail.usage.expenses} money />
                    <Usage label="Budgets" value={detail.usage.budgets} />
                    <Usage label="Udhari records" value={detail.usage.udhariRecords} />
                    <Usage label="Udhari outstanding" value={detail.usage.udhariOutstanding} money />
                    <Usage label="Split Bills" value={detail.usage.splitBills} />
                    <Usage label="Pending split settlements" value={detail.usage.pendingSplitSettlements} />
                    <Usage label="Wealth snapshots" value={detail.usage.wealthSnapshots} />
                  </div>
                </section>

                <section>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent activity</h3>
                  {detail.recentActivity.length ? (
                    <div className="space-y-2">
                      {detail.recentActivity.map(activity => (
                        <div key={activity.id} className="flex flex-col gap-1 rounded-lg bg-muted/40 px-3 py-2 text-sm sm:flex-row sm:justify-between sm:gap-3">
                          <div className="min-w-0">
                            <span className="capitalize">{activity.action.replace(/^admin:/, "").replaceAll("_", " ")} · {activity.entityType}</span>
                            {activity.details && <p className="mt-0.5 text-xs text-muted-foreground">{activity.details}</p>}
                            {activity.actorId !== detail.user.id && <p className="mt-0.5 text-xs text-muted-foreground">By {activity.actorName || activity.actorEmail}</p>}
                            {!activity.success && <Badge variant="destructive" className="mt-1">Failed</Badge>}
                          </div>
                          <time className="shrink-0 text-xs text-muted-foreground">{formatDate(activity.createdAt, true)}</time>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-sm text-muted-foreground">No audit activity is available for this user.</p>}
                </section>

                <section className="space-y-3 border-t border-border pt-4">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Account controls</h3>
                  {detail.user.isAdmin || detail.user.adminRole !== "user" ? (
                    <p className="text-sm text-muted-foreground">Role-bearing account controls are disabled here to prevent locking out administrator access.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {detail.user.accountStatus !== "active" && <Button size="sm" variant="outline" disabled={statusMutation.isPending} onClick={() => changeUserStatus(detail.user, "active", statusMutation.mutate)}><UserRoundCheck className="h-4 w-4" /> Activate</Button>}
                      {detail.user.accountStatus === "active" && <Button size="sm" variant="outline" disabled={statusMutation.isPending} onClick={() => changeUserStatus(detail.user, "inactive", statusMutation.mutate)}><UserRoundX className="h-4 w-4" /> Deactivate</Button>}
                      {detail.user.accountStatus !== "suspended" && <Button size="sm" variant="outline" disabled={statusMutation.isPending} onClick={() => changeUserStatus(detail.user, "suspended", statusMutation.mutate)}><ShieldAlert className="h-4 w-4" /> Suspend</Button>}
                      {detail.user.accountStatus === "suspended" && <Button size="sm" variant="outline" disabled={statusMutation.isPending} onClick={() => changeUserStatus(detail.user, "active", statusMutation.mutate)}><UserRoundCheck className="h-4 w-4" /> Unsuspend</Button>}
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={forceLogoutMutation.isPending || detail.user.id === currentUser?.id}
                        onClick={() => {
                          if (window.confirm("Invalidate all active sessions for this user? This will not delete account or financial data.")) {
                            forceLogoutMutation.mutate(detail.user.id);
                          }
                        }}
                      >
                        <LogOut className="h-4 w-4" /> Force logout
                      </Button>
                    </div>
                  )}
                </section>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 text-sm font-medium capitalize">{value}</p></div>;
}

function Usage({ label, value, money = false }: { label: string; value: number; money?: boolean }) {
  const formatted = money
    ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value)
    : value.toLocaleString("en-IN");
  return <div className="rounded-lg bg-muted/40 p-3"><p className="text-[11px] leading-tight text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold tabular-nums">{formatted}</p></div>;
}

function changeUserStatus(
  user: AdminUserDetail["user"],
  status: AdminUser["accountStatus"],
  mutate: (input: { id: number; status: AdminUser["accountStatus"] }) => void,
) {
  const action = status === "active" ? "activate" : status === "inactive" ? "deactivate" : "suspend";
  if (window.confirm(`Are you sure you want to ${action} ${user.displayName || user.email}?`)) {
    mutate({ id: user.id, status });
  }
}

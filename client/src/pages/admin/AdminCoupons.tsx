import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Pencil, Plus, Search, TicketPercent, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { AdminCoupon, AdminCouponPage } from "./types";

type CouponForm = {
  code: string;
  description: string;
  discountType: "percentage" | "fixed_amount";
  discountValue: string;
  startsAt: string;
  expiresAt: string;
  maxRedemptions: string;
  isActive: boolean;
};

const pageSize = 25;
const statuses = ["all", "active", "inactive", "scheduled", "expired", "exhausted"] as const;

function localDateTime(value: Date) {
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function dateForInput(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : localDateTime(date);
}

function emptyForm(): CouponForm {
  const now = new Date();
  const expiry = new Date(now);
  expiry.setMonth(expiry.getMonth() + 1);
  return {
    code: "",
    description: "",
    discountType: "percentage",
    discountValue: "10",
    startsAt: localDateTime(now),
    expiresAt: localDateTime(expiry),
    maxRedemptions: "",
    isActive: true,
  };
}

function couponState(coupon: AdminCoupon) {
  if (!coupon.isActive) return "Inactive";
  const now = Date.now();
  if (new Date(coupon.startsAt).getTime() > now) return "Scheduled";
  if (new Date(coupon.expiresAt).getTime() < now) return "Expired";
  if (coupon.maxRedemptions !== null && coupon.currentRedemptions >= coupon.maxRedemptions) return "Exhausted";
  return "Active";
}

function formattedDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
}

async function request(url: string, init?: RequestInit) {
  const response = await fetch(url, { credentials: "include", ...init });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || "Coupon request failed.");
  }
  return response.status === 204 ? null : response.json();
}

export function AdminCoupons() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof statuses)[number]>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminCoupon | null>(null);
  const [form, setForm] = useState<CouponForm>(emptyForm);

  const queryKey = ["/api/admin/coupons", page, search, status];
  const query = useQuery({
    queryKey,
    queryFn: async (): Promise<AdminCouponPage> => {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), search, status });
      return request(`/api/admin/coupons?${params}`);
    },
    placeholderData: previous => previous,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["/api/admin/coupons"] });
  const saveMutation = useMutation({
    mutationFn: ({ id, body }: { id: number | null; body: Record<string, unknown> }) => request(
      id === null ? "/api/admin/coupons" : `/api/admin/coupons/${id}`,
      { method: id === null ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    ),
    onSuccess: () => {
      refresh();
      setDialogOpen(false);
      toast({ title: editing ? "Coupon updated" : "Coupon created" });
    },
    onError: error => toast({ title: "Coupon was not saved", description: error.message, variant: "destructive" }),
  });
  const toggleMutation = useMutation({
    mutationFn: ({ coupon, isActive }: { coupon: AdminCoupon; isActive: boolean }) => request(
      `/api/admin/coupons/${coupon.id}`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive }) },
    ),
    onSuccess: () => { refresh(); toast({ title: "Coupon status updated" }); },
    onError: error => toast({ title: "Coupon status was not changed", description: error.message, variant: "destructive" }),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: number) => request(`/api/admin/coupons/${id}`, { method: "DELETE" }),
    onSuccess: () => { refresh(); toast({ title: "Coupon deleted" }); },
    onError: error => toast({ title: "Coupon was not deleted", description: error.message, variant: "destructive" }),
  });

  const items = query.data?.items || [];
  const pageCount = query.data?.totalPages || 0;
  const summary = useMemo(() => `${(query.data?.total || 0).toLocaleString("en-IN")} coupons`, [query.data?.total]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setDialogOpen(true);
  };

  const openEdit = (coupon: AdminCoupon) => {
    setEditing(coupon);
    setForm({
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discountValue: String(coupon.discountValue),
      startsAt: dateForInput(coupon.startsAt),
      expiresAt: dateForInput(coupon.expiresAt),
      maxRedemptions: coupon.maxRedemptions === null ? "" : String(coupon.maxRedemptions),
      isActive: coupon.isActive,
    });
    setDialogOpen(true);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!form.startsAt || !form.expiresAt) {
      toast({ title: "Enter both coupon dates", variant: "destructive" });
      return;
    }
    const body = {
      ...form,
      code: form.code.trim().toUpperCase(),
      discountValue: Number(form.discountValue),
      startsAt: new Date(form.startsAt).toISOString(),
      expiresAt: new Date(form.expiresAt).toISOString(),
      maxRedemptions: form.maxRedemptions.trim() ? Number(form.maxRedemptions) : null,
    };
    saveMutation.mutate({ id: editing?.id ?? null, body });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Coupons</h2>
          <p className="text-sm text-muted-foreground">Manage coupon definitions only. No payment or redemption processing is connected.</p>
        </div>
        <Button onClick={openCreate}><Plus className="h-4 w-4" /> New coupon</Button>
      </div>

      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Coupon list</CardTitle>
            <p className="text-xs text-muted-foreground">{summary}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_190px_auto]">
            <form className="relative" onSubmit={event => { event.preventDefault(); setSearch(searchInput.trim()); setPage(1); }}>
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="Search code or description" className="pl-9" />
            </form>
            <Select value={status} onValueChange={value => { setStatus(value as (typeof statuses)[number]); setPage(1); }}>
              <SelectTrigger aria-label="Filter coupons by status"><SelectValue /></SelectTrigger>
              <SelectContent>{statuses.map(value => <SelectItem key={value} value={value}>{value === "all" ? "All statuses" : value[0].toUpperCase() + value.slice(1)}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" onClick={() => { setSearchInput(""); setSearch(""); setStatus("all"); setPage(1); }}>Reset</Button>
          </div>
        </CardHeader>
        <CardContent>
          {query.isLoading ? <div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-14 w-full" />)}</div>
            : query.isError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
                <p>Coupons could not be loaded.</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => query.refetch()}>Retry</Button>
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
                  <table className="w-full min-w-[930px] text-sm">
                    <thead className="bg-muted/40"><tr>
                      <th className="px-3 py-3 text-left">Code</th>
                      <th className="px-3 py-3 text-left">Discount</th>
                      <th className="px-3 py-3 text-left">Validity (IST)</th>
                      <th className="px-3 py-3 text-left">Redemptions</th>
                      <th className="px-3 py-3 text-left">Status</th>
                      <th className="px-3 py-3 text-right">Actions</th>
                    </tr></thead>
                    <tbody className="divide-y divide-border">
                      {items.map(coupon => (
                        <tr key={coupon.id}>
                          <td className="px-3 py-3"><p className="font-semibold tracking-wide">{coupon.code}</p><p className="max-w-56 truncate text-xs text-muted-foreground">{coupon.description || "No description"}</p><p className="mt-1 text-[11px] text-muted-foreground">Created {formattedDate(coupon.createdAt)}</p></td>
                          <td className="px-3 py-3">{coupon.discountType === "percentage" ? `${coupon.discountValue}%` : `₹${coupon.discountValue}`}</td>
                          <td className="px-3 py-3 text-xs text-muted-foreground"><p>{formattedDate(coupon.startsAt)}</p><p>to {formattedDate(coupon.expiresAt)}</p></td>
                          <td className="px-3 py-3 tabular-nums">{coupon.currentRedemptions.toLocaleString("en-IN")} / {coupon.maxRedemptions ?? "Unlimited"}</td>
                          <td className="px-3 py-3"><Badge variant="outline" className="capitalize">{couponState(coupon)}</Badge></td>
                          <td className="px-3 py-3">
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" aria-label={`Edit ${coupon.code}`} onClick={() => openEdit(coupon)}><Pencil className="h-4 w-4" /></Button>
                              <Button size="sm" variant="outline" disabled={toggleMutation.isPending} onClick={() => toggleMutation.mutate({ coupon, isActive: !coupon.isActive })}>{coupon.isActive ? "Deactivate" : "Activate"}</Button>
                              <Button size="icon" variant="ghost" aria-label={`Delete ${coupon.code}`} disabled={coupon.currentRedemptions > 0 || deleteMutation.isPending} onClick={() => {
                                if (window.confirm(`Delete coupon ${coupon.code}? This cannot be undone.`)) deleteMutation.mutate(coupon.id);
                              }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!items.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No coupons match these filters.</td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="space-y-3 md:hidden">
                  {items.map(coupon => (
                      <div key={coupon.id} className="rounded-xl border border-border p-3">
                      <div className="flex items-start justify-between gap-2"><div><p className="font-semibold tracking-wide">{coupon.code}</p><p className="text-sm text-muted-foreground">{coupon.description || "No description"}</p></div><Badge variant="outline">{couponState(coupon)}</Badge></div>
                      <p className="mt-2 text-sm">{coupon.discountType === "percentage" ? `${coupon.discountValue}% off` : `₹${coupon.discountValue} off`}</p>
                        <p className="mt-1 text-xs text-muted-foreground">Created {formattedDate(coupon.createdAt)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formattedDate(coupon.startsAt)} – {formattedDate(coupon.expiresAt)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Used {coupon.currentRedemptions} / {coupon.maxRedemptions ?? "Unlimited"}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => openEdit(coupon)}><Pencil className="h-4 w-4" /> Edit</Button>
                        <Button size="sm" variant="outline" disabled={toggleMutation.isPending} onClick={() => toggleMutation.mutate({ coupon, isActive: !coupon.isActive })}>{coupon.isActive ? "Deactivate" : "Activate"}</Button>
                        <Button size="sm" variant="ghost" disabled={coupon.currentRedemptions > 0 || deleteMutation.isPending} onClick={() => {
                          if (window.confirm(`Delete coupon ${coupon.code}? This cannot be undone.`)) deleteMutation.mutate(coupon.id);
                        }}><Trash2 className="h-4 w-4 text-destructive" /> Delete</Button>
                      </div>
                    </div>
                  ))}
                  {!items.length && <p className="py-8 text-center text-sm text-muted-foreground">No coupons match these filters.</p>}
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <p className="text-xs text-muted-foreground">{query.data?.total || 0} records · Page {page} of {Math.max(1, pageCount)}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={page <= 1 || query.isFetching} onClick={() => setPage(value => Math.max(1, value - 1))}><ChevronLeft className="h-4 w-4" /> Previous</Button>
                    <Button size="sm" variant="outline" disabled={!pageCount || page >= pageCount || query.isFetching} onClick={() => setPage(value => value + 1)}>Next <ChevronRight className="h-4 w-4" /></Button>
                  </div>
                </div>
              </>
            )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={open => { if (!open && !saveMutation.isPending) setDialogOpen(false); }}>
        <DialogContent className="flex max-h-[95vh] flex-col overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 pb-4 pt-6">
            <DialogTitle>{editing ? "Edit coupon" : "Create coupon"}</DialogTitle>
            <DialogDescription>Coupon values are stored for future use; this does not connect checkout or process payments.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="grid flex-1 gap-4 overflow-y-auto px-6 py-5 sm:grid-cols-2">
              <label className="space-y-1.5 text-sm font-medium">Code
                <Input required minLength={3} maxLength={40} value={form.code} onChange={event => setForm(value => ({ ...value, code: event.target.value.toUpperCase() }))} placeholder="WELCOME10" />
              </label>
              <label className="space-y-1.5 text-sm font-medium">Description
                <Input maxLength={240} value={form.description} onChange={event => setForm(value => ({ ...value, description: event.target.value }))} placeholder="Optional internal note" />
              </label>
              <label className="space-y-1.5 text-sm font-medium">Discount type
                <Select value={form.discountType} onValueChange={value => setForm(current => ({ ...current, discountType: value as CouponForm["discountType"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="percentage">Percentage</SelectItem><SelectItem value="fixed_amount">Fixed amount (INR)</SelectItem></SelectContent>
                </Select>
              </label>
              <label className="space-y-1.5 text-sm font-medium">Discount value
                <Input required type="number" min="0.01" max={form.discountType === "percentage" ? "100" : undefined} step="0.01" value={form.discountValue} onChange={event => setForm(value => ({ ...value, discountValue: event.target.value }))} />
              </label>
              <label className="space-y-1.5 text-sm font-medium">Starts at
                <Input required type="datetime-local" value={form.startsAt} onChange={event => setForm(value => ({ ...value, startsAt: event.target.value }))} />
              </label>
              <label className="space-y-1.5 text-sm font-medium">Expires at
                <Input required type="datetime-local" value={form.expiresAt} onChange={event => setForm(value => ({ ...value, expiresAt: event.target.value }))} />
              </label>
              <label className="space-y-1.5 text-sm font-medium">Maximum redemptions
                <Input type="number" min="1" step="1" value={form.maxRedemptions} onChange={event => setForm(value => ({ ...value, maxRedemptions: event.target.value }))} placeholder="Unlimited" />
              </label>
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div><p className="text-sm font-medium">Active</p><p className="text-xs text-muted-foreground">Can be used when dates and limits allow.</p></div>
                <Switch checked={form.isActive} onCheckedChange={isActive => setForm(value => ({ ...value, isActive }))} aria-label="Coupon active" />
              </div>
              {editing && <p className="sm:col-span-2 text-xs text-muted-foreground">Current redemptions are read-only: {editing.currentRedemptions}.</p>}
            </div>
            <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saveMutation.isPending}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>{saveMutation.isPending ? "Saving…" : editing ? "Save changes" : "Create coupon"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {!items.length && query.data && query.data.total === 0 && <p className="sr-only"><TicketPercent /> Empty coupon list</p>}
    </div>
  );
}

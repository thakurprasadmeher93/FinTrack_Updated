import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  useProfiles, useWealthSnapshots, useWealthSnapshot, useWealthAnalytics, useLatestWealthSnapshot,
  useCreateWealthSnapshot, useUpdateWealthSnapshot, useDeleteWealthSnapshot,
} from "@/hooks/use-fin-track";
import type {
  WealthSnapshotWithRows, WealthImmovableRow, WealthMovableRow, WealthOtherRow,
  WealthSnapshot,
} from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Building2, Car, TrendingUp, Wallet, PlusCircle, Pencil, Trash2, Plus,
  Landmark, Layers, BarChart3, Home, History, AlertCircle, ArrowUpRight,
  ArrowDownRight, X, ChevronDown, ChevronUp, RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend, BarChart, Bar,
} from "recharts";

const IMMOVABLE_TYPES = [
  { value: "land", label: "Land / Plot" },
  { value: "house", label: "House" },
  { value: "mortgage", label: "Mortgage / Property Loan" },
  { value: "other", label: "Other" },
  { value: "residential", label: "Residential (older snapshot)" },
  { value: "commercial", label: "Commercial (older snapshot)" },
];

const MOVABLE_TYPES = [
  { value: "four_wheeler", label: "Four Wheeler" },
  { value: "two_wheeler", label: "Two Wheeler" },
  { value: "jewellery", label: "Jewellery / Gold" },
  { value: "furniture", label: "Furniture" },
  { value: "other", label: "Other" },
  { value: "vehicle", label: "Vehicle (older snapshot)" },
  { value: "gold_jewelry", label: "Gold & Jewelry (older snapshot)" },
];

const OTHER_ASSET_TYPES = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank Balance" },
  { value: "insurance", label: "Insurance Policies" },
  { value: "shares", label: "Shares" },
  { value: "mutual_funds", label: "Mutual Funds" },
  { value: "nps", label: "NPS" },
  { value: "ssy", label: "SSY" },
  { value: "ppf", label: "PPF" },
  { value: "epf", label: "EPF / PF" },
  { value: "bonds", label: "Bonds / Debentures" },
  { value: "other", label: "Other" },
  { value: "stocks", label: "Stocks / Shares (older snapshot)" },
  { value: "fd", label: "Fixed Deposit (older snapshot)" },
  { value: "crypto", label: "Crypto (older snapshot)" },
  { value: "savings", label: "Savings / Cash (older snapshot)" },
];

const FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "half_yearly", label: "Half-Yearly" },
  { value: "yearly", label: "Yearly" },
  { value: "manual", label: "Manual / Custom" },
];

const PIE_COLORS = ["#6366f1", "#10b981", "#f59e0b"];

function fmt(val: string | number | null | undefined) {
  return Number(val || 0).toLocaleString("en-IN");
}

function emptyImmovableRow() {
  return {
    name: "", type: "land", location: "", area: "", natureOfLand: "",
    extentOfInterest: "", mannerOfAcquisition: "", inWhoseName: "",
    acquisitionDate: "", purchaseValue: "", currentValue: "",
    loanOutstanding: "", monthlyRentalIncome: "", remarks: "",
  };
}

function emptyMovableRow() {
  return {
    name: "", type: "four_wheeler", description: "", extentOfInterest: "",
    mannerOfAcquisition: "", inWhoseName: "",
    acquisitionDate: "", purchaseValue: "", currentValue: "",
    loanOutstanding: "", remarks: "",
  };
}

function emptyOtherRow() {
  return {
    name: "", type: "mutual_funds", inWhoseName: "", acquisitionDate: "",
    mannerOfAcquisition: "", investedAmount: "", currentValue: "", remarks: "",
  };
}

type ImmovableRowInput = ReturnType<typeof emptyImmovableRow>;
type MovableRowInput = ReturnType<typeof emptyMovableRow>;
type OtherRowInput = ReturnType<typeof emptyOtherRow>;

function prefillFromSnapshot(snap: WealthSnapshotWithRows | null | undefined) {
  if (!snap) return { immovableRows: [emptyImmovableRow()], movableRows: [emptyMovableRow()], otherRows: [emptyOtherRow()] };
  const mapImmovable = (r: WealthImmovableRow): ImmovableRowInput => {
    const { id: _id, snapshotId: _sid, ...rest } = r;
    return {
      name: rest.name ?? "",
      type: rest.type ?? "land",
      location: rest.location ?? "",
      area: rest.area ?? "",
      natureOfLand: rest.natureOfLand ?? "",
      extentOfInterest: rest.extentOfInterest ?? "",
      mannerOfAcquisition: rest.mannerOfAcquisition ?? "",
      inWhoseName: rest.inWhoseName ?? "",
      acquisitionDate: rest.acquisitionDate ? format(new Date(rest.acquisitionDate), "yyyy-MM-dd") : "",
      purchaseValue: rest.purchaseValue?.toString() ?? "",
      currentValue: rest.currentValue?.toString() ?? "",
      loanOutstanding: rest.loanOutstanding?.toString() ?? "",
      monthlyRentalIncome: rest.monthlyRentalIncome?.toString() ?? "",
      remarks: rest.remarks ?? "",
    };
  };
  const mapMovable = (r: WealthMovableRow): MovableRowInput => {
    const { id: _id, snapshotId: _sid, ...rest } = r;
    return {
      name: rest.name ?? "",
      type: rest.type ?? "four_wheeler",
      description: rest.description ?? "",
      extentOfInterest: rest.extentOfInterest ?? "",
      mannerOfAcquisition: rest.mannerOfAcquisition ?? "",
      inWhoseName: rest.inWhoseName ?? "",
      acquisitionDate: rest.acquisitionDate ? format(new Date(rest.acquisitionDate), "yyyy-MM-dd") : "",
      purchaseValue: rest.purchaseValue?.toString() ?? "",
      currentValue: rest.currentValue?.toString() ?? "",
      loanOutstanding: rest.loanOutstanding?.toString() ?? "",
      remarks: rest.remarks ?? "",
    };
  };
  const mapOther = (r: WealthOtherRow): OtherRowInput => {
    const { id: _id, snapshotId: _sid, ...rest } = r;
    return {
      name: rest.name ?? "",
      type: rest.type ?? "mutual_funds",
      inWhoseName: rest.inWhoseName ?? "",
      acquisitionDate: rest.acquisitionDate ? format(new Date(rest.acquisitionDate), "yyyy-MM-dd") : "",
      mannerOfAcquisition: rest.mannerOfAcquisition ?? "",
      investedAmount: rest.investedAmount?.toString() ?? "",
      currentValue: rest.currentValue?.toString() ?? "",
      remarks: rest.remarks ?? "",
    };
  };
  return {
    immovableRows: snap.immovableRows?.length ? snap.immovableRows.map(mapImmovable) : [emptyImmovableRow()],
    movableRows: snap.movableRows?.length ? snap.movableRows.map(mapMovable) : [emptyMovableRow()],
    otherRows: snap.otherRows?.length ? snap.otherRows.map(mapOther) : [emptyOtherRow()],
  };
}

interface ColumnDef {
  key: string;
  label: string;
  type?: string;
  placeholder?: string;
  fullWidth?: boolean;
  options?: { value: string; label: string }[];
}

interface RowTheme {
  headerBg: string;
  iconBg: string;
  iconColor: string;
  rowBorder: string;
  rowBg: string;
  addBtn: string;
}

interface RowTableProps<T extends Record<string, string | undefined>> {
  title: string;
  subtitle?: string;
  rows: T[];
  onAdd: (row: T) => void;
  onRemove: (idx: number) => void;
  onChange: (idx: number, key: string, value: string) => void;
  columns: ColumnDef[];
  emptyRow: () => T;
  icon: React.ElementType;
  theme: RowTheme;
}

function RowTable<T extends Record<string, string | undefined>>({
  title, subtitle, rows, onAdd, onRemove, onChange, columns, emptyRow, icon: Icon, theme
}: RowTableProps<T>) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="rounded-2xl border border-border overflow-hidden shadow-sm">
      {/* Collapsible coloured section header */}
      <div
        className={cn("px-4 py-3 flex items-center justify-between bg-gradient-to-r cursor-pointer select-none", theme.headerBg)}
        onClick={() => setCollapsed(v => !v)}
      >
        <div className="flex items-center gap-3">
          <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0", theme.iconBg)}>
            <Icon className={cn("h-5 w-5", theme.iconColor)} />
          </div>
          <div>
            <h4 className="font-semibold text-sm text-foreground">{title}</h4>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            <p className={cn("text-xs font-medium", theme.iconColor)}>
              {rows.length} {rows.length === 1 ? "entry" : "entries"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button" variant="outline" size="sm"
            className={cn("gap-1 h-8 text-xs", theme.addBtn)}
            onClick={e => { e.stopPropagation(); onAdd(emptyRow()); setCollapsed(false); }}
          >
            <Plus className="h-3 w-3" /> Add Row
          </Button>
          {collapsed
            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
            : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
        </div>
      </div>

      {/* Collapsible row content */}
      {!collapsed && (
        <div className="p-3 bg-background space-y-2">
          {rows.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground border-2 border-dashed rounded-xl">
              No entries yet — click <strong>Add Row</strong> to begin.
            </div>
          ) : (
            rows.map((row, idx) => (
              <div key={idx} className={cn(
                "p-3 border-l-4 rounded-xl space-y-2.5",
                theme.rowBorder, theme.rowBg
              )}>
                <div className="flex items-center justify-between mb-1">
                  <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", theme.iconBg, theme.iconColor)}>
                    #{idx + 1}
                  </span>
                  <Button
                    type="button" variant="ghost" size="sm"
                    className="h-7 text-xs text-destructive gap-1 hover:bg-destructive/10"
                    onClick={() => onRemove(idx)}
                  >
                    <X className="h-3 w-3" /> Remove
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {columns.map((col) => (
                    <div key={col.key} className={col.fullWidth ? "col-span-1 sm:col-span-2" : ""}>
                      <Label className="text-xs text-muted-foreground mb-1 block">{col.label}</Label>
                      {col.type === "select" ? (
                        <Select value={row[col.key] || ""} onValueChange={v => onChange(idx, col.key, v)}>
                          <SelectTrigger className="h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(col.options ?? []).map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          className="h-8 text-xs bg-background"
                          type={col.type || "text"}
                          value={row[col.key] || ""}
                          placeholder={col.placeholder || ""}
                          onChange={e => onChange(idx, col.key, e.target.value)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

interface SnapshotFormValues {
  label: string;
  snapshotDate: string;
  frequency: string;
  notes: string;
  immovableRows: ImmovableRowInput[];
  movableRows: MovableRowInput[];
  otherRows: OtherRowInput[];
}

interface SnapshotFormProps {
  initial?: WealthSnapshotWithRows | null;
  latestSnap?: WealthSnapshotWithRows | null;
  onSubmit: (values: SnapshotFormValues) => void;
  isPending: boolean;
  onCancel?: () => void;
}

function SnapshotForm({ initial, latestSnap, onSubmit, isPending, onCancel }: SnapshotFormProps) {
  const [label, setLabel] = useState(initial?.label || "");
  const [snapshotDate, setSnapshotDate] = useState(
    initial?.snapshotDate ? format(new Date(initial.snapshotDate), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")
  );
  const [frequency, setFrequency] = useState(initial?.frequency || "manual");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [immovableRows, setImmovableRows] = useState<ImmovableRowInput[]>([]);
  const [movableRows, setMovableRows] = useState<MovableRowInput[]>([]);
  const [otherRows, setOtherRows] = useState<OtherRowInput[]>([]);
  const [prefillEnabled, setPrefillEnabled] = useState(!initial && !!latestSnap);

  useEffect(() => {
    if (initial) {
      const d = prefillFromSnapshot(initial);
      setImmovableRows(d.immovableRows);
      setMovableRows(d.movableRows);
      setOtherRows(d.otherRows);
    } else if (prefillEnabled && latestSnap) {
      const d = prefillFromSnapshot(latestSnap);
      setImmovableRows(d.immovableRows);
      setMovableRows(d.movableRows);
      setOtherRows(d.otherRows);
    } else {
      setImmovableRows([emptyImmovableRow()]);
      setMovableRows([emptyMovableRow()]);
      setOtherRows([emptyOtherRow()]);
    }
  }, [prefillEnabled, initial, latestSnap]);

  const totalImm = immovableRows.reduce((s, r) => s + Number(r.currentValue || 0), 0);
  const totalMov = movableRows.reduce((s, r) => s + Number(r.currentValue || 0), 0);
  const totalOth = otherRows.reduce((s, r) => s + Number(r.currentValue || 0), 0);
  // Net worth = sum of all asset current values (liabilities tracked separately, not netted)
  const netWorth = totalImm + totalMov + totalOth;

  function updateRow<T extends Record<string, string | undefined>>(
    setter: React.Dispatch<React.SetStateAction<T[]>>
  ) {
    return (idx: number, key: string, value: string) => {
      setter(rows => rows.map((r, i) => i === idx ? { ...r, [key]: value } : r));
    };
  }

  function addRow<T>(setter: React.Dispatch<React.SetStateAction<T[]>>) {
    return (row: T) => setter(rows => [...rows, row]);
  }

  function removeRow<T>(setter: React.Dispatch<React.SetStateAction<T[]>>) {
    return (idx: number) => setter(rows => rows.filter((_, i) => i !== idx));
  }

  const immCols = [
    { key: "name", label: "Property Name / Brief Description *", placeholder: "e.g. Home at Bandra", fullWidth: true },
    { key: "type", label: "Type", type: "select", options: IMMOVABLE_TYPES },
    { key: "location", label: "Precise Location", placeholder: "Address / City / Area" },
    { key: "area", label: "Area / Extent", placeholder: "e.g. 1,200 sq ft or 5 acres" },
    { key: "natureOfLand", label: "Nature of Land", placeholder: "e.g. Residential / Agricultural" },
    { key: "extentOfInterest", label: "Extent of Interest", placeholder: "e.g. Full owner / 50% share" },
    { key: "mannerOfAcquisition", label: "Manner of Acquisition / Disposal", placeholder: "e.g. Purchased / Inherited" },
    { key: "inWhoseName", label: "In Whose Name", placeholder: "Owner name" },
    { key: "acquisitionDate", label: "Acquisition Date", type: "date" },
    { key: "purchaseValue", label: "Purchase Value (₹)", type: "number", placeholder: "0" },
    { key: "currentValue", label: "Current Value (₹) *", type: "number", placeholder: "0" },
    { key: "loanOutstanding", label: "Loan Outstanding (₹)", type: "number", placeholder: "0" },
    { key: "monthlyRentalIncome", label: "Monthly Rental (₹)", type: "number", placeholder: "0" },
    { key: "remarks", label: "Remarks", placeholder: "Notes", fullWidth: true },
  ];

  const movCols = [
    { key: "name", label: "Brief Description *", placeholder: "e.g. Honda City / Gold chain", fullWidth: true },
    { key: "type", label: "Type", type: "select", options: MOVABLE_TYPES },
    { key: "description", label: "Additional Details", placeholder: "Model / Details" },
    { key: "extentOfInterest", label: "Extent of Interest", placeholder: "e.g. Full owner / 50% share" },
    { key: "mannerOfAcquisition", label: "Manner of Acquisition / Disposal", placeholder: "e.g. Purchased / Inherited" },
    { key: "inWhoseName", label: "In Whose Name", placeholder: "Owner name" },
    { key: "acquisitionDate", label: "Acquisition Date", type: "date" },
    { key: "purchaseValue", label: "Purchase Value (₹)", type: "number", placeholder: "0" },
    { key: "currentValue", label: "Current Value (₹) *", type: "number", placeholder: "0" },
    { key: "loanOutstanding", label: "Loan Outstanding (₹)", type: "number", placeholder: "0" },
    { key: "remarks", label: "Remarks", placeholder: "Notes", fullWidth: true },
  ];

  const othCols = [
    { key: "name", label: "Name *", placeholder: "e.g. HDFC Top 100 MF", fullWidth: true },
    { key: "type", label: "Type", type: "select", options: OTHER_ASSET_TYPES },
    { key: "inWhoseName", label: "In Whose Name", placeholder: "Owner name" },
    { key: "acquisitionDate", label: "Acquisition Date", type: "date" },
    { key: "mannerOfAcquisition", label: "Manner of Acquisition / Disposal", placeholder: "e.g. Purchased / Gifted" },
    { key: "investedAmount", label: "Amount Invested (₹)", type: "number", placeholder: "0" },
    { key: "currentValue", label: "Current Value (₹) *", type: "number", placeholder: "0" },
    { key: "remarks", label: "Remarks", placeholder: "Notes", fullWidth: true },
  ];

  const handleSubmit = () => {
    onSubmit({ label, snapshotDate, frequency, notes, immovableRows, movableRows, otherRows });
  };

  return (
    <div className="space-y-5">
      {/* Prefill toggle (only when creating new snapshot) */}
      {!initial && latestSnap && (
        <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-border">
          <div>
            <p className="text-sm font-medium">Pre-fill from latest snapshot</p>
            <p className="text-xs text-muted-foreground">Copy all rows from your previous snapshot as a starting point</p>
          </div>
          <button
            data-testid="toggle-prefill"
            type="button"
            onClick={() => setPrefillEnabled(v => !v)}
            className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", prefillEnabled ? "bg-primary" : "bg-muted-foreground/30")}
          >
            <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", prefillEnabled ? "translate-x-6" : "translate-x-1")} />
          </button>
        </div>
      )}

      {/* Header Fields */}
      <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground mb-1 block">Snapshot Label</Label>
            <Input data-testid="input-snapshot-label" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Q1 2026, March 2026" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Date *</Label>
            <Input data-testid="input-snapshot-date" type="date" value={snapshotDate} onChange={e => setSnapshotDate(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Frequency</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger data-testid="select-snapshot-frequency"><SelectValue /></SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground mb-1 block">Notes</Label>
            <Textarea data-testid="input-snapshot-notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes..." rows={2} />
          </div>
        </div>
      </div>

      {/* Live Totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/40 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Building2 className="h-3 w-3 text-indigo-500" />
            <p className="text-xs text-muted-foreground">Real Estate</p>
          </div>
          <p className="font-bold text-indigo-600 dark:text-indigo-400 text-sm">₹ {fmt(totalImm)}</p>
        </div>
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Car className="h-3 w-3 text-emerald-500" />
            <p className="text-xs text-muted-foreground">Physical Assets</p>
          </div>
          <p className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">₹ {fmt(totalMov)}</p>
        </div>
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingUp className="h-3 w-3 text-amber-500" />
            <p className="text-xs text-muted-foreground">Investments</p>
          </div>
          <p className="font-bold text-amber-600 dark:text-amber-400 text-sm">₹ {fmt(totalOth)}</p>
        </div>
        <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-950/40 dark:to-purple-950/30 border border-indigo-200 dark:border-indigo-900/50 text-center">
          <div className="flex items-center justify-center gap-1 mb-1">
            <Wallet className="h-3 w-3 text-indigo-600" />
            <p className="text-xs text-muted-foreground">Net Worth</p>
          </div>
          <p className="font-bold text-indigo-700 dark:text-indigo-300 text-sm">₹ {fmt(netWorth)}</p>
        </div>
      </div>

      {/* Row Tables */}
      <RowTable
        title="Real Estate Properties"
        subtitle="Land, home, commercial — any immovable asset"
        rows={immovableRows}
        onAdd={addRow(setImmovableRows)}
        onRemove={removeRow(setImmovableRows)}
        onChange={updateRow(setImmovableRows)}
        columns={immCols}
        emptyRow={emptyImmovableRow}
        icon={Building2}
        theme={{
          headerBg: "from-indigo-50 to-indigo-100/40 dark:from-indigo-950/30 dark:to-indigo-900/10",
          iconBg: "bg-indigo-100 dark:bg-indigo-900/50",
          iconColor: "text-indigo-600 dark:text-indigo-400",
          rowBorder: "border-l-indigo-400",
          rowBg: "bg-indigo-50/40 dark:bg-indigo-950/10",
          addBtn: "border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300",
        }}
      />

      <RowTable
        title="Physical Movable Assets"
        subtitle="Four wheelers, two wheelers, jewellery, furniture & more"
        rows={movableRows}
        onAdd={addRow(setMovableRows)}
        onRemove={removeRow(setMovableRows)}
        onChange={updateRow(setMovableRows)}
        columns={movCols}
        emptyRow={emptyMovableRow}
        icon={Car}
        theme={{
          headerBg: "from-emerald-50 to-emerald-100/40 dark:from-emerald-950/30 dark:to-emerald-900/10",
          iconBg: "bg-emerald-100 dark:bg-emerald-900/50",
          iconColor: "text-emerald-600 dark:text-emerald-400",
          rowBorder: "border-l-emerald-400",
          rowBg: "bg-emerald-50/40 dark:bg-emerald-950/10",
          addBtn: "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300",
        }}
      />

      <RowTable
        title="Investments & Savings"
        subtitle="Stocks, MF, FD, PPF, crypto, insurance & more"
        rows={otherRows}
        onAdd={addRow(setOtherRows)}
        onRemove={removeRow(setOtherRows)}
        onChange={updateRow(setOtherRows)}
        columns={othCols}
        emptyRow={emptyOtherRow}
        icon={TrendingUp}
        theme={{
          headerBg: "from-amber-50 to-amber-100/40 dark:from-amber-950/30 dark:to-amber-900/10",
          iconBg: "bg-amber-100 dark:bg-amber-900/50",
          iconColor: "text-amber-600 dark:text-amber-400",
          rowBorder: "border-l-amber-400",
          rowBg: "bg-amber-50/40 dark:bg-amber-950/10",
          addBtn: "border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300",
        }}
      />

      <div className="flex gap-3 pt-2">
        <Button data-testid="button-cancel-snapshot" variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button data-testid="button-save-snapshot" className="flex-1" disabled={isPending} onClick={handleSubmit}>
          {isPending ? "Saving..." : initial ? "Update Snapshot" : "Save Snapshot"}
        </Button>
      </div>
    </div>
  );
}

export default function Wealth() {
  const { user } = useAuth();
  const { data: profiles } = useProfiles();
  const activeProfileId = user?.activeProfileId ?? undefined;
  const activeProfile = profiles?.find(p => p.id === activeProfileId) || profiles?.[0];
  const profileId = activeProfile?.id;

  const { data: snapshots = [], isLoading: snapsLoading } = useWealthSnapshots(profileId);
  const { data: latestSnap, isLoading: latestLoading } = useLatestWealthSnapshot(profileId);
  const { data: analytics, isLoading: analyticsLoading } = useWealthAnalytics(profileId);

  const { mutate: createSnapshot, isPending: createPending } = useCreateWealthSnapshot(profileId);
  const { mutate: updateSnapshot, isPending: updatePending } = useUpdateWealthSnapshot(profileId);
  const { mutate: deleteSnapshot } = useDeleteWealthSnapshot(profileId);

  const [tab, setTab] = useState("overview");
  const [snapshotDialog, setSnapshotDialog] = useState<{ open: boolean; snapshot?: WealthSnapshotWithRows }>({ open: false });
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id?: number }>({ open: false });
  const [expandedSnap, setExpandedSnap] = useState<number | null>(null);
  const [editingSnapshotId, setEditingSnapshotId] = useState<number | undefined>(undefined);

  // Fetch full snapshot with rows when editing from history tab
  const { data: editingSnapshotFull, isLoading: editingLoading } = useWealthSnapshot(editingSnapshotId);
  useEffect(() => {
    if (editingSnapshotFull && editingSnapshotId) {
      setSnapshotDialog({ open: true, snapshot: editingSnapshotFull });
      setEditingSnapshotId(undefined);
    }
  }, [editingSnapshotFull, editingSnapshotId]);

  const latest = analytics?.latest || latestSnap;

  const summaryCards = useMemo(() => {
    if (!latest) return { netWorth: 0, totalImmovable: 0, totalMovable: 0, totalOtherMovable: 0 };
    return {
      netWorth: Number(latest.netWorth || 0),
      totalImmovable: Number(latest.totalImmovable || 0),
      totalMovable: Number(latest.totalMovable || 0),
      totalOtherMovable: Number(latest.totalOtherMovable || 0),
    };
  }, [latest]);

  const pieData = useMemo(() => {
    if (!latest) return [];
    return [
      { name: "Real Estate", value: Number(latest.totalImmovable || 0) },
      { name: "Physical Assets", value: Number(latest.totalMovable || 0) },
      { name: "Investments", value: Number(latest.totalOtherMovable || 0) },
    ].filter(d => d.value > 0);
  }, [latest]);

  const trend = analytics?.trend || [];

  // Smart Insights from server analytics
  const serverInsights = analytics?.insights;
  const insights = useMemo(() => {
    if (!latest) return null;
    const totalAssets = Number(latest.totalImmovable || 0) + Number(latest.totalMovable || 0) + Number(latest.totalOtherMovable || 0);
    const immPct = totalAssets > 0 ? (Number(latest.totalImmovable) / totalAssets) * 100 : 0;
    const movPct = totalAssets > 0 ? (Number(latest.totalMovable) / totalAssets) * 100 : 0;
    const othPct = totalAssets > 0 ? (Number(latest.totalOtherMovable) / totalAssets) * 100 : 0;
    const domCategory = immPct >= movPct && immPct >= othPct ? "Immovable (Real Estate)"
      : movPct >= othPct ? "Movable (Physical Assets)" : "Other Movable (Investments)";
    const domPct = Math.max(immPct, movPct, othPct);
    return {
      nwGrowth: serverInsights?.netWorthGrowthPct ?? null,
      annualGrowth: serverInsights?.annualGrowthPct ?? null,
      financialAssetGrowth: serverInsights?.financialAssetGrowthPct ?? null,
      largestAsset: serverInsights?.largestAsset ?? null,
      immPct, movPct, othPct, domCategory, domPct,
    };
  }, [latest, serverInsights]);

  const isLoading = snapsLoading || analyticsLoading;

  function handleSaveSnapshot(form: SnapshotFormValues) {
    const payload = {
      label: form.label,
      snapshotDate: form.snapshotDate,
      frequency: form.frequency,
      notes: form.notes || null,
      immovableRows: form.immovableRows.filter(r => r.name),
      movableRows: form.movableRows.filter(r => r.name),
      otherRows: form.otherRows.filter(r => r.name),
    };
    if (snapshotDialog.snapshot) {
      updateSnapshot({ id: snapshotDialog.snapshot.id, ...payload }, { onSuccess: () => setSnapshotDialog({ open: false }) });
    } else {
      createSnapshot(payload, { onSuccess: () => setSnapshotDialog({ open: false }) });
    }
  }

  function handleDelete() {
    if (deleteConfirm.id) deleteSnapshot(deleteConfirm.id);
    setDeleteConfirm({ open: false });
  }

  if (!activeProfile) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const latestRows = latest as WealthSnapshotWithRows | undefined | null;

  return (
    <div className="pb-24 md:pb-8 space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground flex items-center gap-2">
            <Landmark className="h-7 w-7 text-primary" />
            Wealth Snapshot
          </h2>
          <p className="text-muted-foreground mt-1">
            Property & Net Worth Tracker for <span className="font-medium text-foreground">{activeProfile.name}</span>
          </p>
        </div>
        <Button data-testid="button-new-snapshot" className="gap-2" onClick={() => setSnapshotDialog({ open: true })}>
          <PlusCircle className="h-4 w-4" />
          New Snapshot
        </Button>
      </header>

      {/* Net Worth Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-net-worth" className="col-span-2 lg:col-span-1 p-5 rounded-2xl border border-border shadow-sm bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/30 dark:to-purple-950/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 flex items-center justify-center">
              <Wallet className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Net Worth</span>
          </div>
          {isLoading ? <Skeleton className="h-9 w-32" /> : (
            <div className={cn("text-2xl font-display font-bold", summaryCards.netWorth >= 0 ? "text-indigo-700 dark:text-indigo-400" : "text-red-600")}>
              ₹ {fmt(summaryCards.netWorth)}
            </div>
          )}
          {snapshots.length > 0 && <p className="text-xs text-muted-foreground mt-1">Latest snapshot</p>}
        </Card>

        <Card data-testid="card-total-immovable" className="p-5 rounded-2xl border border-border shadow-sm bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center">
              <Building2 className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Total Immovable</span>
          </div>
          {isLoading ? <Skeleton className="h-9 w-28" /> : (
            <div className="text-2xl font-display font-bold text-emerald-700 dark:text-emerald-400">₹ {fmt(summaryCards.totalImmovable)}</div>
          )}
        </Card>

        <Card data-testid="card-total-movable" className="p-5 rounded-2xl border border-border shadow-sm bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-950/30 dark:to-red-950/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 flex items-center justify-center">
              <Car className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Total Movable</span>
          </div>
          {isLoading ? <Skeleton className="h-9 w-28" /> : (
            <div className="text-2xl font-display font-bold text-rose-700 dark:text-rose-400">₹ {fmt(summaryCards.totalMovable)}</div>
          )}
        </Card>

        <Card data-testid="card-total-other-movable" className="p-5 rounded-2xl border border-border shadow-sm bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 flex items-center justify-center">
              <TrendingUp className="h-5 w-5" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">Total Other Movable</span>
          </div>
          {isLoading ? <Skeleton className="h-9 w-28" /> : (
            <div className="text-2xl font-display font-bold text-amber-700 dark:text-amber-400">₹ {fmt(summaryCards.totalOtherMovable)}</div>
          )}
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 flex flex-wrap gap-1 h-auto">
          <TabsTrigger data-testid="tab-overview" value="overview">Overview</TabsTrigger>
          <TabsTrigger data-testid="tab-history" value="history">All Snapshots</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6">
          {snapshots.length === 0 ? (
            <Card className="p-16 text-center border-dashed">
              <Landmark className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-bold font-display mb-2">Start Tracking Your Wealth</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                Create your first wealth snapshot to track your net worth, properties, vehicles, gold, and investments over time.
              </p>
              <Button data-testid="button-first-snapshot" onClick={() => setSnapshotDialog({ open: true })} className="gap-2">
                <PlusCircle className="h-4 w-4" /> Create First Snapshot
              </Button>
            </Card>
          ) : (
            <>
              {/* Charts */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Asset Allocation Pie */}
                <Card className="p-6 rounded-2xl border border-border shadow-sm">
                  <CardHeader className="p-0 mb-4">
                    <CardTitle className="text-base font-display">Asset Allocation</CardTitle>
                    <CardDescription>From latest snapshot</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {pieData.length === 0 ? (
                      <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                        <div className="text-center"><AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-40" /><p>No asset data</p></div>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={280}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="40%"
                            innerRadius={52}
                            outerRadius={78}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(val: number | string) => `₹ ${Number(val).toLocaleString("en-IN")}`} />
                          <Legend
                            verticalAlign="bottom"
                            align="center"
                            height={42}
                            wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* Breakdown bars */}
                <Card className="p-6 rounded-2xl border border-border shadow-sm">
                  <CardHeader className="p-0 mb-4">
                    <CardTitle className="text-base font-display">Asset Breakdown</CardTitle>
                    <CardDescription>Latest snapshot totals</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 space-y-4">
                    {(() => {
                      const totalAll = summaryCards.totalImmovable + summaryCards.totalMovable + summaryCards.totalOtherMovable;
                      return [
                        { label: "Immovable (Real Estate)", value: summaryCards.totalImmovable, total: totalAll, color: "bg-indigo-500", icon: Building2 },
                        { label: "Movable (Physical Assets)", value: summaryCards.totalMovable, total: totalAll, color: "bg-emerald-500", icon: Car },
                        { label: "Other Movable (Investments)", value: summaryCards.totalOtherMovable, total: totalAll, color: "bg-amber-500", icon: TrendingUp },
                      ];
                    })().map(({ label, value, total, color, icon: Icon }) => (
                      <div key={label}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2 text-sm font-medium"><Icon className="h-4 w-4 text-muted-foreground" />{label}</div>
                          <span className="text-sm font-bold">₹ {fmt(value)}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full", color)} style={{ width: total > 0 ? `${(value / total) * 100}%` : "0%" }} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 text-right">{total > 0 ? ((value / total) * 100).toFixed(1) : 0}% of total</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              {/* Net Worth Trend + Movable vs Immovable Bar Chart */}
              {trend.length > 1 && (
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="p-6 rounded-2xl border border-border shadow-sm">
                    <CardHeader className="p-0 mb-4">
                      <CardTitle className="text-base font-display">Net Worth Trend</CardTitle>
                      <CardDescription>Historical wealth snapshots</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={trend}>
                          <defs>
                            <linearGradient id="gwNW" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 11 }} width={60} />
                          <Tooltip formatter={(val: number | string) => `₹ ${Number(val).toLocaleString("en-IN")}`} />
                          <Area type="monotone" dataKey="netWorth" name="Net Worth" stroke="#6366f1" strokeWidth={2} fill="url(#gwNW)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Movable vs Immovable Bar Chart */}
                  <Card className="p-6 rounded-2xl border border-border shadow-sm">
                    <CardHeader className="p-0 mb-4">
                      <CardTitle className="text-base font-display">Asset Category Growth</CardTitle>
                      <CardDescription>Immovable vs Movable vs Investments over time</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={trend} barGap={2}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                          <YAxis tickFormatter={(v) => `₹${(v / 100000).toFixed(0)}L`} tick={{ fontSize: 10 }} width={55} />
                          <Tooltip formatter={(val: number | string) => `₹ ${Number(val).toLocaleString("en-IN")}`} />
                          <Legend />
                          <Bar dataKey="totalImmovable" name="Real Estate" fill="#6366f1" radius={[3,3,0,0]} />
                          <Bar dataKey="totalMovable" name="Physical Assets" fill="#10b981" radius={[3,3,0,0]} />
                          <Bar dataKey="totalOtherMovable" name="Investments" fill="#f59e0b" radius={[3,3,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Smart Insights Panel */}
              {insights && (
                <Card className="p-6 rounded-2xl border border-border shadow-sm">
                  <CardHeader className="p-0 mb-4">
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" /> Smart Insights
                    </CardTitle>
                    <CardDescription>Automated wealth analysis based on your snapshots</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {insights.nwGrowth !== null && (
                        <div className={cn("p-4 rounded-xl border", insights.nwGrowth >= 0 ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40" : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40")}>
                          <p className="text-xs text-muted-foreground mb-1">Net Worth Growth (vs prev)</p>
                          <div className="flex items-center gap-1">
                            {insights.nwGrowth >= 0 ? <ArrowUpRight className="h-4 w-4 text-emerald-600" /> : <ArrowDownRight className="h-4 w-4 text-red-600" />}
                            <span className={cn("font-bold text-lg", insights.nwGrowth >= 0 ? "text-emerald-600" : "text-red-600")}>
                              {insights.nwGrowth >= 0 ? "+" : ""}{insights.nwGrowth.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      )}
                      {insights.annualGrowth !== null && (
                        <div className={cn("p-4 rounded-xl border", insights.annualGrowth >= 0 ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40" : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/40")}>
                          <p className="text-xs text-muted-foreground mb-1">Annualised Growth</p>
                          <div className="flex items-center gap-1">
                            {insights.annualGrowth >= 0 ? <ArrowUpRight className="h-4 w-4 text-emerald-600" /> : <ArrowDownRight className="h-4 w-4 text-red-600" />}
                            <span className={cn("font-bold text-lg", insights.annualGrowth >= 0 ? "text-emerald-600" : "text-red-600")}>
                              {insights.annualGrowth >= 0 ? "+" : ""}{insights.annualGrowth.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      )}
                      {insights.largestAsset && (
                        <div className="p-4 rounded-xl border bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/40">
                          <p className="text-xs text-muted-foreground mb-1">Largest Single Asset</p>
                          <p className="font-bold text-indigo-700 dark:text-indigo-400 truncate">{insights.largestAsset.name}</p>
                          <p className="text-xs text-muted-foreground">₹ {fmt(insights.largestAsset.value)} · {insights.largestAsset.category}</p>
                        </div>
                      )}
                      <div className="p-4 rounded-xl border bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/40">
                        <p className="text-xs text-muted-foreground mb-1">Dominant Asset Category</p>
                        <p className="font-bold text-indigo-700 dark:text-indigo-400 text-sm">{insights.domCategory}</p>
                        <p className="text-xs text-muted-foreground">{insights.domPct.toFixed(1)}% of total assets</p>
                      </div>
                      {insights.domPct > 80 && (
                        <div className="p-4 rounded-xl border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40">
                          <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Concentration Warning</p>
                          <p className="text-xs text-muted-foreground">Over 80% in {insights.domCategory}. Consider diversifying your portfolio.</p>
                        </div>
                      )}
                      <div className="p-4 rounded-xl border bg-muted/40">
                        <p className="text-xs text-muted-foreground mb-1">Immovable Allocation</p>
                        <p className="font-bold">{insights.immPct.toFixed(1)}%</p>
                      </div>
                      <div className="p-4 rounded-xl border bg-muted/40">
                        <p className="text-xs text-muted-foreground mb-1">Financial Assets Allocation</p>
                        <p className="font-bold">{insights.othPct.toFixed(1)}%
                        {insights.financialAssetGrowth !== null && (
                          <span className={cn("ml-2 text-xs font-normal", insights.financialAssetGrowth >= 0 ? "text-emerald-600" : "text-red-600")}>
                            {insights.financialAssetGrowth >= 0 ? "+" : ""}{insights.financialAssetGrowth.toFixed(1)}%
                          </span>
                        )}</p>
                      </div>
                      <div className="p-4 rounded-xl border bg-muted/40">
                        <p className="text-xs text-muted-foreground mb-1">Snapshots Tracked</p>
                        <p className="font-bold">{trend.length} snapshots</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Latest Snapshot Detail */}
              {latestRows && (
                <Card className="p-6 rounded-2xl border border-border shadow-sm">
                  <CardHeader className="p-0 mb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base font-display">Latest Statement</CardTitle>
                        <CardDescription>
                          {latestRows.label || "Snapshot"} — {latestRows.snapshotDate ? format(new Date(latestRows.snapshotDate), "dd MMM yyyy") : ""}
                        </CardDescription>
                      </div>
                      <Button data-testid="button-edit-latest" variant="outline" size="sm" className="gap-1" onClick={() => latestRows?.id && setEditingSnapshotId(latestRows.id)}>
                        <Pencil className="h-3.5 w-3.5" /> {editingLoading && editingSnapshotId === latestRows?.id ? "Loading..." : "Edit"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 space-y-4">
                    {/* Immovable Rows */}
                    {latestRows.immovableRows?.length > 0 && (
                      <div>
                        <h5 className="font-semibold text-sm flex items-center gap-1.5 mb-2"><Building2 className="h-4 w-4 text-indigo-500" />Real Estate Properties</h5>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border-collapse">
                            <thead><tr className="bg-muted/50">
                              <th className="text-left p-2 font-medium">Property</th>
                              <th className="text-left p-2 font-medium">Type</th>
                              <th className="text-left p-2 font-medium">Location</th>
                              <th className="text-right p-2 font-medium">Current Value</th>
                              <th className="text-right p-2 font-medium">Loan</th>
                            </tr></thead>
                            <tbody>
                              {latestRows.immovableRows.map((r, i) => (
                                <tr key={i} className="border-t border-border/50">
                                  <td className="p-2">{r.name}</td>
                                  <td className="p-2">{IMMOVABLE_TYPES.find(t => t.value === r.type)?.label || r.type}</td>
                                  <td className="p-2">{r.location || "—"}</td>
                                  <td className="p-2 text-right font-medium">₹ {fmt(r.currentValue)}</td>
                                  <td className="p-2 text-right text-rose-600">₹ {fmt(r.loanOutstanding)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Movable Rows */}
                    {latestRows.movableRows?.length > 0 && (
                      <div>
                        <h5 className="font-semibold text-sm flex items-center gap-1.5 mb-2"><Car className="h-4 w-4 text-emerald-500" />Physical Movable Assets</h5>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border-collapse">
                            <thead><tr className="bg-muted/50">
                              <th className="text-left p-2 font-medium">Asset</th>
                              <th className="text-left p-2 font-medium">Type</th>
                              <th className="text-right p-2 font-medium">Current Value</th>
                              <th className="text-right p-2 font-medium">Loan</th>
                            </tr></thead>
                            <tbody>
                              {latestRows.movableRows.map((r, i) => (
                                <tr key={i} className="border-t border-border/50">
                                  <td className="p-2">{r.name}</td>
                                  <td className="p-2">{MOVABLE_TYPES.find(t => t.value === r.type)?.label || r.type}</td>
                                  <td className="p-2 text-right font-medium">₹ {fmt(r.currentValue)}</td>
                                  <td className="p-2 text-right text-rose-600">₹ {fmt(r.loanOutstanding)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Other Rows */}
                    {latestRows.otherRows?.length > 0 && (
                      <div>
                        <h5 className="font-semibold text-sm flex items-center gap-1.5 mb-2"><TrendingUp className="h-4 w-4 text-amber-500" />Investments & Savings</h5>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs border-collapse">
                            <thead><tr className="bg-muted/50">
                              <th className="text-left p-2 font-medium">Name</th>
                              <th className="text-left p-2 font-medium">Type</th>
                              <th className="text-right p-2 font-medium">Invested</th>
                              <th className="text-right p-2 font-medium">Current Value</th>
                              <th className="text-right p-2 font-medium">P&L</th>
                            </tr></thead>
                            <tbody>
                              {latestRows.otherRows.map((r, i) => {
                                const pl = Number(r.currentValue) - Number(r.investedAmount);
                                return (
                                  <tr key={i} className="border-t border-border/50">
                                    <td className="p-2">{r.name}</td>
                                    <td className="p-2">{OTHER_ASSET_TYPES.find(t => t.value === r.type)?.label || r.type}</td>
                                    <td className="p-2 text-right">₹ {fmt(r.investedAmount)}</td>
                                    <td className="p-2 text-right font-medium">₹ {fmt(r.currentValue)}</td>
                                    <td className={cn("p-2 text-right font-medium", pl >= 0 ? "text-emerald-600" : "text-red-600")}>
                                      {pl >= 0 ? "+" : ""}₹ {fmt(pl)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* HISTORY TAB */}
        <TabsContent value="history" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold font-display">All Snapshots</h3>
              <p className="text-sm text-muted-foreground">{snapshots.length} snapshot{snapshots.length !== 1 ? "s" : ""} saved</p>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
          ) : snapshots.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <History className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">No snapshots yet. Create one to start tracking your wealth!</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {snapshots.map((snap: WealthSnapshot) => {
                const nw = Number(snap.netWorth ?? 0);
                const imm = Number(snap.totalImmovable ?? 0);
                const mov = Number(snap.totalMovable ?? 0);
                const oth = Number(snap.totalOtherMovable ?? 0);
                const total = imm + mov + oth;
                const immPct = total > 0 ? (imm / total) * 100 : 0;
                const movPct = total > 0 ? (mov / total) * 100 : 0;
                const othPct = total > 0 ? (oth / total) * 100 : 0;
                return (
                  <Card key={snap.id} data-testid={`card-snapshot-${snap.id}`} className="rounded-2xl border border-border shadow-sm overflow-hidden">
                    {/* Top accent bar with 3-colour allocation strip */}
                    <div className="h-1.5 w-full flex">
                      <div className="bg-indigo-500" style={{ width: `${immPct}%` }} />
                      <div className="bg-emerald-500" style={{ width: `${movPct}%` }} />
                      <div className="bg-amber-500" style={{ width: `${othPct}%` }} />
                      {total === 0 && <div className="bg-muted w-full" />}
                    </div>

                    <div
                      className="p-4 flex items-start sm:items-center justify-between gap-3 cursor-pointer hover:bg-muted/20 transition-colors"
                      onClick={() => setExpandedSnap(expandedSnap === snap.id ? null : snap.id)}
                    >
                      {/* Left: icon + info */}
                      <div className="flex items-start sm:items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/30 text-indigo-600 flex items-center justify-center flex-shrink-0">
                          <Landmark className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">
                            {snap.label || format(new Date(snap.snapshotDate), "MMMM yyyy")}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-muted-foreground">{format(new Date(snap.snapshotDate), "dd MMM yyyy")}</span>
                            <Badge variant="secondary" className="text-xs capitalize">{snap.frequency}</Badge>
                          </div>
                          {/* Mini allocation dots */}
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span className="h-2 w-2 rounded-full bg-indigo-400 inline-block" />
                              ₹{(imm/100000).toFixed(1)}L
                            </span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span className="h-2 w-2 rounded-full bg-emerald-400 inline-block" />
                              ₹{(mov/100000).toFixed(1)}L
                            </span>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
                              ₹{(oth/100000).toFixed(1)}L
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: net worth + actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="text-right hidden sm:block">
                          <p className="text-xs text-muted-foreground">Net Worth</p>
                          <p className={cn("font-bold text-base", nw >= 0 ? "text-indigo-600 dark:text-indigo-400" : "text-red-600")}>
                            ₹ {fmt(nw)}
                          </p>
                        </div>
                        <div className="flex gap-0.5 items-center">
                          <Button
                            data-testid={`button-edit-snapshot-${snap.id}`}
                            variant="ghost" size="icon" className="h-8 w-8"
                            onClick={e => { e.stopPropagation(); setEditingSnapshotId(snap.id); }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            data-testid={`button-delete-snapshot-${snap.id}`}
                            variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                            onClick={e => { e.stopPropagation(); setDeleteConfirm({ open: true, id: snap.id }); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          {expandedSnap === snap.id
                            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </div>
                      </div>
                    </div>

                    {/* Mobile net worth (shown below on small screens) */}
                    <div className="px-4 pb-2 sm:hidden flex items-center justify-between border-t border-border/40 pt-2">
                      <span className="text-xs text-muted-foreground">Net Worth</span>
                      <span className={cn("font-bold", nw >= 0 ? "text-indigo-600" : "text-red-600")}>
                        ₹ {fmt(nw)}
                      </span>
                    </div>

                    {expandedSnap === snap.id && <ExpandedSnapshotDetail snapId={snap.id} />}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Snapshot Create/Edit Dialog */}
      <Dialog open={snapshotDialog.open} onOpenChange={open => !open && setSnapshotDialog({ open: false })}>
        <DialogContent className="max-w-2xl w-full mx-2 sm:mx-auto max-h-[95vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border flex-shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/30 flex items-center justify-center">
                <Landmark className="h-4 w-4 text-indigo-600" />
              </div>
              {snapshotDialog.snapshot ? "Edit Wealth Snapshot" : "New Wealth Snapshot"}
            </DialogTitle>
            {!snapshotDialog.snapshot && latestSnap && (
              <p className="text-sm text-muted-foreground">Pre-filled from your latest snapshot. Update values as needed.</p>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <SnapshotForm
              initial={snapshotDialog.snapshot}
              latestSnap={!snapshotDialog.snapshot ? latestSnap : undefined}
              isPending={createPending || updatePending}
              onSubmit={handleSaveSnapshot}
              onCancel={() => setSnapshotDialog({ open: false })}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirm.open} onOpenChange={open => setDeleteConfirm({ open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this snapshot?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the snapshot and all its asset rows. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ExpandedSnapshotDetail({ snapId }: { snapId: number }) {
  const { data: snap, isLoading } = useWealthSnapshot(snapId);

  if (isLoading) return <div className="p-4 pt-0"><Skeleton className="h-28 w-full rounded-xl" /></div>;
  if (!snap) return null;

  const imm = Number(snap.totalImmovable ?? 0);
  const mov = Number(snap.totalMovable ?? 0);
  const oth = Number(snap.totalOtherMovable ?? 0);
  const total = imm + mov + oth;

  const sections = [
    {
      label: "Real Estate", value: imm, icon: Building2,
      bg: "bg-indigo-50 dark:bg-indigo-950/20",
      border: "border-indigo-200 dark:border-indigo-900/40",
      text: "text-indigo-600 dark:text-indigo-400",
      bar: "bg-indigo-500",
    },
    {
      label: "Physical Assets", value: mov, icon: Car,
      bg: "bg-emerald-50 dark:bg-emerald-950/20",
      border: "border-emerald-200 dark:border-emerald-900/40",
      text: "text-emerald-600 dark:text-emerald-400",
      bar: "bg-emerald-500",
    },
    {
      label: "Investments", value: oth, icon: TrendingUp,
      bg: "bg-amber-50 dark:bg-amber-950/20",
      border: "border-amber-200 dark:border-amber-900/40",
      text: "text-amber-600 dark:text-amber-400",
      bar: "bg-amber-500",
    },
  ];

  return (
    <div className="px-4 pb-4 border-t border-border/50 bg-muted/10">
      <div className="grid grid-cols-3 gap-2 pt-3">
        {sections.map(({ label, value, icon: SIcon, bg, border, text, bar }) => (
          <div key={label} className={cn("p-2.5 rounded-xl border text-center", bg, border)}>
            <SIcon className={cn("h-3.5 w-3.5 mx-auto mb-1", text)} />
            <p className="text-xs text-muted-foreground leading-tight">{label}</p>
            <p className={cn("font-bold text-xs mt-0.5", text)}>
              ₹ {value >= 100000 ? `${(value / 100000).toFixed(1)}L` : fmt(value)}
            </p>
            <div className="mt-1.5 h-1 bg-muted/60 rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full", bar)}
                style={{ width: total > 0 ? `${(value / total) * 100}%` : "0%" }}
              />
            </div>
          </div>
        ))}
      </div>
      {snap.notes && (
        <p className="mt-2 text-xs text-muted-foreground italic bg-muted/40 rounded-lg px-3 py-2">
          📝 {snap.notes}
        </p>
      )}
    </div>
  );
}

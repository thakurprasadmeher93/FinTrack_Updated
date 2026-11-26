import { useState, useMemo, useEffect } from "react";
import fintrackLogoUrl from "@assets/FinTrack_Logo_Final_1781085987413.PNG";
import optimiseLifeLogoUrl from "@assets/Optimise_Life_Circular_Logo_1781087559134.png";
import { useProfiles, useCategoryAnalytics, useTrendAnalytics, useDailySpendingPattern, useTransactions, useAnalyticsSummary, useBudget, useOutstandingObligations } from "@/hooks/use-fin-track";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, LineChart, Line, AreaChart, Area } from "recharts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { TrendingUp, Zap, FileText, Calendar, AlertTriangle, Clock, ArrowUpRight, ArrowDownRight, Users, CheckCircle2, XCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DISTINCT_CHART_COLORS = [
  "#2563EB", // blue
  "#F97316", // orange
  "#16A34A", // green
  "#DB2777", // pink
  "#7C3AED", // violet
  "#0891B2", // cyan
  "#DC2626", // red
  "#65A30D", // lime
  "#0F766E", // teal
  "#A21CAF", // fuchsia
  "#D97706", // amber
  "#4F46E5", // indigo
];

const getDistinctChartColor = (index: number) => {
  if (index < DISTINCT_CHART_COLORS.length) return DISTINCT_CHART_COLORS[index];
  // Continue spacing colors around the hue wheel if a chart has more
  // categories than the curated high-contrast palette.
  return `hsl(${(index * 137.508) % 360} 72% 45%)`;
};

const getCategoryColorOverride = (name: unknown) => {
  const normalizedName = String(name || "").toLowerCase();
  if (normalizedName.includes("bill")) return "#DC2626";
  if (normalizedName.includes("house")) return "#2563EB";
  return undefined;
};

const buildCategoryChartData = (items: any[] | undefined) => {
  const usedColors = new Set<string>();

  return (items || []).map((item: any, index: number) => {
    const preferredColor = getCategoryColorOverride(item.name);
    const fill =
      preferredColor && !usedColors.has(preferredColor)
        ? preferredColor
        : DISTINCT_CHART_COLORS.find(color => !usedColors.has(color)) ||
          `hsl(${(index * 137.508) % 360} 72% 45%)`;

    usedColors.add(fill);
    return {
      ...item,
      value: Math.abs(Number(item.value)),
      fill,
    };
  });
};

export default function Analytics() {
  const { toast } = useToast();
  const { user, isLoading: isAuthLoading, refetch: refetchAuth } = useAuth();
  const { data: profiles, isLoading: isProfilesLoading } = useProfiles();
  const activeProfileId = (user as any)?.activeProfileId as number | undefined;
  const activeProfile = profiles?.find((p: any) => p.id === activeProfileId) || profiles?.[0];
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // Separate state for export date range
  const [exportStartDate, setExportStartDate] = useState<string>("");
  const [exportEndDate, setExportEndDate] = useState<string>("");

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

  const [trendType, setTrendType] = useState<'monthly' | 'yearly' | '3y' | '5y' | 'alltime'>('monthly');
  const [dailySpendingPeriod, setDailySpendingPeriod] = useState<'monthly' | 'yearly' | '3y' | '5y' | 'alltime'>('monthly');
  const [obligationsAsOf, setObligationsAsOf] = useState(() => format(new Date(), "yyyy-MM-dd'T'HH:mm"));
  const obligationsAsOfIso = useMemo(() => {
    const parsed = new Date(obligationsAsOf);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
  }, [obligationsAsOf]);
  const currentDateTimeLocal = format(new Date(), "yyyy-MM-dd'T'HH:mm");
  const formattedObligationsAsOf = useMemo(() => {
    if (!obligationsAsOfIso) return "selected time";
    return new Date(obligationsAsOfIso).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }, [obligationsAsOfIso]);
  const { data: categoryData, isLoading: isCatLoading } = useCategoryAnalytics(activeProfile?.id, selectedMonth, selectedYear);
  const { data: trendData, isLoading: isTrendLoading } = useTrendAnalytics(activeProfile?.id, trendType);
  const { data: dailyData, isLoading: isDailyLoading } = useDailySpendingPattern(activeProfile?.id, dailySpendingPeriod);
  const { data: transactions, isLoading: isTxLoading } = useTransactions(activeProfile?.id, { month: selectedMonth, year: selectedYear });
  const { data: allTransactions, isLoading: isAllTxLoading } = useTransactions(activeProfile?.id);
  const { data: summary, isLoading: isSummaryLoading } = useAnalyticsSummary(activeProfile?.id, selectedMonth, selectedYear);
  const { data: budget } = useBudget(activeProfile?.id, selectedMonth, selectedYear);
  const { data: obligationsData, isLoading: isObligationsLoading } = useOutstandingObligations(activeProfile?.id, obligationsAsOfIso);

  useEffect(() => {
    // Sync check if needed, but the hook should handle it.
  }, [user?.activeProfileId]);

  const isProfilesReady = !isAuthLoading && !isProfilesLoading;

  const isPro = (user as any)?.subscriptionStatus === 'paid';
  const savingsRate = summary?.income ? Math.max(0, ((summary.income - summary.expenses) / summary.income) * 100) : 0;
  const budgetDiscipline = budget && summary?.expenses !== undefined ? Math.max(0, 100 - Math.min(100, (Number(summary.expenses) / Number(budget.amount)) * 100)) : 100;

  const handleExport = async () => {
    if (!activeProfile) return;
    if (!exportStartDate || !exportEndDate) {
      toast({
        title: "Please select a date range",
        description: "Select both start and end dates before downloading.",
        variant: "destructive",
      });
      return;
    }
    if (new Date(exportStartDate) > new Date(exportEndDate)) {
      toast({
        title: "Invalid date range",
        description: "Start date must be before end date.",
        variant: "destructive",
      });
      return;
    }
    try {
      let latestWealthSnapshot: any | null = null;
      let includeWealthSnapshot = false;
      const latestSnapshotRes = await fetch(`/api/profiles/${activeProfile.id}/wealth-snapshots/latest`);
      if (!latestSnapshotRes.ok) {
        throw new Error("Failed to check latest wealth snapshot");
      }
      latestWealthSnapshot = await latestSnapshotRes.json();
      if (latestWealthSnapshot) {
        const snapshotDate = latestWealthSnapshot.snapshotDate
          ? new Date(latestWealthSnapshot.snapshotDate).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "the latest available date";
        includeWealthSnapshot = window.confirm(
          `A Wealth Snapshot dated ${snapshotDate} is available. Include the latest Wealth Snapshot in this PDF?`
        );
      }

      const params = new URLSearchParams({
        format: "pdf",
        startDate: exportStartDate,
        endDate: exportEndDate,
      });
      const res = await fetch(`/api/profiles/${activeProfile.id}/export?${params}`);
      if (!res.ok) throw new Error("Failed to fetch export data");
      const payload = await res.json();
      const txData: any[] = payload.transactions || [];
      const obligationsQuery = obligationsAsOfIso
        ? `?asOf=${encodeURIComponent(obligationsAsOfIso)}`
        : "";
      const [obligationsRes, trendRes, dailyRes, wealthAnalyticsRes] = await Promise.all([
        fetch(`/api/profiles/${activeProfile.id}/analytics/outstanding-obligations${obligationsQuery}`),
        fetch(`/api/profiles/${activeProfile.id}/analytics/trend?type=monthly`),
        fetch(`/api/profiles/${activeProfile.id}/analytics/daily-spending?type=monthly`),
        includeWealthSnapshot
          ? fetch(`/api/profiles/${activeProfile.id}/wealth-analytics`)
          : Promise.resolve(null),
      ]);
      if (
        !obligationsRes.ok ||
        !trendRes.ok ||
        !dailyRes.ok ||
        (includeWealthSnapshot && (!wealthAnalyticsRes || !wealthAnalyticsRes.ok))
      ) {
        throw new Error("Failed to fetch analytics data for export");
      }
      const obligationsPayload = await obligationsRes.json();
      const trendData6M: any[] = await trendRes.json();
      const dailyData6M: any[] = await dailyRes.json();
      const wealthAnalyticsPayload: any = includeWealthSnapshot && wealthAnalyticsRes
        ? await wealthAnalyticsRes.json()
        : null;
      const exportObligationSummary = obligationsPayload?.summary || {};
      const totalReceivable = Number(exportObligationSummary.totalReceivable || 0);
      const totalPayable = Number(exportObligationSummary.totalPayable || 0);
      const totalPendingSplits = Number(exportObligationSummary.totalPendingSplits || 0);
      const totalUdhariNet = Number(exportObligationSummary.totalUdhariNet ?? (totalReceivable - totalPayable));
      const totalOutstanding = Number(exportObligationSummary.totalOutstanding ?? (
        totalReceivable + totalPayable + totalPendingSplits
      ));
      const pendingDebtEntries: any[] = obligationsPayload?.pendingDebts || [];
      const pendingSplitEntries: any[] = obligationsPayload?.pendingSplits || [];
      const pendingEntries: any[] = [
        ...pendingDebtEntries.map((entry: any) => ({
          ...entry,
          kind: entry.type === "gave" ? "Receivable" : "Payable",
        })),
        ...pendingSplitEntries.map((entry: any) => ({ ...entry, kind: "Split" })),
      ].sort((a, b) => Number(b.daysPending || 0) - Number(a.daysPending || 0));
      const actionRequiredEntries: any[] = obligationsPayload?.actionRequired || [];

      // Computed totals
      const totalIncome = txData.filter(tx => tx.type === "income").reduce((s, tx) => s + Number(tx.amount || 0), 0);
      const totalExpenses = txData.filter(tx => tx.type === "expense").reduce((s, tx) => s + Math.abs(Number(tx.amount || 0)), 0);
      const totalBalance = totalIncome - totalExpenses;

      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;
      const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const marginL = 14;
      const marginR = 14;
      const usableW = pageW - marginL - marginR;
      const CHART_COLORS: [number, number, number][] = [
        [16, 185, 129], [14, 165, 233], [245, 158, 11],
        [239, 68, 68], [139, 92, 246], [236, 72, 153], [99, 102, 241],
        [251, 146, 60], [20, 184, 166], [168, 85, 247],
      ];

      // Helper: rupee format
      const rs = (v: number) => `Rs. ${Math.abs(v).toLocaleString("en-IN")}`;

      // Helper: section heading
      const sectionHeading = (text: string, y: number) => {
        doc.setFontSize(13);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(17, 24, 39);
        doc.text(text, marginL, y);
      };

      // Helper: ensure space; add page if needed
      const ensureSpace = (y: number, needed: number): number => {
        if (y + needed > pageH - 15) { doc.addPage(); return 15; }
        return y;
      };

      // Helper: draw a donut pie chart centred on page
      const drawPieChart = (
        title: string,
        slices: { label: string; value: number }[],
        startY: number
      ): number => {
        const filtered = slices.filter(s => s.value > 0);
        if (filtered.length === 0) return startY;

        const chartPdfSize = 54;
        const legendRows = Math.ceil(filtered.length / 2);
        const totalNeeded = 8 + chartPdfSize + 4 + legendRows * 10 + 6;
        let y = ensureSpace(startY, totalNeeded);

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 30, 30);
        doc.text(title, marginL, y);
        y += 6;

        const total = filtered.reduce((s, sl) => s + sl.value, 0);
        const CANVAS_SIZE = 200;
        const cx = CANVAS_SIZE / 2;
        const cy = CANVAS_SIZE / 2;
        const outerR = 78;
        const innerR = 46;

        const canvas = document.createElement("canvas");
        canvas.width = CANVAS_SIZE;
        canvas.height = CANVAS_SIZE;
        const ctx = canvas.getContext("2d")!;

        let angle = -Math.PI / 2;
        filtered.forEach((sl, i) => {
          const sweep = (sl.value / total) * 2 * Math.PI;
          const [r, g, b] = CHART_COLORS[i % CHART_COLORS.length];
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx + outerR * Math.cos(angle), cy + outerR * Math.sin(angle));
          ctx.arc(cx, cy, outerR, angle, angle + sweep);
          ctx.arc(cx, cy, innerR, angle + sweep, angle, true);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          angle += sweep;
        });

        const imgData = canvas.toDataURL("image/png");
        const chartX = (pageW - chartPdfSize) / 2;
        doc.addImage(imgData, "PNG", chartX, y, chartPdfSize, chartPdfSize);

        const legendStartY = y + chartPdfSize + 4;
        const legendYBase = legendStartY;
        filtered.forEach((sl, i) => {
          const col = i % 2;
          const row = Math.floor(i / 2);
          const xPos = marginL + col * (usableW / 2);
          const yPos = legendYBase + row * 10;
          const [r, g, b] = CHART_COLORS[i % CHART_COLORS.length];
          doc.setFillColor(r, g, b);
          doc.rect(xPos, yPos, 4, 4, "F");
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(50, 50, 50);
          const pct = ((sl.value / total) * 100).toFixed(1);
          doc.text(`${sl.label} — ${rs(sl.value)} (${pct}%)`, xPos + 6, yPos + 3.5);
        });
        return legendStartY + legendRows * 10 + 6;
      };

      // Helper: draw a grouped bar chart (2 series) matching the analytics page style
      const drawGroupedBarChart = (
        title: string,
        data: { name: string; val1: number; val2: number }[],
        series1Label: string,
        series2Label: string,
        color1: [number, number, number],
        color2: [number, number, number],
        startY: number
      ): number => {
        if (!data || data.length === 0) return startY;

        const CANVAS_W = 560;
        const CANVAS_H = 260;
        const padL = 75;
        const padR = 20;
        const padT = 20;
        const padB = 65;
        const chartW = CANVAS_W - padL - padR;
        const chartH = CANVAS_H - padT - padB;

        const barCanvas = document.createElement("canvas");
        barCanvas.width = CANVAS_W;
        barCanvas.height = CANVAS_H;
        const bCtx = barCanvas.getContext("2d")!;

        bCtx.fillStyle = "#ffffff";
        bCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        const maxVal = Math.max(...data.flatMap(d => [d.val1, d.val2]), 1);
        const n = data.length;
        const groupW = chartW / Math.max(n, 1);
        const barW = Math.min(groupW * 0.35, 30);
        const gap = barW * 0.3;

        // Grid lines & Y-axis labels
        for (let i = 0; i <= 4; i++) {
          const y = padT + chartH * (1 - i / 4);
          bCtx.strokeStyle = "#e5e7eb";
          bCtx.lineWidth = 1;
          bCtx.beginPath();
          bCtx.moveTo(padL, y);
          bCtx.lineTo(padL + chartW, y);
          bCtx.stroke();
          const val = maxVal * (i / 4);
          const lbl = val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val.toFixed(0);
          bCtx.fillStyle = "#6b7280";
          bCtx.font = "13px sans-serif";
          bCtx.textAlign = "right";
          bCtx.fillText(lbl, padL - 6, y + 4);
        }

        // Bars
        data.forEach((item, i) => {
          const groupCenterX = padL + i * groupW + groupW / 2;
          const x1 = groupCenterX - barW - gap / 2;
          const x2 = groupCenterX + gap / 2;

          const h1 = (item.val1 / maxVal) * chartH;
          const h2 = (item.val2 / maxVal) * chartH;

          bCtx.fillStyle = `rgb(${color1.join(",")})`;
          bCtx.fillRect(x1, padT + chartH - h1, barW, h1);
          bCtx.fillStyle = `rgb(${color2.join(",")})`;
          bCtx.fillRect(x2, padT + chartH - h2, barW, h2);

          // X-axis label
          const label = item.name.length > 12 ? item.name.slice(0, 12) + "…" : item.name;
          bCtx.fillStyle = "#374151";
          bCtx.font = "12px sans-serif";
          bCtx.textAlign = "center";
          bCtx.fillText(label, groupCenterX, CANVAS_H - padB + 16);
        });

        // Legend
        const legendY = CANVAS_H - 18;
        [[series1Label, color1], [series2Label, color2]].forEach(([lbl, col], j) => {
          const lx = padL + j * 160;
          const [r, g, b] = col as [number, number, number];
          bCtx.fillStyle = `rgb(${r},${g},${b})`;
          bCtx.fillRect(lx, legendY - 13, 16, 13);
          bCtx.fillStyle = "#374151";
          bCtx.font = "13px sans-serif";
          bCtx.textAlign = "left";
          bCtx.fillText(lbl as string, lx + 20, legendY - 2);
        });

        const chartPdfH = 58;
        const totalNeeded = 8 + chartPdfH + 10;
        let y = ensureSpace(startY, totalNeeded);

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 30, 30);
        doc.text(title, marginL, y);
        y += 6;

        y = ensureSpace(y, chartPdfH + 4);
        doc.addImage(barCanvas.toDataURL("image/png"), "PNG", marginL, y, usableW, chartPdfH);
        return y + chartPdfH + 8;
      };

      const drawValueBarChart = (
        title: string,
        data: { name: string; value: number }[],
        seriesLabel: string,
        color: [number, number, number],
        startY: number
      ): number => {
        if (!data || data.length === 0) return startY;

        const CANVAS_W = 700;
        const CANVAS_H = 280;
        const padL = 70;
        const padR = 22;
        const padT = 22;
        const padB = 58;
        const chartW = CANVAS_W - padL - padR;
        const chartH = CANVAS_H - padT - padB;
        const canvas = document.createElement("canvas");
        canvas.width = CANVAS_W;
        canvas.height = CANVAS_H;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        const maxVal = Math.max(...data.map(item => item.value), 1);
        const groupW = chartW / Math.max(data.length, 1);
        const barW = Math.min(groupW * 0.55, 42);

        for (let i = 0; i <= 4; i++) {
          const gy = padT + chartH * (1 - i / 4);
          ctx.strokeStyle = "#e5e7eb";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(padL, gy);
          ctx.lineTo(padL + chartW, gy);
          ctx.stroke();
          const value = maxVal * (i / 4);
          ctx.fillStyle = "#6b7280";
          ctx.font = "12px sans-serif";
          ctx.textAlign = "right";
          ctx.fillText(value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(0), padL - 7, gy + 4);
        }

        data.forEach((item, index) => {
          const centerX = padL + index * groupW + groupW / 2;
          const barHeight = (item.value / maxVal) * chartH;
          ctx.fillStyle = `rgb(${color.join(",")})`;
          ctx.fillRect(centerX - barW / 2, padT + chartH - barHeight, barW, barHeight);
          ctx.fillStyle = "#374151";
          ctx.font = "12px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(item.name.length > 16 ? `${item.name.slice(0, 16)}…` : item.name, centerX, CANVAS_H - padB + 18);
        });

        ctx.fillStyle = `rgb(${color.join(",")})`;
        ctx.fillRect(padL, CANVAS_H - 19, 14, 10);
        ctx.fillStyle = "#374151";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "left";
        ctx.fillText(seriesLabel, padL + 19, CANVAS_H - 10);

        const chartPdfH = 62;
        let y = ensureSpace(startY, 8 + chartPdfH + 10);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 30, 30);
        doc.text(title, marginL, y);
        y += 6;
        y = ensureSpace(y, chartPdfH + 4);
        doc.addImage(canvas.toDataURL("image/png"), "PNG", marginL, y, usableW, chartPdfH);
        return y + chartPdfH + 8;
      };

      const drawTripleBarChart = (
        title: string,
        data: { name: string; val1: number; val2: number; val3: number }[],
        labels: [string, string, string],
        colors: [[number, number, number], [number, number, number], [number, number, number]],
        startY: number
      ): number => {
        if (!data || data.length === 0) return startY;

        const CANVAS_W = 700;
        const CANVAS_H = 280;
        const padL = 70;
        const padR = 22;
        const padT = 22;
        const padB = 58;
        const chartW = CANVAS_W - padL - padR;
        const chartH = CANVAS_H - padT - padB;
        const canvas = document.createElement("canvas");
        canvas.width = CANVAS_W;
        canvas.height = CANVAS_H;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        const maxVal = Math.max(...data.flatMap(item => [item.val1, item.val2, item.val3]), 1);
        const groupW = chartW / Math.max(data.length, 1);
        const barW = Math.min(groupW * 0.2, 22);
        const gap = Math.max(2, barW * 0.16);

        for (let i = 0; i <= 4; i++) {
          const gy = padT + chartH * (1 - i / 4);
          ctx.strokeStyle = "#e5e7eb";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(padL, gy);
          ctx.lineTo(padL + chartW, gy);
          ctx.stroke();
          const value = maxVal * (i / 4);
          ctx.fillStyle = "#6b7280";
          ctx.font = "12px sans-serif";
          ctx.textAlign = "right";
          ctx.fillText(value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(0), padL - 7, gy + 4);
        }

        data.forEach((item, index) => {
          const centerX = padL + index * groupW + groupW / 2;
          [item.val1, item.val2, item.val3].forEach((value, seriesIndex) => {
            const barHeight = (value / maxVal) * chartH;
            const x = centerX + (seriesIndex - 1) * (barW + gap) - barW / 2;
            ctx.fillStyle = `rgb(${colors[seriesIndex].join(",")})`;
            ctx.fillRect(x, padT + chartH - barHeight, barW, barHeight);
          });
          ctx.fillStyle = "#374151";
          ctx.font = "11px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(item.name.length > 12 ? `${item.name.slice(0, 12)}…` : item.name, centerX, CANVAS_H - padB + 18);
        });

        labels.forEach((label, index) => {
          const x = padL + index * 165;
          ctx.fillStyle = `rgb(${colors[index].join(",")})`;
          ctx.fillRect(x, CANVAS_H - 19, 14, 10);
          ctx.fillStyle = "#374151";
          ctx.font = "12px sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(label, x + 19, CANVAS_H - 10);
        });

        const chartPdfH = 62;
        let y = ensureSpace(startY, 8 + chartPdfH + 10);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 30, 30);
        doc.text(title, marginL, y);
        y += 6;
        y = ensureSpace(y, chartPdfH + 4);
        doc.addImage(canvas.toDataURL("image/png"), "PNG", marginL, y, usableW, chartPdfH);
        return y + chartPdfH + 8;
      };

      // Helper: draw a line chart for trend-style analytics.
      const drawLineChart = (
        title: string,
        data: { name: string; val1: number; val2?: number }[],
        series1Label: string,
        series2Label: string | undefined,
        color1: [number, number, number],
        color2: [number, number, number] | undefined,
        startY: number
      ): number => {
        if (!data || data.length === 0) return startY;

        const CANVAS_W = 700;
        const CANVAS_H = 280;
        const padL = 70;
        const padR = 22;
        const padT = 22;
        const padB = 58;
        const chartW = CANVAS_W - padL - padR;
        const chartH = CANVAS_H - padT - padB;
        const canvas = document.createElement("canvas");
        canvas.width = CANVAS_W;
        canvas.height = CANVAS_H;
        const ctx = canvas.getContext("2d")!;

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        const maxVal = Math.max(...data.flatMap(d => [d.val1, d.val2 || 0]), 1);
        const xFor = (index: number) => padL + (data.length === 1 ? chartW / 2 : (index / (data.length - 1)) * chartW);
        const yFor = (value: number) => padT + chartH - (value / maxVal) * chartH;

        for (let i = 0; i <= 4; i++) {
          const gy = padT + chartH * (1 - i / 4);
          ctx.strokeStyle = "#e5e7eb";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(padL, gy);
          ctx.lineTo(padL + chartW, gy);
          ctx.stroke();
          const value = maxVal * (i / 4);
          ctx.fillStyle = "#6b7280";
          ctx.font = "12px sans-serif";
          ctx.textAlign = "right";
          ctx.fillText(value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(0), padL - 7, gy + 4);
        }

        const drawSeries = (key: "val1" | "val2", color: [number, number, number]) => {
          const points = data.map((item, index) => ({
            x: xFor(index),
            y: yFor(Number(item[key] || 0)),
          }));
          ctx.strokeStyle = `rgb(${color.join(",")})`;
          ctx.fillStyle = `rgb(${color.join(",")})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          points.forEach((point, index) => {
            if (index === 0) ctx.moveTo(point.x, point.y);
            else ctx.lineTo(point.x, point.y);
          });
          ctx.stroke();
          points.forEach(point => {
            ctx.beginPath();
            ctx.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
            ctx.fill();
          });
        };

        drawSeries("val1", color1);
        if (series2Label && color2) drawSeries("val2", color2);

        const labelStep = Math.max(1, Math.ceil(data.length / 10));
        ctx.fillStyle = "#374151";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        data.forEach((item, index) => {
          if (index % labelStep !== 0 && index !== data.length - 1) return;
          const label = item.name.length > 12 ? `${item.name.slice(0, 12)}…` : item.name;
          ctx.fillText(label, xFor(index), CANVAS_H - padB + 18);
        });

        const legend = [
          [series1Label, color1],
          ...(series2Label && color2 ? [[series2Label, color2] as [string, [number, number, number]]] : []),
        ] as [string, [number, number, number]][];
        legend.forEach(([label, color], index) => {
          const lx = padL + index * 170;
          ctx.fillStyle = `rgb(${color.join(",")})`;
          ctx.fillRect(lx, CANVAS_H - 19, 14, 10);
          ctx.fillStyle = "#374151";
          ctx.font = "12px sans-serif";
          ctx.textAlign = "left";
          ctx.fillText(label, lx + 19, CANVAS_H - 10);
        });

        const chartPdfH = 62;
        let y = ensureSpace(startY, 8 + chartPdfH + 10);
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 30, 30);
        doc.text(title, marginL, y);
        y += 6;
        y = ensureSpace(y, chartPdfH + 4);
        doc.addImage(canvas.toDataURL("image/png"), "PNG", marginL, y, usableW, chartPdfH);
        return y + chartPdfH + 8;
      };

      // Load both logos for PDF header
      const loadImg = (src: string): Promise<string> =>
        new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            const c = document.createElement("canvas");
            c.width = img.naturalWidth;
            c.height = img.naturalHeight;
            c.getContext("2d")!.drawImage(img, 0, 0);
            resolve(c.toDataURL("image/png"));
          };
          img.onerror = () => resolve("");
          img.src = src;
        });

      const [logoDataUrl, olLogoDataUrl] = await Promise.all([
        loadImg(fintrackLogoUrl),
        loadImg(optimiseLifeLogoUrl),
      ]);

      // Header layout: FinTrack logo (left) | centered title | Optimise Life logo (right)
      const logoSize = 20; // mm square (both logos same size)
      const logoY = 7;
      const leftLogoX = marginL;                         // 14
      const rightLogoX = pageW - marginR - logoSize;     // 210 - 14 - 20 = 176

      if (logoDataUrl) {
        doc.addImage(logoDataUrl, "PNG", leftLogoX, logoY, logoSize, logoSize);
      }
      if (olLogoDataUrl) {
        doc.addImage(olLogoDataUrl, "PNG", rightLogoX, logoY, logoSize, logoSize);
      }

      // Title + sub-text exactly centered between the two logos
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(17, 24, 39);
      doc.text("FinTrack - Financial Report", pageW / 2, logoY + 9, { align: "center" });

      const fmtDate = (iso: string) => {
        const d = new Date(iso);
        const dd = String(d.getDate()).padStart(2, "0");
        const mm = String(d.getMonth() + 1).padStart(2, "0");
        const yyyy = d.getFullYear();
        return `${dd}-${mm}-${yyyy}`;
      };
      const formatIstTimestamp = (date: Date) => {
        const parts = new Intl.DateTimeFormat("en-IN", {
          timeZone: "Asia/Kolkata",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }).formatToParts(date).reduce<Record<string, string>>((acc, part) => {
          acc[part.type] = part.value;
          return acc;
        }, {});
        return `${parts.day}-${parts.month}-${parts.year}, ${parts.hour}:${parts.minute}:${parts.second} ${parts.dayPeriod.toUpperCase()} IST`;
      };
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Profile: ${activeProfile.name}   |   Period: ${fmtDate(exportStartDate)} to ${fmtDate(exportEndDate)}`,
        pageW / 2, logoY + 16, { align: "center" }
      );

      // Thin divider line
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.line(marginL, logoY + logoSize + 2, pageW - marginR, logoY + logoSize + 2);

      // Section 1: Ledger Transactions
      sectionHeading("Ledger Transactions", 38);

      // Sanitize text for PDF: jsPDF Helvetica only supports printable ASCII.
      // Replace ₹ → Rs., common smart-quotes, dashes, then strip remaining non-ASCII.
      const pdfText = (raw: string | null | undefined): string => {
        if (!raw) return "";
        return raw
          .replace(/₹/g, "Rs.")
          .replace(/[""]/g, '"')
          .replace(/['']/g, "'")
          .replace(/[–—]/g, "-")
          .replace(/…/g, "...")
          .replace(/[^\x20-\x7E]/g, " ")   // strip anything still non-printable-ASCII
          .replace(/\s+/g, " ")
          .trim();
      };
      const alignPdfCell = (data: any, alignments: Array<"left" | "center" | "right">) => {
        if (data.section === "head" || data.section === "body") {
          const alignment = alignments[data.column.index];
          if (alignment) data.cell.styles.halign = alignment;
        }
      };

      const txBody = txData.length
        ? txData.map(tx => [
            new Date(tx.date).toLocaleDateString("en-IN"),
            pdfText(tx.category?.name) || "Uncategorized",
            pdfText(tx.note),
            tx.type.toUpperCase(),
            rs(Number(tx.amount)),
          ])
        : [["—", "No transactions in this range", "", "", ""]];

      autoTable(doc, {
        startY: 42,
        margin: { left: marginL, right: marginR },
        tableWidth: usableW,
        head: [["Date", "Category", "Note", "Type", "Amount"]],
        body: txBody,
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
        styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 22, halign: "center" },                          // Date
          1: { cellWidth: 34, halign: "left" },                            // Category
          2: { cellWidth: "auto", overflow: "linebreak", halign: "left" }, // Note
          3: { cellWidth: 24, overflow: "visible", halign: "center" },     // Type
          4: { cellWidth: 26, halign: "right" },                           // Amount
        },
        didParseCell: (data: any) => {
          alignPdfCell(data, ["center", "left", "left", "center", "right"]);
          if (data.section === "body" && data.column.index === 4) {
            const tx = txData[data.row.index];
            if (tx) data.cell.styles.textColor = tx.type === "income" ? [16, 185, 129] : [239, 68, 68];
          }
        },
      });

      // Ledger summary
      let curY = (doc as any).lastAutoTable.finalY + 8;
      curY = ensureSpace(curY, 30);
      sectionHeading("Ledger Summary", curY);
      curY += 4;
      autoTable(doc, {
        startY: curY,
        margin: { left: marginL, right: marginR },
        tableWidth: usableW,
        head: [["", "Amount"]],
        body: [
          ["Total Income", rs(totalIncome)],
          ["Total Expenses", rs(totalExpenses)],
          ["Total Balance", rs(totalBalance)],
        ],
        theme: "grid",
        headStyles: { fillColor: [226, 232, 240], textColor: [30, 30, 30], fontStyle: "bold", fontSize: 8.5 },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          0: { halign: "left" },
          1: { halign: "right" },
        },
        didParseCell: (data: any) => {
          alignPdfCell(data, ["left", "right"]);
          if (data.section === "body" && data.column.index === 1) {
            if (data.row.index === 0) data.cell.styles.textColor = [16, 185, 129];
            else if (data.row.index === 1) data.cell.styles.textColor = [239, 68, 68];
            else data.cell.styles.textColor = totalBalance >= 0 ? [16, 185, 129] : [239, 68, 68];
          }
        },
      });

      // Ledger charts
      curY = (doc as any).lastAutoTable.finalY + 8;
      const expenses = txData.filter(t => t.type === "expense");
      const incomes = txData.filter(t => t.type === "income");
      const groupByCategory = (arr: any[]) =>
        Object.entries(
          arr.reduce((acc: Record<string, number>, t) => {
            const k = t.category?.name || "Uncategorized";
            acc[k] = (acc[k] || 0) + Math.abs(Number(t.amount));
            return acc;
          }, {})
        ).map(([label, value]) => ({ label, value }));

      curY = drawPieChart("Spending by Category", groupByCategory(expenses), curY);
      curY = drawPieChart("Income by Category", groupByCategory(incomes), curY);

      // Day-wise Spending bar chart
      (() => {
        const DAY_NAMES_PDF = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const buckets = Array(7).fill(0);
        txData.filter((t: any) => t.type === 'expense').forEach((t: any) => {
          const dow = new Date(t.date).getDay();
          buckets[dow] += Math.abs(Number(t.amount));
        });
        const dayData = DAY_NAMES_PDF.map((name, i) => ({ name, value: Math.round(buckets[i]) }));
        if (!dayData.some(d => d.value > 0)) return;

        const DAY_COLORS: [number, number, number][] = [
          [16, 185, 129], [14, 165, 233], [245, 158, 11],
          [239, 68, 68], [139, 92, 246], [236, 72, 153], [99, 102, 241],
        ];

        const CANVAS_W = 560, CANVAS_H = 220;
        const padL = 70, padR = 20, padT = 16, padB = 50;
        const chartW = CANVAS_W - padL - padR;
        const chartH = CANVAS_H - padT - padB;

        const dayCanvas = document.createElement("canvas");
        dayCanvas.width = CANVAS_W;
        dayCanvas.height = CANVAS_H;
        const ctx = dayCanvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

        const maxVal = Math.max(...dayData.map(d => d.value), 1);
        const barW = Math.min(chartW / 7 * 0.55, 48);
        const groupW = chartW / 7;

        // Grid lines + Y labels
        for (let i = 0; i <= 4; i++) {
          const gy = padT + chartH * (1 - i / 4);
          ctx.strokeStyle = "#e5e7eb"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(padL + chartW, gy); ctx.stroke();
          const val = maxVal * (i / 4);
          const lbl = val >= 1000 ? `₹${(val / 1000).toFixed(1)}k` : `₹${val.toFixed(0)}`;
          ctx.fillStyle = "#6b7280"; ctx.font = "12px sans-serif"; ctx.textAlign = "right";
          ctx.fillText(lbl, padL - 6, gy + 4);
        }

        // Bars + X labels
        dayData.forEach((d, i) => {
          const cx = padL + i * groupW + groupW / 2;
          const bx = cx - barW / 2;
          const bh = (d.value / maxVal) * chartH;
          const [r, g, b] = DAY_COLORS[i];
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(bx, padT + chartH - bh, barW, bh);
          ctx.fillStyle = "#374151"; ctx.font = "bold 13px sans-serif"; ctx.textAlign = "center";
          ctx.fillText(d.name, cx, CANVAS_H - padB + 18);
          if (d.value > 0) {
            const amt = d.value >= 1000 ? `₹${(d.value / 1000).toFixed(1)}k` : `₹${d.value}`;
            ctx.fillStyle = "#374151"; ctx.font = "11px sans-serif";
            ctx.fillText(amt, cx, padT + chartH - bh - 4);
          }
        });

        const chartPdfH = 52;
        curY = ensureSpace(curY + 6, 20 + chartPdfH);
        doc.setDrawColor(200, 200, 200);
        doc.line(marginL, curY, pageW - marginR, curY);
        curY += 6;
        sectionHeading("Day-wise Spending Pattern", curY);
        curY += 6;
        curY = ensureSpace(curY, chartPdfH + 4);
        doc.addImage(dayCanvas.toDataURL("image/png"), "PNG", marginL, curY, usableW, chartPdfH);
        curY += chartPdfH + 8;
      })();

      // Section 2: all-time outstanding obligations.
      curY = ensureSpace(curY + 6, 20);
      doc.setDrawColor(200, 200, 200);
      doc.line(marginL, curY, pageW - marginR, curY);
      curY += 6;
      sectionHeading("Outstanding Obligations", curY);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text("(All time · not filtered by month)", marginL, curY + 5);
      doc.setFontSize(8);
      doc.setTextColor(75, 85, 99);
      doc.text(`As of: ${formatIstTimestamp(obligationsAsOfIso ? new Date(obligationsAsOfIso) : new Date())}`, marginL, curY + 10);
      curY += 16;

      autoTable(doc, {
        startY: curY,
        margin: { left: marginL, right: marginR },
        tableWidth: usableW,
        head: [["Obligation", "Amount"]],
        body: [
          ["Total Receivable", rs(totalReceivable)],
          ["Total Payable", rs(totalPayable)],
          ["Pending Split Bills", rs(totalPendingSplits)],
          ["Udhari (Net)", `${totalUdhariNet < 0 ? "- " : ""}${rs(totalUdhariNet)}`],
          ["Total Outstanding", rs(totalOutstanding)],
          ["Action Required", `${actionRequiredEntries.length} obligation${actionRequiredEntries.length === 1 ? "" : "s"}`],
        ],
        theme: "grid",
        headStyles: { fillColor: [226, 232, 240], textColor: [30, 30, 30], fontStyle: "bold", fontSize: 8.5 },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          0: { halign: "left" },
          1: { halign: "right" },
        },
        didParseCell: (data: any) => {
          alignPdfCell(data, ["left", "right"]);
          if (data.section !== "body" || data.column.index !== 1) return;
          const row = data.row.index;
          if (row === 0) data.cell.styles.textColor = [16, 185, 129];
          if (row === 1) data.cell.styles.textColor = [239, 68, 68];
          if (row === 2) data.cell.styles.textColor = [14, 165, 233];
          if (row === 3) data.cell.styles.textColor = totalUdhariNet >= 0 ? [245, 158, 11] : [239, 68, 68];
          if (row === 4) data.cell.styles.textColor = [139, 92, 246];
          if (row === 5 && actionRequiredEntries.length > 0) data.cell.styles.textColor = [217, 119, 6];
        },
      });
      curY = (doc as any).lastAutoTable.finalY + 8;

      // Action-required obligations.
      curY = ensureSpace(curY, 28);
      sectionHeading(`Action Required — ${actionRequiredEntries.length} obligation${actionRequiredEntries.length === 1 ? "" : "s"}`, curY);
      curY += 5;
      autoTable(doc, {
        startY: curY,
        margin: { left: marginL, right: marginR },
        tableWidth: usableW,
        head: [["Contact / Description", "Type", "Amount", "Age"]],
        body: actionRequiredEntries.length > 0
          ? actionRequiredEntries.map((entry: any) => [
              pdfText(entry.source === "split" ? `${entry.contactName || "Unknown"} (${entry.description || "Split"})` : entry.contactName || "Unknown"),
              entry.source === "split" ? "Split" : entry.type === "gave" ? "Receivable" : "Payable",
              rs(Number(entry.amount || 0)),
              `${Number(entry.daysPending || 0)}d`,
            ])
          : [["None", "—", "Rs. 0", "—"]],
        headStyles: { fillColor: [245, 158, 11], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 2 },
        alternateRowStyles: { fillColor: [255, 251, 235] },
        columnStyles: {
          0: { halign: "left" },
          1: { halign: "center" },
          2: { halign: "right" },
          3: { halign: "right", cellWidth: 18 },
        },
        didParseCell: (data: any) => {
          alignPdfCell(data, ["left", "center", "right", "right"]);
        },
      });
      curY = (doc as any).lastAutoTable.finalY + 8;

      // Every currently pending obligation, including debt and split participants.
      curY = ensureSpace(curY, 28);
      sectionHeading(`Pending Entries (${pendingEntries.length})`, curY);
      curY += 5;
      autoTable(doc, {
        startY: curY,
        margin: { left: marginL, right: marginR },
        tableWidth: usableW,
        head: [["Date", "Contact / Description", "Type", "Amount", "Age"]],
        body: pendingEntries.length > 0
          ? pendingEntries.map((entry: any) => [
              entry.originalDate ? new Date(entry.originalDate).toLocaleDateString("en-IN") : "—",
              pdfText(entry.source === "split" ? `${entry.contactName || "Unknown"} (${entry.description || "Split"})` : entry.contactName || "Unknown"),
              entry.kind || "Obligation",
              rs(Number(entry.amount || 0)),
              `${Number(entry.daysPending || 0)}d`,
            ])
          : [["—", "No outstanding obligations", "—", "Rs. 0", "—"]],
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 2 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 23, halign: "center" },
          1: { halign: "left" },
          2: { halign: "center" },
          3: { halign: "right" },
          4: { halign: "right", cellWidth: 18 },
        },
        didParseCell: (data: any) => {
          alignPdfCell(data, ["center", "left", "center", "right", "right"]);
        },
      });
      curY = (doc as any).lastAutoTable.finalY + 8;

      const agingEntries = (obligationsPayload?.aging || []).map((bucket: any) => ({
        name: bucket.label,
        val1: Number(bucket.debts || 0),
        val2: Number(bucket.splits || 0),
      }));
      curY = drawGroupedBarChart(
        "Aging Buckets",
        agingEntries,
        "Udhari Khata",
        "Split Bills",
        [16, 185, 129],
        [14, 165, 233],
        curY
      );

      // The export always includes the six-month versions of both analytics charts.
      curY = drawLineChart(
        "Spending Trend (6M)",
        trendData6M.map((entry: any) => ({
          name: pdfText(String(entry.month || entry.name || "")),
          val1: Number(entry.income || 0),
          val2: Number(entry.expenses || 0),
        })),
        "Income",
        "Expense",
        [37, 99, 235],
        [239, 68, 68],
        curY
      );
      curY = drawLineChart(
        "Daily Spending Pattern (6M)",
        dailyData6M.map((entry: any) => ({
          name: pdfText(String(entry.date || "")),
          val1: Number(entry.amount || 0),
        })),
        "Spent",
        undefined,
        [239, 68, 68],
        undefined,
        curY
      );

      if (includeWealthSnapshot && latestWealthSnapshot) {
        doc.addPage();
        let snapshotY = 16;
        const snapshotDateLabel = latestWealthSnapshot.snapshotDate
          ? new Date(latestWealthSnapshot.snapshotDate).toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : "—";
        const snapshotLabel = pdfText(latestWealthSnapshot.label) || "Wealth Snapshot";
        const snapshotImmovable = Number(latestWealthSnapshot.totalImmovable || 0);
        const snapshotMovable = Number(latestWealthSnapshot.totalMovable || 0);
        const snapshotOtherMovable = Number(latestWealthSnapshot.totalOtherMovable || 0);
        const snapshotNetWorth = Number(latestWealthSnapshot.netWorth || 0);
        const snapshotLiabilities = Number(latestWealthSnapshot.totalLiabilities || 0);

        sectionHeading("Wealth Snapshot", snapshotY);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text(`${snapshotLabel} · Snapshot Date: ${snapshotDateLabel}`, marginL, snapshotY + 6);
        if (latestWealthSnapshot.notes) {
          doc.text(`Notes: ${pdfText(latestWealthSnapshot.notes)}`, marginL, snapshotY + 11);
          snapshotY += 5;
        }
        snapshotY += 16;

        autoTable(doc, {
          startY: snapshotY,
          margin: { left: marginL, right: marginR },
          tableWidth: usableW,
          head: [["Wealth Summary", "Amount"]],
          body: [
            ["Net Worth", rs(snapshotNetWorth)],
            ["Total Immovable", rs(snapshotImmovable)],
            ["Total Movable", rs(snapshotMovable)],
            ["Total Other Movable", rs(snapshotOtherMovable)],
            ["Total Liabilities", rs(snapshotLiabilities)],
          ],
          theme: "grid",
          headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
          styles: { fontSize: 9, cellPadding: 3 },
          columnStyles: { 0: { halign: "left" }, 1: { halign: "right" } },
          didParseCell: (data: any) => alignPdfCell(data, ["left", "right"]),
        });
        snapshotY = (doc as any).lastAutoTable.finalY + 8;

        snapshotY = drawPieChart(
          "Asset Allocation",
          [
            { label: "Immovable", value: snapshotImmovable },
            { label: "Movable", value: snapshotMovable },
            { label: "Other Movable", value: snapshotOtherMovable },
          ],
          snapshotY
        );
        snapshotY = drawValueBarChart(
          "Asset Breakdown",
          [
            { name: "Immovable", value: snapshotImmovable },
            { name: "Movable", value: snapshotMovable },
            { name: "Other Movable", value: snapshotOtherMovable },
          ],
          "Current Value",
          [99, 102, 241],
          snapshotY
        );

        const wealthTrend: any[] = wealthAnalyticsPayload?.trend || [];
        if (wealthTrend.length > 1) {
          snapshotY = drawLineChart(
            "Net Worth Trend",
            wealthTrend.map((entry: any) => ({
              name: pdfText(String(entry.label || entry.snapshotDate || "")),
              val1: Number(entry.netWorth || 0),
            })),
            "Net Worth",
            undefined,
            [99, 102, 241],
            undefined,
            snapshotY
          );
          snapshotY = drawTripleBarChart(
            "Asset Category Growth",
            wealthTrend.map((entry: any) => ({
              name: pdfText(String(entry.label || entry.snapshotDate || "")),
              val1: Number(entry.totalImmovable || 0),
              val2: Number(entry.totalMovable || 0),
              val3: Number(entry.totalOtherMovable || 0),
            })),
            ["Immovable", "Movable", "Other Movable"],
            [[99, 102, 241], [16, 185, 129], [245, 158, 11]],
            snapshotY
          );
        }

        const wealthInsights = wealthAnalyticsPayload?.insights || {};
        const totalAssets = snapshotImmovable + snapshotMovable + snapshotOtherMovable;
        const immovablePct = totalAssets > 0 ? (snapshotImmovable / totalAssets) * 100 : 0;
        const movablePct = totalAssets > 0 ? (snapshotMovable / totalAssets) * 100 : 0;
        const otherMovablePct = totalAssets > 0 ? (snapshotOtherMovable / totalAssets) * 100 : 0;
        const dominantCategory = immovablePct >= movablePct && immovablePct >= otherMovablePct
          ? "Immovable (Real Estate)"
          : movablePct >= otherMovablePct
            ? "Movable (Physical Assets)"
            : "Other Movable (Investments)";
        const insightRows: string[][] = [
          wealthInsights.netWorthGrowthPct !== null && wealthInsights.netWorthGrowthPct !== undefined
            ? ["Net Worth Growth (vs previous)", `${Number(wealthInsights.netWorthGrowthPct) >= 0 ? "+" : ""}${Number(wealthInsights.netWorthGrowthPct).toFixed(1)}%`]
            : [],
          wealthInsights.annualGrowthPct !== null && wealthInsights.annualGrowthPct !== undefined
            ? ["Annualised Growth", `${Number(wealthInsights.annualGrowthPct) >= 0 ? "+" : ""}${Number(wealthInsights.annualGrowthPct).toFixed(1)}%`]
            : [],
          wealthInsights.largestAsset
            ? ["Largest Single Asset", `${pdfText(wealthInsights.largestAsset.name)} · ${rs(Number(wealthInsights.largestAsset.value || 0))}`]
            : [],
          ["Dominant Asset Category", `${dominantCategory} (${Math.max(immovablePct, movablePct, otherMovablePct).toFixed(1)}%)`],
          ["Immovable Allocation", `${immovablePct.toFixed(1)}%`],
          ["Financial Assets Allocation", `${otherMovablePct.toFixed(1)}%`],
        ].filter(row => row.length > 0);

        snapshotY = ensureSpace(snapshotY, 30);
        sectionHeading("Smart Insights", snapshotY);
        snapshotY += 5;
        autoTable(doc, {
          startY: snapshotY,
          margin: { left: marginL, right: marginR },
          tableWidth: usableW,
          head: [["Insight", "Value"]],
          body: insightRows,
          theme: "grid",
          headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
          styles: { fontSize: 8.5, cellPadding: 3 },
          columnStyles: { 0: { halign: "left" }, 1: { halign: "left" } },
          didParseCell: (data: any) => alignPdfCell(data, ["left", "left"]),
        });
        snapshotY = (doc as any).lastAutoTable.finalY + 8;

        const snapshotFieldValue = (value: any, key: string) => {
          if (value === null || value === undefined || value === "") return "—";
          if (key.toLowerCase().includes("date")) {
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? pdfText(String(value)) : date.toLocaleDateString("en-IN");
          }
          if ([
            "purchaseValue", "currentValue", "loanOutstanding", "monthlyRentalIncome", "investedAmount",
          ].includes(key)) {
            return rs(Number(value || 0));
          }
          return pdfText(String(value));
        };
        const compactField = (label: string, row: any, key: string) =>
          `${label}: ${snapshotFieldValue(row[key], key)}`;
        const addCompactStatementTable = (
          heading: string,
          rows: any[],
          columns: Array<{ label: string; width: number; render: (row: any) => string }>
        ) => {
          if (!rows.length) return;
          snapshotY = ensureSpace(snapshotY, 28);
          doc.setFontSize(10.5);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(30, 30, 30);
          const categoryHeadingLines = doc.splitTextToSize(heading, usableW);
          doc.text(categoryHeadingLines, marginL, snapshotY);
          snapshotY += categoryHeadingLines.length * 4.5 + 2;
          autoTable(doc, {
            startY: snapshotY,
            margin: { left: marginL, right: marginR },
            tableWidth: usableW,
            head: [columns.map(column => column.label)],
            body: rows.map(row => columns.map(column => column.render(row))),
            theme: "grid",
            headStyles: { fillColor: [226, 232, 240], textColor: [30, 30, 30], fontStyle: "bold", fontSize: 6.5 },
            styles: { fontSize: 6.2, cellPadding: 1.8, overflow: "linebreak", valign: "top", lineColor: [203, 213, 225], lineWidth: 0.2 },
            columnStyles: columns.reduce<Record<number, any>>((styles, column, index) => {
              styles[index] = { cellWidth: column.width, halign: "left", valign: "top" };
              return styles;
            }, {}),
            didParseCell: (data: any) => {
              alignPdfCell(data, columns.map(() => "left"));
            },
          });
          snapshotY = (doc as any).lastAutoTable.finalY + 7;
        };

        // Keep the statement title, description, and first category heading together.
        // Reserving this space prevents autoTable from starting Immovable Assets
        // on the next page while leaving Latest Statement behind.
        snapshotY = ensureSpace(snapshotY, 75);
        doc.setFontSize(15);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(17, 24, 39);
        doc.text("Latest Statement", marginL, snapshotY);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        doc.text("Complete details from the latest generated Wealth Snapshot · grouped for compact display", marginL, snapshotY + 5);
        snapshotY += 12;
        addCompactStatementTable("Immovable Assets", latestWealthSnapshot.immovableRows || [], [
          { label: "Asset", width: 28, render: row => compactField("Name", row, "name") },
          {
            label: "Property Details",
            width: 38,
            render: row => [
              compactField("Type", row, "type"),
              compactField("Location", row, "location"),
              compactField("Area", row, "area"),
              compactField("Nature", row, "natureOfLand"),
            ].join("\n"),
          },
          {
            label: "Ownership & Acquisition",
            width: 42,
            render: row => [
              compactField("Interest", row, "extentOfInterest"),
              compactField("Method", row, "mannerOfAcquisition"),
              compactField("In whose name", row, "inWhoseName"),
              compactField("Date", row, "acquisitionDate"),
            ].join("\n"),
          },
          {
            label: "Financials",
            width: 43,
            render: row => [
              compactField("Purchase", row, "purchaseValue"),
              compactField("Current", row, "currentValue"),
              compactField("Loan", row, "loanOutstanding"),
              compactField("Monthly rent", row, "monthlyRentalIncome"),
            ].join("\n"),
          },
          { label: "Remarks", width: 31, render: row => compactField("Notes", row, "remarks") },
        ]);
        addCompactStatementTable("Physical Movable Assets", latestWealthSnapshot.movableRows || [], [
          { label: "Asset", width: 28, render: row => compactField("Name", row, "name") },
          {
            label: "Asset Details",
            width: 38,
            render: row => [
              compactField("Type", row, "type"),
              compactField("Description", row, "description"),
            ].join("\n"),
          },
          {
            label: "Ownership & Acquisition",
            width: 42,
            render: row => [
              compactField("Interest", row, "extentOfInterest"),
              compactField("Method", row, "mannerOfAcquisition"),
              compactField("In whose name", row, "inWhoseName"),
              compactField("Date", row, "acquisitionDate"),
            ].join("\n"),
          },
          {
            label: "Financials",
            width: 43,
            render: row => [
              compactField("Purchase", row, "purchaseValue"),
              compactField("Current", row, "currentValue"),
              compactField("Loan", row, "loanOutstanding"),
            ].join("\n"),
          },
          { label: "Remarks", width: 31, render: row => compactField("Notes", row, "remarks") },
        ]);
        addCompactStatementTable("Other Movable / Financial Assets", latestWealthSnapshot.otherRows || [], [
          { label: "Asset", width: 34, render: row => compactField("Name", row, "name") },
          {
            label: "Investment Details",
            width: 50,
            render: row => [
              compactField("Type", row, "type"),
              compactField("In whose name", row, "inWhoseName"),
              compactField("Date", row, "acquisitionDate"),
              compactField("Method", row, "mannerOfAcquisition"),
            ].join("\n"),
          },
          {
            label: "Financials",
            width: 50,
            render: row => [
              compactField("Invested", row, "investedAmount"),
              compactField("Current", row, "currentValue"),
            ].join("\n"),
          },
          { label: "Remarks", width: 48, render: row => compactField("Notes", row, "remarks") },
        ]);
      }

      doc.save(`FinTrack-Report-${activeProfile.name}-${exportStartDate}-to-${exportEndDate}.pdf`);

    } catch (error) {
      console.error("PDF Export Error:", error);
      toast({
        title: "PDF export failed",
        description: "There was an error generating your PDF. Please try again.",
        variant: "destructive",
      });
    }
  };


  // Format expense and income chart data
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayWiseData = useMemo(() => {
    const buckets = Array(7).fill(0);
    (transactions || []).filter((t: any) => t.type === 'expense').forEach((t: any) => {
      const dow = new Date(t.date).getDay();
      buckets[dow] += Math.abs(Number(t.amount));
    });
    return DAY_NAMES.map((name, i) => ({ day: name, amount: Math.round(buckets[i]) }));
  }, [transactions]);

  const expenseChartData = buildCategoryChartData((categoryData as any)?.expenses);
  const incomeChartData = buildCategoryChartData((categoryData as any)?.income);

  const rawObligationSummary = obligationsData?.summary || {};
  const obligationSummary = {
    totalReceivable: Number(rawObligationSummary.totalReceivable || 0),
    totalPayable: Number(rawObligationSummary.totalPayable || 0),
    totalPendingSplits: Number(rawObligationSummary.totalPendingSplits || 0),
    // Fall back gracefully for responses cached before the derived fields
    // were added to the API.
    totalUdhariNet: Number(rawObligationSummary.totalUdhariNet ?? (
      Number(rawObligationSummary.totalReceivable || 0) - Number(rawObligationSummary.totalPayable || 0)
    )),
    totalOutstanding: Number(rawObligationSummary.totalOutstanding ?? (
      Number(rawObligationSummary.totalReceivable || 0) +
      Number(rawObligationSummary.totalPayable || 0) +
      Number(rawObligationSummary.totalPendingSplits || 0)
    )),
  };
  const pendingDebts: any[] = obligationsData?.pendingDebts || [];
  const pendingSplits: any[] = obligationsData?.pendingSplits || [];
  const agingData: any[] = obligationsData?.aging || [];
  const actionRequired: any[] = obligationsData?.actionRequired || [];

  const allPendingItems = useMemo(() => {
    return [
      ...pendingDebts.map((d: any) => ({ ...d, kind: d.type === 'gave' ? 'Receivable' : 'Payable' })),
      ...pendingSplits.map((s: any) => ({ ...s, kind: 'Split' })),
    ].sort((a, b) => b.daysPending - a.daysPending);
  }, [pendingDebts, pendingSplits]);

  return (
    <div className="pb-24 md:pb-8 space-y-6 md:space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground">Analytics</h2>
          <p className="text-muted-foreground mt-1">Visualize your habits for {monthOptions.find(m => m.value === selectedMonth)?.label} {selectedYear}.</p>
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
        </div>
      </header>

      {/* Health Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <Card className="p-5 md:p-6 rounded-2xl border-border shadow-sm bg-gradient-to-br from-blue-50/50 to-white dark:from-blue-900/10 dark:to-background">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h3 className="font-bold font-display flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Savings Rate
            </h3>
            <span className="text-2xl font-bold text-blue-600">{savingsRate.toFixed(1)}%</span>
          </div>
          <Progress value={savingsRate} className="h-2 rounded-full" />
          <p className="text-xs text-muted-foreground mt-3">Target: 20%+ for healthy growth</p>
        </Card>

        <Card className="p-5 md:p-6 rounded-2xl border-border shadow-sm bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-900/10 dark:to-background">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h3 className="font-bold font-display flex items-center gap-2">
              <Zap className="h-5 w-5 text-emerald-500" />
              Budget Discipline
            </h3>
            <span className="text-2xl font-bold text-emerald-600">{budgetDiscipline.toFixed(1)}%</span>
          </div>
          <Progress value={budgetDiscipline} className="h-2 rounded-full [&>div]:bg-emerald-500" />
          <p className="text-xs text-muted-foreground mt-3">Reflects how well you stick to your limits</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        {/* Spending Breakdown */}
        <Card className="p-4 md:p-6 rounded-2xl border border-border shadow-sm">
          <h3 className="text-lg font-bold font-display mb-6">Spending by Category</h3>
          <div className="h-[380px] w-full">
            {isCatLoading ? (
              <div className="h-full w-full flex items-center justify-center">
                <Skeleton className="h-[300px] w-[300px] rounded-full" />
              </div>
            ) : expenseChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
                  <Pie
                    data={expenseChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={75}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {expenseChartData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => `₹ ${value.toLocaleString('en-IN')}`}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={48} wrapperStyle={{ fontSize: '11px', overflowWrap: 'break-word', whiteSpace: 'normal', lineHeight: '1.4' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No expense data available for this month
              </div>
            )}
          </div>
        </Card>

        {/* Income Breakdown */}
        <Card className="p-4 md:p-6 rounded-2xl border border-border shadow-sm">
          <h3 className="text-lg font-bold font-display mb-6">Income by Category</h3>
          <div className="h-[380px] w-full">
            {isCatLoading ? (
              <div className="h-full w-full flex items-center justify-center">
                <Skeleton className="h-[300px] w-[300px] rounded-full" />
              </div>
            ) : incomeChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart margin={{ top: 10, right: 20, bottom: 20, left: 20 }}>
                  <Pie
                    data={incomeChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={75}
                    outerRadius={120}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {incomeChartData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => `₹ ${value.toLocaleString('en-IN')}`}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={48} wrapperStyle={{ fontSize: '11px', overflowWrap: 'break-word', whiteSpace: 'normal', lineHeight: '1.4' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No income data available for this month
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Day-wise Spending Pattern */}
      <Card className="p-4 md:p-6 rounded-2xl border border-border shadow-sm">
        <h3 className="text-lg font-bold font-display mb-6">Day-wise Spending (This Month)</h3>
        <div className="h-[300px] w-full">
          {isTxLoading ? (
            <Skeleton className="h-full w-full" />
          ) : dayWiseData.some(d => d.amount > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayWiseData} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 13, fontWeight: 600 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}`} />
                <Tooltip
                  formatter={(value: number) => [`₹ ${value.toLocaleString('en-IN')}`, 'Spent']}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="amount" name="Spent" radius={[6, 6, 0, 0]} maxBarSize={52}>
                  {dayWiseData.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={getDistinctChartColor(index)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              No expense data for this month
            </div>
          )}
        </div>
      </Card>

      {/* ── Outstanding Obligations ── */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex items-center gap-2 min-w-0">
            <Clock className="h-5 w-5 text-amber-500 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-lg font-bold font-display">Outstanding Obligations</h3>
              <span className="text-xs text-muted-foreground">(All time · as of {formattedObligationsAsOf} IST)</span>
            </div>
          </div>
          <div className="flex items-center gap-2 lg:ml-auto">
            <label htmlFor="obligations-as-of" className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
              As of
            </label>
            <Input
              id="obligations-as-of"
              type="datetime-local"
              value={obligationsAsOf}
              max={currentDateTimeLocal}
              onChange={(event) => setObligationsAsOf(event.target.value)}
              className="h-9 w-[220px] bg-background"
              aria-label="Outstanding obligations as of date and time"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 whitespace-nowrap"
              onClick={() => setObligationsAsOf(format(new Date(), "yyyy-MM-dd'T'HH:mm"))}
            >
              Live now
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        {isObligationsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30">
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownRight className="h-4 w-4 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">Total Receivable</span>
              </div>
              <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                ₹{obligationSummary.totalReceivable.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{pendingDebts.filter((d:any) => d.type === 'gave').length} pending from contacts</p>
            </Card>
            <Card className="p-4 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
              <div className="flex items-center gap-2 mb-1">
                <ArrowUpRight className="h-4 w-4 text-red-600" />
                <span className="text-xs font-semibold text-red-700 dark:text-red-400 uppercase tracking-wide">Total Payable</span>
              </div>
              <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                ₹{obligationSummary.totalPayable.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{pendingDebts.filter((d:any) => d.type === 'got').length} pending to contacts</p>
            </Card>
            <Card className="p-4 rounded-2xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-sky-600" />
                <span className="text-xs font-semibold text-sky-700 dark:text-sky-400 uppercase tracking-wide">Pending Split Bills</span>
              </div>
              <p className="text-2xl font-bold text-sky-700 dark:text-sky-400">
                ₹{obligationSummary.totalPendingSplits.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{pendingSplits.length} unsettled participants</p>
            </Card>
            <Card className="p-4 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
              <div className="flex items-center gap-2 mb-1">
                <ArrowDownRight className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Udhari (Net)</span>
              </div>
              <p className={cn(
                "text-2xl font-bold",
                obligationSummary.totalUdhariNet >= 0 ? "text-amber-700 dark:text-amber-400" : "text-red-700 dark:text-red-400"
              )}>
                {obligationSummary.totalUdhariNet >= 0 ? "+" : "-"}₹{Math.abs(obligationSummary.totalUdhariNet).toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Receivable − payable · same as Dashboard</p>
            </Card>
            <Card className="p-4 rounded-2xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/30">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-violet-600" />
                <span className="text-xs font-semibold text-violet-700 dark:text-violet-400 uppercase tracking-wide">Total Outstanding</span>
              </div>
              <p className="text-2xl font-bold text-violet-700 dark:text-violet-400">
                ₹{obligationSummary.totalOutstanding.toLocaleString('en-IN')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Receivable + payable + split bills</p>
            </Card>
          </div>
        )}

        {/* Action Required widget */}
        {!isObligationsLoading && actionRequired.length > 0 && (
          <Card className="p-4 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-bold text-amber-800 dark:text-amber-400">Action Required — {actionRequired.length} overdue obligation{actionRequired.length > 1 ? 's' : ''} (&gt;30 days)</span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {actionRequired.slice(0, 6).map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between bg-white dark:bg-slate-900 rounded-lg px-3 py-2 border border-amber-100 dark:border-amber-900">
                  <div className="flex items-center gap-2 min-w-0">
                    {item.source === 'split' ? <Users className="h-3.5 w-3.5 text-sky-500 shrink-0" /> : item.type === 'gave' ? <ArrowDownRight className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <ArrowUpRight className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                    <span className="text-sm font-medium truncate">{item.contactName}</span>
                    {item.source === 'split' && <span className="text-xs text-muted-foreground truncate hidden sm:inline">({item.description})</span>}
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-2">
                    <span className="text-sm font-bold">₹{Number(item.amount).toLocaleString('en-IN')}</span>
                    <span className="text-xs bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium">{item.daysPending}d</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Aging Buckets Chart */}
          <Card className="p-4 md:p-6 rounded-2xl border border-border shadow-sm">
            <h4 className="text-sm font-bold mb-4">Aging Buckets</h4>
            {isObligationsLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : agingData.some((b: any) => b.total > 0) ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={agingData} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                  <Tooltip
                    formatter={(value: number, name: string) => [`₹ ${Number(value).toLocaleString('en-IN')}`, name]}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="debts" name="Udhari Khata" stackId="a" fill="#7C3AED" radius={[0,0,0,0]} maxBarSize={48} />
                  <Bar dataKey="splits" name="Split Bills" stackId="a" fill="#EA580C" radius={[4,4,0,0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No outstanding obligations 🎉</div>
            )}
          </Card>

          {/* Detailed pending list */}
          <Card className="p-4 md:p-6 rounded-2xl border border-border shadow-sm">
            <h4 className="text-sm font-bold mb-4">Pending Entries ({allPendingItems.length})</h4>
            {isObligationsLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : allPendingItems.length > 0 ? (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {allPendingItems.map((item: any, idx: number) => {
                  const ageBucket = item.daysPending > 90 ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300' : item.daysPending > 60 ? 'bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300' : item.daysPending > 30 ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300' : 'bg-muted text-muted-foreground';
                  return (
                    <div key={idx} className="flex items-center justify-between rounded-lg px-3 py-2 bg-muted/40 border border-border">
                      <div className="flex items-center gap-2 min-w-0">
                        {item.source === 'split' ? <Users className="h-3.5 w-3.5 text-sky-500 shrink-0" /> : item.type === 'gave' ? <ArrowDownRight className="h-3.5 w-3.5 text-emerald-500 shrink-0" /> : <ArrowUpRight className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{item.contactName}</p>
                          <p className="text-xs text-muted-foreground">{new Date(item.originalDate).toLocaleDateString('en-IN')} · {item.kind}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-sm font-bold">₹{Number(item.amount).toLocaleString('en-IN')}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ageBucket}`}>{item.daysPending}d</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">All obligations settled! 🎉</div>
            )}
          </Card>
        </div>
      </div>

      <div className="grid lg:grid-cols-1 gap-8">
        {/* Monthly/Yearly Trend */}
        <Card className="p-6 rounded-2xl border border-border shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold font-display">Spending Trend</h3>
            <div className="flex bg-muted p-1 rounded-lg flex-wrap gap-1">
              <button 
                onClick={() => setTrendType('monthly')}
                className={cn("px-3 py-1 text-xs font-medium rounded-md transition-all", trendType === 'monthly' ? "bg-white shadow-sm text-foreground" : "text-muted-foreground")}
              >
                6M
              </button>
              <button 
                onClick={() => setTrendType('yearly')}
                className={cn("px-3 py-1 text-xs font-medium rounded-md transition-all", trendType === 'yearly' ? "bg-white shadow-sm text-foreground" : "text-muted-foreground")}
              >
                1Y
              </button>
              <button 
                onClick={() => setTrendType('3y')}
                className={cn("px-3 py-1 text-xs font-medium rounded-md transition-all", trendType === '3y' ? "bg-white shadow-sm text-foreground" : "text-muted-foreground")}
              >
                3Y
              </button>
              <button 
                onClick={() => setTrendType('5y')}
                className={cn("px-3 py-1 text-xs font-medium rounded-md transition-all", trendType === '5y' ? "bg-white shadow-sm text-foreground" : "text-muted-foreground")}
              >
                5Y
              </button>
              <button 
                onClick={() => setTrendType('alltime')}
                className={cn("px-3 py-1 text-xs font-medium rounded-md transition-all", trendType === 'alltime' ? "bg-white shadow-sm text-foreground" : "text-muted-foreground")}
              >
                All
              </button>
            </div>
          </div>
          <div className="h-[400px] w-full">
            {isTrendLoading ? (
              <Skeleton className="h-full w-full" />
            ) : trendData && trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} tickFormatter={(val) => `₹${val/1000}k`} />
                  <Tooltip 
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px', overflowWrap: 'break-word', whiteSpace: 'normal' }} />
                  <Bar dataKey="income" name="Income" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={30} />
                  <Bar dataKey="expenses" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
               <div className="h-full flex items-center justify-center text-muted-foreground">
                No trend data yet
              </div>
            )}
          </div>
        </Card>

        {/* Daily Spending Line Chart */}
        <Card className="p-6 rounded-2xl border border-border shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold font-display">Daily Spending Pattern</h3>
            <div className="flex bg-muted p-1 rounded-lg flex-wrap gap-1">
              <button 
                onClick={() => setDailySpendingPeriod('monthly')}
                className={cn("px-3 py-1 text-xs font-medium rounded-md transition-all", dailySpendingPeriod === 'monthly' ? "bg-white shadow-sm text-foreground" : "text-muted-foreground")}
              >
                6M
              </button>
              <button 
                onClick={() => setDailySpendingPeriod('yearly')}
                className={cn("px-3 py-1 text-xs font-medium rounded-md transition-all", dailySpendingPeriod === 'yearly' ? "bg-white shadow-sm text-foreground" : "text-muted-foreground")}
              >
                1Y
              </button>
              <button 
                onClick={() => setDailySpendingPeriod('3y')}
                className={cn("px-3 py-1 text-xs font-medium rounded-md transition-all", dailySpendingPeriod === '3y' ? "bg-white shadow-sm text-foreground" : "text-muted-foreground")}
              >
                3Y
              </button>
              <button 
                onClick={() => setDailySpendingPeriod('5y')}
                className={cn("px-3 py-1 text-xs font-medium rounded-md transition-all", dailySpendingPeriod === '5y' ? "bg-white shadow-sm text-foreground" : "text-muted-foreground")}
              >
                5Y
              </button>
              <button 
                onClick={() => setDailySpendingPeriod('alltime')}
                className={cn("px-3 py-1 text-xs font-medium rounded-md transition-all", dailySpendingPeriod === 'alltime' ? "bg-white shadow-sm text-foreground" : "text-muted-foreground")}
              >
                All
              </button>
            </div>
          </div>
          <div className="h-[300px] w-full">
            {isDailyLoading ? (
              <Skeleton className="h-full w-full" />
            ) : dailyData && dailyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSpent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} tickFormatter={(val) => `₹${val}`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(value: number) => `₹ ${value.toLocaleString('en-IN')}`}
                  />
                  <Area type="monotone" dataKey="amount" name="Spent" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorSpent)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Insufficient data for pattern analysis
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Export Date Range Section */}
      {isPro && (
        <div className="space-y-3">
          <div className="w-full bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20 border border-primary/20 dark:border-primary/30 rounded-xl p-4 sm:p-6 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">Export Date Range</label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex flex-col gap-1 w-full sm:w-auto">
                  <label className="text-xs text-muted-foreground">From</label>
                  <input 
                    type="date" 
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                    className="w-full sm:w-auto px-3 py-2 bg-white dark:bg-slate-900 border border-input rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div className="flex flex-col gap-1 w-full sm:w-auto">
                  <label className="text-xs text-muted-foreground">To</label>
                  <input 
                    type="date" 
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                    className="w-full sm:w-auto px-3 py-2 bg-white dark:bg-slate-900 border border-input rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-start sm:justify-end">
              <Button 
                size="sm" 
                onClick={handleExport} 
                className="w-full sm:w-auto rounded-lg font-medium bg-primary hover:bg-primary/90"
              >
                <FileText className="mr-2 h-4 w-4" />
                PDF
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

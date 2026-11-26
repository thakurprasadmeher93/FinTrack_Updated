import { and, asc, desc, eq, gte, ilike, inArray, lte, lt, or, sql } from "drizzle-orm";
import {
  adminSettings,
  auditLogs,
  billSplitParticipants,
  billSplits,
  budgets,
  coupons,
  debts,
  profiles,
  transactions,
  users,
  wealthSnapshots,
} from "@shared/schema";
import { db } from "./db";
import { normalizeAdminUserPageParams, toSafeAdminUser } from "./admin-utils";
import { normalizeAdminAuditParams, platformSettingsSchema } from "./admin-validation";
import { calculateDebtBalanceAt, calculateSplitShareAt, obligationAgingBucket } from "./obligation-calculations";

const IST_OFFSET_MS = 330 * 60 * 1000;

function istDayStart(reference: Date, dayOffset = 0): Date {
  const ist = new Date(reference.getTime() + IST_OFFSET_MS);
  const utcMidnight = Date.UTC(
    ist.getUTCFullYear(),
    ist.getUTCMonth(),
    ist.getUTCDate() + dayOffset,
  );
  return new Date(utcMidnight - IST_OFFSET_MS);
}

function istMonthStart(reference: Date, monthOffset = 0): Date {
  const ist = new Date(reference.getTime() + IST_OFFSET_MS);
  const utcMonthStart = Date.UTC(
    ist.getUTCFullYear(),
    ist.getUTCMonth() + monthOffset,
    1,
  );
  return new Date(utcMonthStart - IST_OFFSET_MS);
}

function dayKey(date: Date): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}-${String(ist.getUTCDate()).padStart(2, "0")}`;
}

function monthKey(date: Date): string {
  return dayKey(date).slice(0, 7);
}

function numeric(value: unknown): number {
  const result = Number(value || 0);
  return Number.isFinite(result) ? result : 0;
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

const defaultPlatformSettings = {
  applicationName: "FinTrack",
  supportEmail: "",
  registrationEnabled: true,
};

function istDateStart(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day) - IST_OFFSET_MS);
}

function safeAuditMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const safe: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (/password|token|secret|credential|cookie|session|authorization/i.test(key)) continue;
    if (typeof item === "string") safe[key.slice(0, 60)] = item.slice(0, 500);
    else if (typeof item === "number" || typeof item === "boolean" || item === null) safe[key.slice(0, 60)] = item;
    else if (Array.isArray(item)) {
      safe[key.slice(0, 60)] = item
        .filter(entry => typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean")
        .slice(0, 20);
    }
  }
  return safe;
}

async function getPlatformObligationSummary(referenceTime: Date) {
  const [debtRows, splitRows] = await Promise.all([
    db.select({
      type: debts.type,
      amount: debts.amount,
      date: debts.date,
      status: debts.status,
      settledAmount: debts.settledAmount,
      settledAt: debts.settledAt,
      note: debts.note,
    }).from(debts)
      .where(sql`(${debts.note} IS NULL OR ${debts.note} NOT LIKE 'Split:%')`),
    db.select({
      billId: billSplits.id,
      date: billSplits.date,
      participantId: billSplitParticipants.id,
      amount: billSplitParticipants.amount,
      settledAmount: billSplitParticipants.settledAmount,
      isSettled: billSplitParticipants.isSettled,
    }).from(billSplits)
      .leftJoin(billSplitParticipants, eq(billSplitParticipants.billSplitId, billSplits.id)),
  ]);

  const aging: Record<"0-30" | "31-60" | "61-90" | "90+", { debts: number; splits: number; total: number }> = {
    "0-30": { debts: 0, splits: 0, total: 0 },
    "31-60": { debts: 0, splits: 0, total: 0 },
    "61-90": { debts: 0, splits: 0, total: 0 },
    "90+": { debts: 0, splits: 0, total: 0 },
  };
  let totalDebtAmount = 0;
  let settledDebtAmount = 0;
  let pendingDebtRecords = 0;
  let settledDebtRecords = 0;
  let receivables = 0;
  let payables = 0;

  for (const row of debtRows) {
    const balance = calculateDebtBalanceAt(row, referenceTime);
    if (!balance.relevant) continue;
    totalDebtAmount += balance.total;
    settledDebtAmount += balance.settled;
    if (balance.outstanding > 0) {
      pendingDebtRecords += 1;
      if (row.type === "gave") receivables += balance.outstanding;
      else payables += balance.outstanding;
      const bucket = aging[obligationAgingBucket(balance.daysPending)];
      bucket.debts += balance.outstanding;
      bucket.total += balance.outstanding;
    } else {
      settledDebtRecords += 1;
    }
  }

  const billIds = new Set<number>();
  const activeBills = new Set<number>();
  let pendingSplitShares = 0;
  let pendingSplitAmount = 0;
  let settledSplitAmount = 0;
  for (const row of splitRows) {
    billIds.add(row.billId);
    if (row.participantId === null) continue;
    const balance = calculateSplitShareAt({
      amount: row.amount,
      settledAmount: row.settledAmount,
      isSettled: row.isSettled,
      date: row.date,
    }, referenceTime);
    if (!balance.relevant) continue;
    settledSplitAmount += balance.settled;
    if (balance.outstanding <= 0) continue;
    activeBills.add(row.billId);
    pendingSplitShares += 1;
    pendingSplitAmount += balance.outstanding;
    const bucket = aging[obligationAgingBucket(balance.daysPending)];
    bucket.splits += balance.outstanding;
    bucket.total += balance.outstanding;
  }

  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    udhari: {
      totalAmount: round(totalDebtAmount),
      totalRecords: debtRows.length,
      pendingRecords: pendingDebtRecords,
      settledRecords: settledDebtRecords,
      settledAmount: round(settledDebtAmount),
      outstandingReceivables: round(receivables),
      outstandingPayables: round(payables),
      totalOutstanding: round(receivables + payables),
      aging: Object.entries(aging).map(([range, amounts]) => ({ range, ...amounts })),
    },
    splitBills: {
      total: billIds.size,
      active: activeBills.size,
      settled: Math.max(0, billIds.size - activeBills.size),
      settledAmount: round(settledSplitAmount),
      pendingSettlements: pendingSplitShares,
      pendingAmount: round(pendingSplitAmount),
    },
  };
}

function userSearchConditions(search: string, filter: string) {
  const conditions: any[] = [];
  const query = search.trim().slice(0, 120);
  if (query) {
    const pattern = `%${query}%`;
    conditions.push(or(
      ilike(users.displayName, pattern),
      ilike(users.email, pattern),
      ilike(users.username, pattern),
    ));
  }

  if (["active", "inactive", "suspended"].includes(filter)) {
    conditions.push(eq(users.accountStatus, filter));
  } else if (filter === "free" || filter === "paid") {
    conditions.push(eq(users.subscriptionStatus, filter));
  } else if (filter === "admin") {
    conditions.push(or(
      eq(users.isAdmin, true),
      inArray(users.adminRole, ["super_admin", "admin", "support", "analyst"]),
    ));
  }
  return conditions.length ? and(...conditions) : undefined;
}

const safeUserSortColumns: Record<string, any> = {
  name: users.displayName,
  email: users.email,
  status: users.accountStatus,
  subscription: users.subscriptionStatus,
  createdAt: users.createdAt,
  lastLogin: users.lastLogin,
};

export const adminStorage = {
  async getUserPage(params: {
    page?: unknown;
    pageSize?: unknown;
    search?: unknown;
    filter?: unknown;
    sortBy?: unknown;
    sortDir?: unknown;
  }) {
    const normalized = normalizeAdminUserPageParams(params);
    const { page, pageSize, search, filter } = normalized;
    const where = userSearchConditions(search, filter);
    const sortColumn = safeUserSortColumns[normalized.sortBy] || users.createdAt;
    const order = normalized.sortDir === "asc" ? asc(sortColumn) : desc(sortColumn);

    const [countRows, items] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)::int` }).from(users).where(where),
      db.select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        email: sql<string>`COALESCE(NULLIF(${users.email}, ''), ${users.username})`,
        accountStatus: users.accountStatus,
        subscriptionStatus: users.subscriptionStatus,
        isAdmin: users.isAdmin,
        adminRole: users.adminRole,
        createdAt: users.createdAt,
        lastLogin: users.lastLogin,
      })
        .from(users)
        .where(where)
        .orderBy(order, asc(users.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    const total = numeric(countRows[0]?.count);
    const userIds = items.map(item => item.id);
    const [transactionCountRows, profileCountRows] = userIds.length ? await Promise.all([
      db.select({
        userId: profiles.userId,
        count: sql<number>`COUNT(*)::int`,
      })
        .from(transactions)
        .innerJoin(profiles, eq(profiles.id, transactions.profileId))
        .where(inArray(profiles.userId, userIds))
        .groupBy(profiles.userId),
      db.select({
        userId: profiles.userId,
        count: sql<number>`COUNT(*)::int`,
      })
        .from(profiles)
        .where(inArray(profiles.userId, userIds))
        .groupBy(profiles.userId),
    ]) : [[], []];
    const transactionCounts = new Map(transactionCountRows.map(row => [row.userId, numeric(row.count)]));
    const profileCounts = new Map(profileCountRows.map(row => [row.userId, numeric(row.count)]));

    return {
      items: items.map(item => toSafeAdminUser({
        ...item,
        transactionCount: transactionCounts.get(item.id) || 0,
        profileCount: profileCounts.get(item.id) || 0,
      })),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  },

  async getUserDetail(userId: number) {
    const [user] = await db.select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      email: sql<string>`COALESCE(NULLIF(${users.email}, ''), ${users.username})`,
      accountStatus: users.accountStatus,
      subscriptionStatus: users.subscriptionStatus,
      isAdmin: users.isAdmin,
      adminRole: users.adminRole,
      createdAt: users.createdAt,
      lastLogin: users.lastLogin,
    }).from(users).where(eq(users.id, userId)).limit(1);
    if (!user) return undefined;

    const [
      profilesResult,
      transactionsResult,
      budgetsResult,
      debtsResult,
      splitResult,
      wealthResult,
      activity,
    ] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)::int` })
        .from(profiles).where(eq(profiles.userId, userId)),
      db.select({
        count: sql<number>`COUNT(*)::int`,
        income: sql<number>`COALESCE(SUM(ABS(${transactions.amount}::numeric)) FILTER (WHERE ${transactions.type} = 'income'), 0)::float8`,
        expenses: sql<number>`COALESCE(SUM(ABS(${transactions.amount}::numeric)) FILTER (WHERE ${transactions.type} = 'expense'), 0)::float8`,
      })
        .from(transactions)
        .innerJoin(profiles, eq(profiles.id, transactions.profileId))
        .where(eq(profiles.userId, userId)),
      db.select({ count: sql<number>`COUNT(*)::int` })
        .from(budgets)
        .innerJoin(profiles, eq(profiles.id, budgets.profileId))
        .where(eq(profiles.userId, userId)),
      db.select({
        count: sql<number>`COUNT(*)::int`,
        outstanding: sql<number>`COALESCE(SUM(GREATEST(ABS(${debts.amount}::numeric) - ${debts.settledAmount}::numeric, 0)) FILTER (WHERE ${debts.status} <> 'settled'), 0)::float8`,
      })
        .from(debts)
        .innerJoin(profiles, eq(profiles.id, debts.profileId))
        .where(and(
          eq(profiles.userId, userId),
          sql`(${debts.note} IS NULL OR ${debts.note} NOT LIKE 'Split:%')`,
        )),
      db.select({
        count: sql<number>`COUNT(DISTINCT ${billSplits.id})::int`,
        pendingSettlements: sql<number>`COUNT(*) FILTER (WHERE ${billSplitParticipants.id} IS NOT NULL AND ${billSplitParticipants.isSettled} = false AND ${billSplitParticipants.settledAmount}::numeric < ${billSplitParticipants.amount}::numeric)::int`,
      })
        .from(billSplits)
        .innerJoin(profiles, eq(profiles.id, billSplits.profileId))
        .leftJoin(billSplitParticipants, eq(billSplitParticipants.billSplitId, billSplits.id))
        .where(eq(profiles.userId, userId)),
      db.select({ count: sql<number>`COUNT(*)::int` })
        .from(wealthSnapshots)
        .innerJoin(profiles, eq(profiles.id, wealthSnapshots.profileId))
        .where(eq(profiles.userId, userId)),
      db.select({
        id: auditLogs.id,
        actorId: auditLogs.userId,
        actorName: users.displayName,
        actorEmail: sql<string>`COALESCE(NULLIF(${users.email}, ''), ${users.username})`,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        details: auditLogs.details,
        success: auditLogs.success,
        createdAt: auditLogs.createdAt,
      })
        .from(auditLogs)
        .innerJoin(users, eq(users.id, auditLogs.userId))
        .where(or(
          eq(auditLogs.userId, userId),
          and(eq(auditLogs.entityType, "user"), eq(auditLogs.entityId, userId)),
        ))
        .orderBy(desc(auditLogs.createdAt))
        .limit(20),
    ]);

    return {
      user: toSafeAdminUser(user),
      usage: {
        profiles: numeric(profilesResult[0]?.count),
        transactions: numeric(transactionsResult[0]?.count),
        income: numeric(transactionsResult[0]?.income),
        expenses: numeric(transactionsResult[0]?.expenses),
        budgets: numeric(budgetsResult[0]?.count),
        udhariRecords: numeric(debtsResult[0]?.count),
        udhariOutstanding: numeric(debtsResult[0]?.outstanding),
        splitBills: numeric(splitResult[0]?.count),
        pendingSplitSettlements: numeric(splitResult[0]?.pendingSettlements),
        wealthSnapshots: numeric(wealthResult[0]?.count),
      },
      recentActivity: activity,
    };
  },

  async getOverview() {
    const now = new Date();
    const todayStart = istDayStart(now);
    const tomorrowStart = istDayStart(now, 1);
    const istNow = new Date(now.getTime() + IST_OFFSET_MS);
    const weekday = istNow.getUTCDay();
    const weekStart = istDayStart(now, -((weekday + 6) % 7));
    const monthStart = istMonthStart(now);
    const dailyStart = istDayStart(now, -29);
    const monthlyStart = istMonthStart(now, -11);
    const previousDailyStart = istDayStart(now, -59);
    const currentMonthNumber = istNow.getUTCMonth() + 1;
    const currentYear = istNow.getUTCFullYear();
    const latestWealthByProfile = db.selectDistinctOn([wealthSnapshots.profileId], {
      profileId: wealthSnapshots.profileId,
      assets: sql<number>`(${wealthSnapshots.totalImmovable}::numeric + ${wealthSnapshots.totalMovable}::numeric + ${wealthSnapshots.totalOtherMovable}::numeric)::float8`.as("assets"),
      liabilities: sql<number>`${wealthSnapshots.totalLiabilities}::float8`.as("liabilities"),
    }).from(wealthSnapshots)
      .orderBy(wealthSnapshots.profileId, desc(wealthSnapshots.snapshotDate), desc(wealthSnapshots.id))
      .as("latest_wealth");

    const [
      usersSummaryRows,
      usageRows,
      profileCountRows,
      budgetCountRows,
      wealthCountRows,
      activeBudgetRows,
      budgetExpenseRows,
      latestWealthRows,
      loginActivityRows,
      userGrowthRows,
      transactionGrowthRows,
      obligations,
      dailyUserRows,
      monthlyUserRows,
      dailyTransactionRows,
      monthlyTransactionRows,
      recentRegistrations,
      recentLogins,
      recentAdminActions,
      recentPlatformActivity,
    ] = await Promise.all([
      db.select({
        total: sql<number>`COUNT(*)::int`,
        active: sql<number>`COUNT(*) FILTER (WHERE ${users.accountStatus} = 'active')::int`,
        inactive: sql<number>`COUNT(*) FILTER (WHERE ${users.accountStatus} = 'inactive')::int`,
        suspended: sql<number>`COUNT(*) FILTER (WHERE ${users.accountStatus} = 'suspended')::int`,
        free: sql<number>`COUNT(*) FILTER (WHERE ${users.subscriptionStatus} = 'free')::int`,
        paid: sql<number>`COUNT(*) FILTER (WHERE ${users.subscriptionStatus} = 'paid')::int`,
        newToday: sql<number>`COUNT(*) FILTER (WHERE ${users.createdAt} >= ${todayStart} AND ${users.createdAt} < ${tomorrowStart})::int`,
        newThisWeek: sql<number>`COUNT(*) FILTER (WHERE ${users.createdAt} >= ${weekStart})::int`,
        newThisMonth: sql<number>`COUNT(*) FILTER (WHERE ${users.createdAt} >= ${monthStart})::int`,
      }).from(users),
      db.select({
        transactionCount: sql<number>`COUNT(*)::int`,
        income: sql<number>`COALESCE(SUM(ABS(${transactions.amount}::numeric)) FILTER (WHERE ${transactions.type} = 'income'), 0)::float8`,
        expenses: sql<number>`COALESCE(SUM(ABS(${transactions.amount}::numeric)) FILTER (WHERE ${transactions.type} = 'expense'), 0)::float8`,
      }).from(transactions),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(profiles),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(budgets),
      db.select({ count: sql<number>`COUNT(*)::int` }).from(wealthSnapshots),
      db.select({
        count: sql<number>`COUNT(*)::int`,
        amount: sql<number>`COALESCE(SUM(${budgets.amount}::numeric), 0)::float8`,
      }).from(budgets)
        .where(and(eq(budgets.month, currentMonthNumber), eq(budgets.year, currentYear))),
      db.select({
        amount: sql<number>`COALESCE(SUM(ABS(${transactions.amount}::numeric)), 0)::float8`,
      }).from(transactions)
        .where(and(
          eq(transactions.type, "expense"),
          gte(transactions.date, monthStart),
          lte(transactions.date, now),
          sql`EXISTS (
            SELECT 1 FROM budgets active_budget
            WHERE active_budget.profile_id = ${transactions.profileId}
              AND active_budget.month = ${currentMonthNumber}
              AND active_budget.year = ${currentYear}
          )`,
        )),
      db.select({
        profiles: sql<number>`COUNT(*)::int`,
        assets: sql<number>`COALESCE(SUM(${latestWealthByProfile.assets}::numeric), 0)::float8`,
        liabilities: sql<number>`COALESCE(SUM(${latestWealthByProfile.liabilities}::numeric), 0)::float8`,
      }).from(latestWealthByProfile),
      db.select({
        dau: sql<number>`COUNT(DISTINCT ${auditLogs.userId}) FILTER (WHERE ${auditLogs.action} = 'login' AND ${auditLogs.createdAt} >= ${todayStart})::int`,
        wau: sql<number>`COUNT(DISTINCT ${auditLogs.userId}) FILTER (WHERE ${auditLogs.action} = 'login' AND ${auditLogs.createdAt} >= ${istDayStart(now, -6)})::int`,
        mau: sql<number>`COUNT(DISTINCT ${auditLogs.userId}) FILTER (WHERE ${auditLogs.action} = 'login' AND ${auditLogs.createdAt} >= ${istDayStart(now, -29)})::int`,
      }).from(auditLogs),
      db.select({
        current: sql<number>`COUNT(*) FILTER (WHERE ${users.createdAt} >= ${dailyStart})::int`,
        previous: sql<number>`COUNT(*) FILTER (WHERE ${users.createdAt} >= ${previousDailyStart} AND ${users.createdAt} < ${dailyStart})::int`,
      }).from(users),
      db.select({
        current: sql<number>`COUNT(*) FILTER (WHERE ${transactions.date} >= ${dailyStart} AND ${transactions.date} <= ${now})::int`,
        previous: sql<number>`COUNT(*) FILTER (WHERE ${transactions.date} >= ${previousDailyStart} AND ${transactions.date} < ${dailyStart})::int`,
      }).from(transactions),
      getPlatformObligationSummary(now),
      db.select({
        period: sql<string>`to_char(date_trunc('day', ${users.createdAt} + interval '5 hours 30 minutes'), 'YYYY-MM-DD')`,
        count: sql<number>`COUNT(*)::int`,
      }).from(users)
        .where(gte(users.createdAt, dailyStart))
        .groupBy(sql`date_trunc('day', ${users.createdAt} + interval '5 hours 30 minutes')`)
        .orderBy(sql`date_trunc('day', ${users.createdAt} + interval '5 hours 30 minutes')`),
      db.select({
        period: sql<string>`to_char(date_trunc('month', ${users.createdAt} + interval '5 hours 30 minutes'), 'YYYY-MM')`,
        count: sql<number>`COUNT(*)::int`,
      }).from(users)
        .where(gte(users.createdAt, monthlyStart))
        .groupBy(sql`date_trunc('month', ${users.createdAt} + interval '5 hours 30 minutes')`)
        .orderBy(sql`date_trunc('month', ${users.createdAt} + interval '5 hours 30 minutes')`),
      db.select({
        period: sql<string>`to_char(date_trunc('day', ${transactions.date} + interval '5 hours 30 minutes'), 'YYYY-MM-DD')`,
        count: sql<number>`COUNT(*)::int`,
        income: sql<number>`COALESCE(SUM(ABS(${transactions.amount}::numeric)) FILTER (WHERE ${transactions.type} = 'income'), 0)::float8`,
        expenses: sql<number>`COALESCE(SUM(ABS(${transactions.amount}::numeric)) FILTER (WHERE ${transactions.type} = 'expense'), 0)::float8`,
      }).from(transactions)
        .where(gte(transactions.date, dailyStart))
        .groupBy(sql`date_trunc('day', ${transactions.date} + interval '5 hours 30 minutes')`)
        .orderBy(sql`date_trunc('day', ${transactions.date} + interval '5 hours 30 minutes')`),
      db.select({
        period: sql<string>`to_char(date_trunc('month', ${transactions.date} + interval '5 hours 30 minutes'), 'YYYY-MM')`,
        count: sql<number>`COUNT(*)::int`,
        income: sql<number>`COALESCE(SUM(ABS(${transactions.amount}::numeric)) FILTER (WHERE ${transactions.type} = 'income'), 0)::float8`,
        expenses: sql<number>`COALESCE(SUM(ABS(${transactions.amount}::numeric)) FILTER (WHERE ${transactions.type} = 'expense'), 0)::float8`,
      }).from(transactions)
        .where(gte(transactions.date, monthlyStart))
        .groupBy(sql`date_trunc('month', ${transactions.date} + interval '5 hours 30 minutes')`)
        .orderBy(sql`date_trunc('month', ${transactions.date} + interval '5 hours 30 minutes')`),
      db.select({
        id: users.id,
        name: users.displayName,
        email: sql<string>`COALESCE(NULLIF(${users.email}, ''), ${users.username})`,
        createdAt: users.createdAt,
      }).from(users).orderBy(desc(users.createdAt)).limit(5),
      db.select({
        id: users.id,
        name: users.displayName,
        email: sql<string>`COALESCE(NULLIF(${users.email}, ''), ${users.username})`,
        lastLogin: users.lastLogin,
      }).from(users)
        .where(sql`${users.lastLogin} IS NOT NULL`)
        .orderBy(desc(users.lastLogin))
        .limit(5),
      db.select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        details: auditLogs.details,
        createdAt: auditLogs.createdAt,
        actorName: users.displayName,
        actorEmail: sql<string>`COALESCE(NULLIF(${users.email}, ''), ${users.username})`,
      }).from(auditLogs)
        .innerJoin(users, eq(users.id, auditLogs.userId))
        .where(sql`${auditLogs.action} LIKE 'admin:%'`)
        .orderBy(desc(auditLogs.createdAt))
        .limit(5),
      db.select({
        id: auditLogs.id,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        createdAt: auditLogs.createdAt,
        actorName: users.displayName,
      }).from(auditLogs)
        .innerJoin(users, eq(users.id, auditLogs.userId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(8),
    ]);

    const userStats = usersSummaryRows[0] || {};
    const usage = usageRows[0] || {};
    const loginActivity = loginActivityRows[0] || {};
    const userGrowth = userGrowthRows[0] || {};
    const transactionGrowth = transactionGrowthRows[0] || {};
    const activeBudget = activeBudgetRows[0] || {};
    const budgetSpend = budgetExpenseRows[0] || {};
    const latestWealth = latestWealthRows[0] || {};
    const percentGrowth = (current: unknown, previous: unknown) => {
      const currentCount = numeric(current);
      const previousCount = numeric(previous);
      return previousCount > 0
        ? Math.round(((currentCount - previousCount) / previousCount) * 1000) / 10
        : null;
    };
    const dailyUsers = new Map(dailyUserRows.map(row => [row.period, numeric(row.count)]));
    const monthlyUsers = new Map(monthlyUserRows.map(row => [row.period, numeric(row.count)]));
    const dailyActivity = new Map(dailyTransactionRows.map(row => [row.period, row]));
    const monthlyActivity = new Map(monthlyTransactionRows.map(row => [row.period, row]));

    const dailyUserGrowth = Array.from({ length: 30 }, (_, index) => {
      const date = istDayStart(now, index - 29);
      const key = dayKey(date);
      return { date: key, label: key.slice(5), users: dailyUsers.get(key) || 0 };
    });
    const monthlyUserGrowth = Array.from({ length: 12 }, (_, index) => {
      const date = istMonthStart(now, index - 11);
      const key = monthKey(date);
      return { month: key, label: key, users: monthlyUsers.get(key) || 0 };
    });
    const dailyTransactions = Array.from({ length: 30 }, (_, index) => {
      const date = istDayStart(now, index - 29);
      const key = dayKey(date);
      const row = dailyActivity.get(key);
      return {
        date: key,
        label: key.slice(5),
        transactions: numeric(row?.count),
        income: numeric(row?.income),
        expenses: numeric(row?.expenses),
      };
    });
    const monthlyTransactions = Array.from({ length: 12 }, (_, index) => {
      const date = istMonthStart(now, index - 11);
      const key = monthKey(date);
      const row = monthlyActivity.get(key);
      return {
        month: key,
        label: key,
        transactions: numeric(row?.count),
        income: numeric(row?.income),
        expenses: numeric(row?.expenses),
      };
    });

    return {
      generatedAt: now.toISOString(),
      metrics: {
        users: {
          total: numeric(userStats.total),
          active: numeric(userStats.active),
          inactive: numeric(userStats.inactive),
          suspended: numeric(userStats.suspended),
          newToday: numeric(userStats.newToday),
          newThisWeek: numeric(userStats.newThisWeek),
          newThisMonth: numeric(userStats.newThisMonth),
          free: numeric(userStats.free),
          paid: numeric(userStats.paid),
          dau: numeric(loginActivity.dau),
          wau: numeric(loginActivity.wau),
          mau: numeric(loginActivity.mau),
          usersLast30Days: numeric(userGrowth.current),
          usersPrevious30Days: numeric(userGrowth.previous),
          userGrowthPercent: percentGrowth(userGrowth.current, userGrowth.previous),
        },
        platform: {
          transactions: numeric(usage.transactionCount),
          income: numeric(usage.income),
          expenses: numeric(usage.expenses),
          averageTransactionAmount: numeric(usage.transactionCount)
            ? (numeric(usage.income) + numeric(usage.expenses)) / numeric(usage.transactionCount)
            : 0,
          transactionsLast30Days: numeric(transactionGrowth.current),
          transactionsPrevious30Days: numeric(transactionGrowth.previous),
          transactionGrowthPercent: percentGrowth(transactionGrowth.current, transactionGrowth.previous),
          budgets: numeric(budgetCountRows[0]?.count),
          activeBudgets: numeric(activeBudget.count),
          activeBudgetTotal: numeric(activeBudget.amount),
          activeBudgetSpent: numeric(budgetSpend.amount),
          activeBudgetUsagePercent: numeric(activeBudget.amount) > 0
            ? Math.round((numeric(budgetSpend.amount) / numeric(activeBudget.amount)) * 1000) / 10
            : null,
          profiles: numeric(profileCountRows[0]?.count),
          wealthSnapshots: numeric(wealthCountRows[0]?.count),
          latestWealthProfiles: numeric(latestWealth.profiles),
          latestWealthAssets: numeric(latestWealth.assets),
          latestWealthLiabilities: numeric(latestWealth.liabilities),
        },
        udhari: obligations.udhari,
        splitBills: obligations.splitBills,
      },
      charts: {
        dailyUserGrowth,
        monthlyUserGrowth,
        dailyTransactions,
        monthlyTransactions,
        subscriptionDistribution: [
          { name: "Free", value: numeric(userStats.free) },
          { name: "Paid", value: numeric(userStats.paid) },
        ],
      },
      activity: {
        recentRegistrations,
        recentLogins,
        recentAdminActions,
        recentPlatformActivity,
      },
    };
  },

  async getAuditLogPage(params: Record<string, unknown>) {
    const filters = normalizeAdminAuditParams(params);
    const conditions: any[] = [];
    if (filters.from) conditions.push(gte(auditLogs.createdAt, istDateStart(filters.from)));
    if (filters.to) conditions.push(lt(auditLogs.createdAt, new Date(istDateStart(filters.to).getTime() + 86_400_000)));
    if (filters.actor) {
      const actorPattern = `%${filters.actor}%`;
      conditions.push(or(
        ilike(users.displayName, actorPattern),
        ilike(users.email, actorPattern),
        ilike(users.username, actorPattern),
      ));
    }
    if (filters.action) conditions.push(ilike(auditLogs.action, `%${filters.action}%`));
    if (filters.target) {
      const targetPattern = `%${filters.target}%`;
      conditions.push(or(
        ilike(auditLogs.entityType, targetPattern),
        sql`${auditLogs.entityId}::text ILIKE ${targetPattern}`,
        sql`(${auditLogs.entityType} = 'user' AND EXISTS (
          SELECT 1 FROM users audit_target
          WHERE audit_target.id = ${auditLogs.entityId}
            AND (
              audit_target.display_name ILIKE ${targetPattern}
              OR audit_target.email ILIKE ${targetPattern}
              OR audit_target.username ILIKE ${targetPattern}
            )
        ))`,
      ));
    }
    if (filters.targetUserId) {
      conditions.push(and(eq(auditLogs.entityType, "user"), eq(auditLogs.entityId, filters.targetUserId)));
    }
    if (filters.result !== "all") conditions.push(eq(auditLogs.success, filters.result === "success"));
    const where = conditions.length ? and(...conditions) : undefined;
    const [countRows, items] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)::int` })
        .from(auditLogs)
        .innerJoin(users, eq(users.id, auditLogs.userId))
        .where(where),
      db.select({
        id: auditLogs.id,
        actorId: auditLogs.userId,
        actorName: users.displayName,
        actorEmail: sql<string>`COALESCE(NULLIF(${users.email}, ''), ${users.username})`,
        action: auditLogs.action,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        details: auditLogs.details,
        success: auditLogs.success,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
      }).from(auditLogs)
        .innerJoin(users, eq(users.id, auditLogs.userId))
        .where(where)
        .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
        .limit(filters.pageSize)
        .offset((filters.page - 1) * filters.pageSize),
    ]);
    const total = numeric(countRows[0]?.count);
    const targetIds = Array.from(new Set(items
      .filter(item => item.entityType === "user" && item.entityId !== null)
      .map(item => item.entityId as number)));
    const targetRows = targetIds.length
      ? await db.select({
        id: users.id,
        name: users.displayName,
        email: sql<string>`COALESCE(NULLIF(${users.email}, ''), ${users.username})`,
      }).from(users).where(inArray(users.id, targetIds))
      : [];
    const targetById = new Map(targetRows.map(target => [target.id, target]));
    return {
      items: items.map(item => {
        const target = item.entityType === "user" && item.entityId !== null
          ? targetById.get(item.entityId)
          : undefined;
        return {
          ...item,
          targetName: target?.name ?? null,
          targetEmail: target?.email ?? null,
          metadata: safeAuditMetadata(item.metadata),
        };
      }),
      ...filters,
      total,
      totalPages: Math.ceil(total / filters.pageSize),
    };
  },

  async getCouponPage(params: Record<string, unknown>) {
    const page = boundedInteger(params.page, 1, 1, 1_000_000);
    const parsedPageSize = Number(params.pageSize);
    const pageSize = [25, 50, 100].includes(parsedPageSize) ? parsedPageSize : 25;
    const search = String(params.search || "").trim().slice(0, 120);
    const status = ["active", "inactive", "scheduled", "expired", "exhausted"].includes(String(params.status))
      ? String(params.status)
      : "all";
    const sortBy = String(params.sortBy || "createdAt");
    const sortColumn = sortBy === "code" ? coupons.code : sortBy === "expiresAt" ? coupons.expiresAt : coupons.createdAt;
    const order = params.sortDir === "asc" ? asc(sortColumn) : desc(sortColumn);
    const now = new Date();
    const conditions: any[] = [];
    if (search) conditions.push(or(ilike(coupons.code, `%${search}%`), ilike(coupons.description, `%${search}%`)));
    if (status === "active") conditions.push(and(
      eq(coupons.isActive, true),
      lte(coupons.startsAt, now),
      gte(coupons.expiresAt, now),
      sql`(${coupons.maxRedemptions} IS NULL OR ${coupons.currentRedemptions} < ${coupons.maxRedemptions})`,
    ));
    if (status === "inactive") conditions.push(eq(coupons.isActive, false));
    if (status === "scheduled") conditions.push(and(eq(coupons.isActive, true), gte(coupons.startsAt, now)));
    if (status === "expired") conditions.push(lt(coupons.expiresAt, now));
    if (status === "exhausted") conditions.push(and(
      sql`${coupons.maxRedemptions} IS NOT NULL`,
      sql`${coupons.currentRedemptions} >= ${coupons.maxRedemptions}`,
    ));
    const where = conditions.length ? and(...conditions) : undefined;
    const [countRows, items] = await Promise.all([
      db.select({ count: sql<number>`COUNT(*)::int` }).from(coupons).where(where),
      db.select().from(coupons)
        .where(where)
        .orderBy(order, asc(coupons.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);
    const total = numeric(countRows[0]?.count);
    return { items, page, pageSize, search, status, total, totalPages: Math.ceil(total / pageSize) };
  },

  async getCoupon(id: number) {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.id, id)).limit(1);
    return coupon;
  },

  async createCoupon(input: typeof coupons.$inferInsert) {
    const [created] = await db.insert(coupons).values(input).returning();
    return created;
  },

  async updateCoupon(id: number, values: Partial<typeof coupons.$inferInsert>, updatedBy: number) {
    const [updated] = await db.update(coupons)
      .set({ ...values, updatedBy, updatedAt: new Date() })
      .where(eq(coupons.id, id))
      .returning();
    return updated;
  },

  async deleteCouponIfUnused(id: number) {
    const [deleted] = await db.delete(coupons)
      .where(and(eq(coupons.id, id), eq(coupons.currentRedemptions, 0)))
      .returning({ id: coupons.id });
    return deleted;
  },

  async getPlatformSettings() {
    const rows = await db.select().from(adminSettings);
    const values: Record<string, unknown> = { ...defaultPlatformSettings };
    for (const row of rows) {
      if (row.key in defaultPlatformSettings) values[row.key] = row.value;
    }
    return platformSettingsSchema.parse(values);
  },

  async updatePlatformSettings(values: typeof defaultPlatformSettings, updatedBy: number) {
    const now = new Date();
    await db.transaction(async tx => {
      for (const [key, value] of Object.entries(values)) {
        await tx.insert(adminSettings)
          .values({ key, value, updatedBy, updatedAt: now })
          .onConflictDoUpdate({
            target: adminSettings.key,
            set: { value, updatedBy, updatedAt: now },
          });
      }
    });
    return values;
  },
};

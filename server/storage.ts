import { 
  users, profiles, categories, transactions, budgets, auditLogs, categoryRules, debts, billSplits, billSplitParticipants,
  wealthSnapshots, wealthImmovableRows, wealthMovableRows, wealthOtherRows,
  type User, type InsertUser,
  type Profile, type InsertProfile, type UpdateProfileRequest,
  type Category, type InsertCategory,
  type Transaction, type InsertTransaction,
  type Budget, type InsertBudget,
  type TransactionSummary, type MonthlyAnalysis,
  type AuditLog, type InsertAuditLog,
  type CategoryRule, type InsertCategoryRule,
  type Debt, type InsertDebt, type UpdateDebtRequest,
  type BillSplit, type BillSplitParticipant, type InsertBillSplit, type InsertBillSplitParticipant,
  type WealthSnapshot, type WealthImmovableRow, type WealthMovableRow, type WealthOtherRow,
  type WealthSnapshotWithRows,
  type InsertWealthSnapshot, type InsertWealthImmovableRow, type InsertWealthMovableRow, type InsertWealthOtherRow
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, sql, sum, ilike } from "drizzle-orm";
import { format } from "date-fns";
import { calculateDebtBalanceAt, calculateSplitShareAt, obligationAgingBucket } from "./obligation-calculations";

function normalizeWealthDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid wealth date");
  }
  return date;
}

export class DatabaseStorage {
  // Audit Logs
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [newLog] = await db.insert(auditLogs).values(log).returning();
    return newLog;
  }

  async getAuditLogs(userId: number): Promise<AuditLog[]> {
    return await db.select().from(auditLogs).where(eq(auditLogs.userId, userId)).orderBy(desc(auditLogs.createdAt));
  }

  async getCategoryRules(profileId: number): Promise<(CategoryRule & { category: Category })[]> {
    return await db.query.categoryRules.findMany({
      where: eq(categoryRules.profileId, profileId),
      with: {
        category: true
      }
    });
  }

  async createCategoryRule(rule: InsertCategoryRule): Promise<CategoryRule> {
    const [newRule] = await db.insert(categoryRules).values(rule).returning();
    return newRule;
  }

  async deleteCategoryRule(id: number): Promise<void> {
    await db.delete(categoryRules).where(eq(categoryRules.id, id));
  }

  // Profiles
  async getProfiles(userId: number): Promise<Profile[]> {
    return await db.select().from(profiles).where(eq(profiles.userId, userId));
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getProfile(id: number): Promise<Profile | undefined> {
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, id));
    return profile;
  }

  async createProfile(profile: InsertProfile): Promise<Profile> {
    const [newProfile] = await db.insert(profiles).values(profile).returning();
    return newProfile;
  }

  async updateProfile(id: number, updates: UpdateProfileRequest): Promise<Profile> {
    const [updated] = await db.update(profiles).set(updates).where(eq(profiles.id, id)).returning();
    return updated;
  }

  async deleteProfile(id: number): Promise<void> {
    // Delete all related data first
    await db.delete(transactions).where(eq(transactions.profileId, id));
    await db.delete(budgets).where(eq(budgets.profileId, id));
    await db.delete(categories).where(eq(categories.profileId, id));
    await db.delete(categoryRules).where(eq(categoryRules.profileId, id));
    // Delete wealth data: child rows must be deleted before snapshots
    const snapIds = await db.select({ id: wealthSnapshots.id }).from(wealthSnapshots).where(eq(wealthSnapshots.profileId, id));
    for (const { id: snapId } of snapIds) {
      await db.delete(wealthImmovableRows).where(eq(wealthImmovableRows.snapshotId, snapId));
      await db.delete(wealthMovableRows).where(eq(wealthMovableRows.snapshotId, snapId));
      await db.delete(wealthOtherRows).where(eq(wealthOtherRows.snapshotId, snapId));
    }
    await db.delete(wealthSnapshots).where(eq(wealthSnapshots.profileId, id));
    await db.delete(profiles).where(eq(profiles.id, id));
  }

  // Categories
  async getCategories(profileId: number): Promise<Category[]> {
    return await db.select().from(categories).where(eq(categories.profileId, profileId));
  }

  async getCategory(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  async updateCategory(id: number, data: { name?: string; color?: string }): Promise<Category> {
    const [updated] = await db
      .update(categories)
      .set(data)
      .where(eq(categories.id, id))
      .returning();
    return updated;
  }

  async deleteCategory(id: number, profileId: number): Promise<{ movedCount: number; otherCategoryName: string }> {
    const [cat] = await db.select().from(categories).where(eq(categories.id, id));
    if (!cat) throw new Error("Category not found");
    if (cat.name === "Other") throw new Error("Cannot delete the 'Other' category");

    // Count transactions under this category
    const affectedTxs = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.categoryId, id), eq(transactions.profileId, profileId)));

    let otherCat: Category | undefined;
    if (affectedTxs.length > 0) {
      // Find the "Other" category of the same type
      const allCats = await db.select().from(categories).where(eq(categories.profileId, profileId));
      otherCat = allCats.find(c => c.name === "Other" && c.type === cat.type);

      // Create one if it doesn't exist
      if (!otherCat) {
        const [created] = await db.insert(categories).values({
          profileId,
          name: "Other",
          type: cat.type,
          icon: "Tag",
          color: "#64748b",
          isDefault: true,
        }).returning();
        otherCat = created;
      }

      // Reassign transactions
      await db
        .update(transactions)
        .set({ categoryId: otherCat.id })
        .where(and(eq(transactions.categoryId, id), eq(transactions.profileId, profileId)));
    }

    // Delete the category
    await db.delete(categories).where(eq(categories.id, id));

    return {
      movedCount: affectedTxs.length,
      otherCategoryName: otherCat?.name ?? "Other",
    };
  }

  // Transactions
  async getTransactions(profileId: number, options?: { month?: number, year?: number, categoryId?: number }): Promise<(Transaction & { category: Category | null })[]> {
    let conditions = eq(transactions.profileId, profileId);

    if (options?.categoryId) {
      conditions = and(conditions, eq(transactions.categoryId, options.categoryId))!;
    }

    if (options?.month && options?.year) {
      const startDate = new Date(options.year, options.month - 1, 1, 0, 0, 0, 0);
      const endDate = new Date(options.year, options.month, 0, 23, 59, 59, 999); 
      conditions = and(conditions, 
        sql`${transactions.date} >= ${startDate.toISOString()}`,
        sql`${transactions.date} <= ${endDate.toISOString()}`
      )!;
    }

    const txs = await db.query.transactions.findMany({
      where: conditions,
      orderBy: [desc(transactions.date)],
      with: {
        category: true
      }
    });

    return txs;
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    // Smart Category Auto-Assignment Logic
    let categoryId = transaction.categoryId;
    
    if (!categoryId && transaction.note) {
      const rules = await this.getCategoryRules(transaction.profileId);
      for (const rule of rules) {
        if (transaction.note.toLowerCase().includes(rule.keyword.toLowerCase())) {
          categoryId = rule.categoryId;
          break;
        }
      }
    }

    const [newTx] = await db.insert(transactions).values({
      ...transaction,
      categoryId
    }).returning();

    await this.createAuditLog({
      userId: (await this.getProfile(transaction.profileId))?.userId || 0,
      action: 'create',
      entityType: 'transaction',
      entityId: newTx.id,
      details: `Created transaction: ${newTx.type} of ${newTx.amount}`
    });

    return newTx;
  }

  async getTransactionById(id: number): Promise<Transaction | undefined> {
    const [tx] = await db.select().from(transactions).where(eq(transactions.id, id));
    return tx;
  }

  async updateTransaction(id: number, updates: any): Promise<Transaction> {
    const [updated] = await db.update(transactions).set(updates).where(eq(transactions.id, id)).returning();
    return updated;
  }

  async deleteTransaction(id: number): Promise<void> {
    const [tx] = await db.select().from(transactions).where(eq(transactions.id, id));
    if (tx) {
      const profile = await this.getProfile(tx.profileId);
      await db.delete(transactions).where(eq(transactions.id, id));
      
      if (profile) {
        await this.createAuditLog({
          userId: profile.userId,
          action: 'delete',
          entityType: 'transaction',
          entityId: id,
          details: `Deleted transaction of amount ${tx.amount}`
        });
      }
    }
  }

  // Budgets
  async getBudget(profileId: number, month: number, year: number): Promise<Budget | undefined> {
    const [budget] = await db.select().from(budgets).where(
      and(
        eq(budgets.profileId, profileId),
        eq(budgets.month, month),
        eq(budgets.year, year)
      )
    );
    return budget;
  }

  async upsertBudget(budget: InsertBudget): Promise<Budget> {
    // Check existing
    const existing = await this.getBudget(budget.profileId, budget.month, budget.year);
    
    if (existing) {
      const [updated] = await db.update(budgets)
        .set({ amount: budget.amount })
        .where(eq(budgets.id, existing.id))
        .returning();
      return updated;
    } else {
      const [newBudget] = await db.insert(budgets).values(budget).returning();
      return newBudget;
    }
  }

  // Analytics
  async getTransactionSummary(profileId: number, month: number, year: number): Promise<TransactionSummary> {
    const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999); // End of month

    const txs = await db.select({
      amount: transactions.amount,
      type: transactions.type
    }).from(transactions).where(
      and(
        eq(transactions.profileId, profileId),
        sql`${transactions.date} >= ${startDate.toISOString()}`,
        sql`${transactions.date} <= ${endDate.toISOString()}`
      )
    );

    let income = 0;
    let expenses = 0;

    txs.forEach(t => {
      const amt = Math.abs(Number(t.amount));
      if (t.type === 'income') income += amt;
      else expenses += amt;
    });

    return {
      income,
      expenses,
      balance: income - expenses
    };
  }

  async getCategoryAnalysis(profileId: number, month: number, year: number): Promise<any[]> {
    const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const result = await db
      .select({
        name: categories.name,
        value: sql<number>`abs(sum(${transactions.amount}))`.mapWith(Number),
        color: categories.color,
        type: sql<string>`'expense'`.as('type'),
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          eq(transactions.profileId, profileId),
          eq(transactions.type, 'expense'),
          sql`${transactions.date} >= ${startDate.toISOString()}`,
          sql`${transactions.date} <= ${endDate.toISOString()}`
        )
      )
      .groupBy(categories.name, categories.color);
      
    return result;
  }

  async getIncomeCategoryAnalysis(profileId: number, month: number, year: number): Promise<any[]> {
    const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const result = await db
      .select({
        name: categories.name,
        value: sql<number>`abs(sum(${transactions.amount}))`.mapWith(Number),
        color: categories.color,
        type: sql<string>`'income'`.as('type'),
      })
      .from(transactions)
      .innerJoin(categories, eq(transactions.categoryId, categories.id))
      .where(
        and(
          eq(transactions.profileId, profileId),
          eq(transactions.type, 'income'),
          sql`${transactions.date} >= ${startDate.toISOString()}`,
          sql`${transactions.date} <= ${endDate.toISOString()}`
        )
      )
      .groupBy(categories.name, categories.color);
      
    return result;
  }

  async getDebtAnalysis(profileId: number, month: number, year: number): Promise<any[]> {
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const allDebts = await db.select().from(debts)
      .where(eq(debts.profileId, profileId))
      .orderBy(asc(debts.date));

    const result = allDebts.filter((d: any) => {
      const dt = new Date(d.date);
      const dMonth = dt.getUTCMonth() + 1;
      const dYear = dt.getUTCFullYear();
      const withinRange = dt >= startDate && dt <= endDate;
      return withinRange || (dMonth === month && dYear === year);
    });

    const grouped = new Map<string, { name: string; total: number; outstanding: number }>();
    for (const debt of result as any[]) {
      const name = debt.contactName || "Unknown";
      const total = Math.abs(Number(debt.amount) || 0);
      const settled = Math.max(0, Number(debt.settledAmount || 0));
      const remaining = debt.status === 'settled' ? 0 : Math.max(0, total - settled);
      const current = grouped.get(name) || { name, total: 0, outstanding: 0 };
      current.total += total;
      current.outstanding += remaining;
      grouped.set(name, current);
    }

    return Array.from(grouped.values());
  }

  async getSplitBillAnalysis(profileId: number, month: number, year: number): Promise<any[]> {
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const allSplits = await db.query.billSplits.findMany({
      where: eq(billSplits.profileId, profileId),
      with: { participants: true },
      orderBy: [asc(billSplits.date)],
    });

    const splits = allSplits.filter((s: any) => {
      const dt = new Date(s.date);
      const dMonth = dt.getUTCMonth() + 1;
      const dYear = dt.getUTCFullYear();
      const withinRange = dt >= startDate && dt <= endDate;
      return withinRange || (dMonth === month && dYear === year);
    });

    return splits.map(split => {
      const outstanding = split.participants.reduce((acc: number, p: any) => {
        if (!p.isSettled) return acc + Math.max(0, Number(p.amount) - Number(p.settledAmount || 0));
        return acc;
      }, 0);
      return {
        description: split.description,
        total: Number(split.totalAmount),
        outstanding: Math.round(outstanding * 100) / 100,
        participantCount: split.participants.length,
      };
    });
  }
  
  async getOutstandingObligations(profileId: number, asOf?: Date): Promise<any> {
    const referenceTime = asOf ?? new Date();

    const allDebts = await db.select().from(debts)
      .where(eq(debts.profileId, profileId))
      .orderBy(asc(debts.date));

    const allSplits = await db.query.billSplits.findMany({
      where: eq(billSplits.profileId, profileId),
      with: { participants: true },
      orderBy: [asc(billSplits.date)],
    });

    const pendingDebts: any[] = [];
    let totalReceivable = 0;
    let totalPayable = 0;

    for (const d of allDebts as any[]) {
      // Exclude auto-generated split-linked debt entries (same as Dashboard)
      if (d.note && String(d.note).startsWith('Split:')) continue;
      const balance = calculateDebtBalanceAt(d, referenceTime);
      if (!balance.relevant || balance.outstanding <= 0) continue;

      if (d.type === 'gave') totalReceivable += balance.outstanding;
      else totalPayable += balance.outstanding;

      pendingDebts.push({
        id: d.id,
        source: 'debt',
        type: d.type,
        contactName: d.contactName || 'Unknown',
        amount: balance.outstanding,
        originalDate: d.date,
        daysPending: balance.daysPending,
        status: d.status || 'pending',
        note: d.note || '',
      });
    }

    const pendingSplits: any[] = [];
    let totalPendingSplits = 0;

    for (const split of allSplits as any[]) {
      for (const p of split.participants as any[]) {
        const balance = calculateSplitShareAt({ ...p, date: split.date }, referenceTime);
        if (!balance.relevant || balance.outstanding <= 0) continue;

        totalPendingSplits += balance.outstanding;
        pendingSplits.push({
          id: p.id,
          source: 'split',
          billSplitId: split.id,
          description: split.description,
          contactName: p.contactName || 'Unknown',
          amount: balance.outstanding,
          originalDate: split.date,
          daysPending: balance.daysPending,
          status: 'pending',
        });
      }
    }

    const agingMap: Record<string, { label: string; debts: number; splits: number; total: number }> = {
      '0-30': { label: '0-30 days', debts: 0, splits: 0, total: 0 },
      '31-60': { label: '31-60 days', debts: 0, splits: 0, total: 0 },
      '61-90': { label: '61-90 days', debts: 0, splits: 0, total: 0 },
      '90+': { label: '90+ days', debts: 0, splits: 0, total: 0 },
    };

    for (const d of pendingDebts) {
      const b = obligationAgingBucket(d.daysPending);
      agingMap[b].debts += d.amount;
      agingMap[b].total += d.amount;
    }
    for (const s of pendingSplits) {
      const b = obligationAgingBucket(s.daysPending);
      agingMap[b].splits += s.amount;
      agingMap[b].total += s.amount;
    }

    const actionRequired = [
      ...pendingDebts.filter(d => d.daysPending > 30),
      ...pendingSplits.filter(s => s.daysPending > 30),
    ].sort((a, b) => b.daysPending - a.daysPending);

    return {
      summary: {
        totalReceivable: Math.round(totalReceivable * 100) / 100,
        totalPayable: Math.round(totalPayable * 100) / 100,
        totalPendingSplits: Math.round(totalPendingSplits * 100) / 100,
        // Udhari (Net) intentionally excludes split bills because split-linked
        // debt rows are excluded above and Dashboard treats splits separately.
        totalUdhariNet: Math.round((totalReceivable - totalPayable) * 100) / 100,
        totalOutstanding: Math.round((totalReceivable + totalPayable + totalPendingSplits) * 100) / 100,
      },
      pendingDebts,
      pendingSplits,
      aging: Object.values(agingMap),
      actionRequired,
    };
  }

  async getMonthlyTrend(profileId: number): Promise<MonthlyAnalysis[]> {
    // Get last 6 months
    const result: MonthlyAnalysis[] = [];
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const month = d.getMonth() + 1;
      const year = d.getFullYear();
      const summary = await this.getTransactionSummary(profileId, month, year);
      
      result.push({
        month: d.toLocaleString('default', { month: 'short' }),
        income: summary.income,
        expenses: summary.expenses
      });
    }
    
    return result;
  }

  async getYearlyTrend(profileId: number, years: number = 1): Promise<MonthlyAnalysis[]> {
    // Get last N years of data
    const result: MonthlyAnalysis[] = [];
    const today = new Date();
    
    for (let i = (years * 12 - 1); i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const month = d.getMonth() + 1;
      const year = d.getFullYear();
      const summary = await this.getTransactionSummary(profileId, month, year);
      
      result.push({
        month: d.toLocaleString('default', { month: 'short', year: 'numeric' }),
        income: summary.income,
        expenses: summary.expenses
      });
    }
    
    return result;
  }

  async getThreeYearTrend(profileId: number): Promise<MonthlyAnalysis[]> {
    return this.getYearlyTrend(profileId, 3);
  }

  async getFiveYearTrend(profileId: number): Promise<MonthlyAnalysis[]> {
    return this.getYearlyTrend(profileId, 5);
  }

  async getAllTimeTrend(profileId: number): Promise<MonthlyAnalysis[]> {
    // Get all data, starting from first transaction
    const firstTx = await db
      .select({ date: transactions.date })
      .from(transactions)
      .where(eq(transactions.profileId, profileId))
      .orderBy(asc(transactions.date))
      .limit(1);
    
    if (firstTx.length === 0) return [];
    
    const startDate = new Date(firstTx[0].date);
    const endDate = new Date();
    const result: MonthlyAnalysis[] = [];
    
    let current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    
    while (current <= endDate) {
      const month = current.getMonth() + 1;
      const year = current.getFullYear();
      const summary = await this.getTransactionSummary(profileId, month, year);
      
      result.push({
        month: current.toLocaleString('default', { month: 'short', year: 'numeric' }),
        income: summary.income,
        expenses: summary.expenses
      });
      
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }
    
    return result;
  }

  async getDailySpendingPattern(profileId: number, type: 'monthly' | 'yearly' | '3y' | '5y' | 'alltime' = 'monthly'): Promise<Array<{ date: string; amount: number }>> {
    const today = new Date();
    let startDate = new Date();
    
    switch (type) {
      case 'yearly':
        startDate = new Date(today.getFullYear() - 1, today.getMonth(), 1);
        break;
      case '3y':
        startDate = new Date(today.getFullYear() - 3, today.getMonth(), 1);
        break;
      case '5y':
        startDate = new Date(today.getFullYear() - 5, today.getMonth(), 1);
        break;
      case 'alltime':
        const firstTx = await db
          .select({ date: transactions.date })
          .from(transactions)
          .where(eq(transactions.profileId, profileId))
          .orderBy(asc(transactions.date))
          .limit(1);
        if (firstTx.length > 0) {
          startDate = new Date(firstTx[0].date.getFullYear(), firstTx[0].date.getMonth(), 1);
        }
        break;
      default: // 'monthly' - last 6 months
        startDate = new Date(today.getFullYear(), today.getMonth() - 6, 1);
    }

    const txs = await db.select({
      date: transactions.date,
      amount: transactions.amount,
      type: transactions.type
    }).from(transactions).where(
      and(
        eq(transactions.profileId, profileId),
        sql`${transactions.date} >= ${startDate.toISOString()}`,
        sql`${transactions.date} <= ${today.toISOString()}`
      )
    );

    // Choose aggregation granularity based on period
    const useMonthly = type === '3y' || type === '5y' || type === 'alltime';
    const useWeekly = type === 'yearly';

    const bucketMap = new Map<string, number>();

    txs.forEach(tx => {
      if (tx.type !== 'expense') return;
      const d = new Date(tx.date);
      let key: string;
      if (useMonthly) {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      } else if (useWeekly) {
        // ISO week key: year-Www
        const startOfYear = new Date(d.getFullYear(), 0, 1);
        const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
        key = `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
      } else {
        key = d.toLocaleDateString('en-CA');
      }
      bucketMap.set(key, (bucketMap.get(key) || 0) + Math.abs(Number(tx.amount)));
    });

    const result = Array.from(bucketMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, amount]) => {
        let label: string;
        const formatTrendMonth = (date: Date) =>
          date.toLocaleString('default', { month: 'short', year: 'numeric' });

        if (useMonthly) {
          const [y, m] = key.split('-');
          label = formatTrendMonth(new Date(Number(y), Number(m) - 1, 1));
        } else if (useWeekly) {
          const [y, w] = key.split('-W').map(Number);
          const weekDate = new Date(y, 0, 1);
          weekDate.setDate(1 + ((w - 1) * 7));
          label = formatTrendMonth(weekDate);
        } else {
          label = new Date(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        return { date: label, amount };
      });

    return result;
  }

  // Users (App Domain)
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getUserStats(): Promise<{
    totalUsers: number;
    totalProUsers: number;
    totalTransactions: number;
    totalDebts: number;
    totalSplitBills: number;
    totalExpenses: number;
    totalIncome: number;
  }> {
    const userCount = await db.select({ count: sql<number>`COUNT(*)` }).from(users);
    const proCount = await db.select({ count: sql<number>`COUNT(*)` }).from(users).where(eq(users.subscriptionStatus, 'paid'));
    const txCount = await db.select({ count: sql<number>`COUNT(*)` }).from(transactions);
    const debtCount = await db.select({ count: sql<number>`COUNT(*)` }).from(debts);
    const billCount = await db.select({ count: sql<number>`COUNT(*)` }).from(billSplits);
    const expenseSum = await db.select({ sum: sql<number>`COALESCE(SUM(CAST(${transactions.amount} as numeric)), 0)` }).from(transactions).where(eq(transactions.type, 'expense'));
    const incomeSum = await db.select({ sum: sql<number>`COALESCE(SUM(CAST(${transactions.amount} as numeric)), 0)` }).from(transactions).where(eq(transactions.type, 'income'));

    return {
      totalUsers: Number(userCount[0]?.count || 0),
      totalProUsers: Number(proCount[0]?.count || 0),
      totalTransactions: Number(txCount[0]?.count || 0),
      totalDebts: Number(debtCount[0]?.count || 0),
      totalSplitBills: Number(billCount[0]?.count || 0),
      totalExpenses: Number(expenseSum[0]?.sum || 0),
      totalIncome: Number(incomeSum[0]?.sum || 0),
    };
  }

  async getAllTransactions(): Promise<(Transaction & { category: Category | null; profile: Profile })[]> {
    return await db.query.transactions.findMany({
      with: { category: true, profile: true },
      orderBy: [desc(transactions.date)]
    });
  }

  async getAllDebts(): Promise<Debt[]> {
    return await db.select().from(debts).orderBy(desc(debts.date));
  }

  async getAllBillSplits(): Promise<any[]> {
    return await db.query.billSplits.findMany({
      with: { participants: true },
      orderBy: [desc(billSplits.date)]
    });
  }

  // Debts
  async getDebts(profileId: number): Promise<Debt[]> {
    return await db.select().from(debts).where(eq(debts.profileId, profileId)).orderBy(desc(debts.date));
  }

  async createDebt(debt: InsertDebt): Promise<Debt> {
    const [newDebt] = await db.insert(debts).values(debt).returning();
    
    // Create a transaction record as well for visibility in main ledger if desired
    // For "Udhari Khata", we'll keep it separate but visible.
    
    await this.createAuditLog({
      userId: (await this.getProfile(debt.profileId))?.userId || 0,
      action: 'create',
      entityType: 'debt',
      entityId: newDebt.id,
      details: `${debt.type === 'gave' ? 'Lent' : 'Borrowed'} ${debt.amount} to/from ${debt.contactName}`
    });
    
    return newDebt;
  }

  async updateDebt(id: number, updates: any): Promise<Debt> {
    const [updated] = await db.update(debts).set(updates).where(eq(debts.id, id)).returning();
    return updated;
  }

  async deleteDebt(id: number): Promise<void> {
    await db.delete(debts).where(eq(debts.id, id));
  }

  async updateBillSplitParticipant(id: number, updates: { settledAmount?: string; isSettled?: boolean }): Promise<any> {
    const [updated] = await db.update(billSplitParticipants).set(updates).where(eq(billSplitParticipants.id, id)).returning();
    return updated;
  }

  // Split Bills
  async getBillSplits(profileId: number): Promise<(BillSplit & { participants: BillSplitParticipant[] })[]> {
    return await db.query.billSplits.findMany({
      where: eq(billSplits.profileId, profileId),
      with: {
        participants: true
      },
      orderBy: [desc(billSplits.date)]
    });
  }

  async createBillSplit(split: InsertBillSplit, participants: InsertBillSplitParticipant[]): Promise<BillSplit> {
    const [newSplit] = await db.insert(billSplits).values(split).returning();
    if (participants.length > 0) {
      await db.insert(billSplitParticipants).values(
        participants.map(p => ({ ...p, billSplitId: newSplit.id }))
      );
    }
    return newSplit;
  }

  async deleteBillSplit(id: number): Promise<void> {
    await db.delete(billSplitParticipants).where(eq(billSplitParticipants.billSplitId, id));
    await db.delete(billSplits).where(eq(billSplits.id, id));
  }

  // === WEALTH / NET WORTH (Snapshot-Centric) ===

  /** List all snapshots for a profile (header only, no rows). */
  async getWealthSnapshots(profileId: number): Promise<WealthSnapshot[]> {
    return await db.select().from(wealthSnapshots)
      .where(eq(wealthSnapshots.profileId, profileId))
      .orderBy(desc(wealthSnapshots.snapshotDate));
  }

  /** Get a single snapshot with all child rows. */
  async getWealthSnapshot(id: number): Promise<WealthSnapshotWithRows | null> {
    const snap = await db.query.wealthSnapshots.findFirst({
      where: eq(wealthSnapshots.id, id),
      with: {
        immovableRows: true,
        movableRows: true,
        otherRows: true,
      },
    });
    return snap ?? null;
  }

  /** Get the most recent snapshot with all child rows (for prefill). */
  async getLatestWealthSnapshot(profileId: number): Promise<WealthSnapshotWithRows | null> {
    const [latest] = await db.select({ id: wealthSnapshots.id })
      .from(wealthSnapshots)
      .where(eq(wealthSnapshots.profileId, profileId))
      .orderBy(desc(wealthSnapshots.snapshotDate))
      .limit(1);
    if (!latest) return null;
    return this.getWealthSnapshot(latest.id);
  }

  /** Create a snapshot header + all child rows in a DB transaction. */
  async createWealthSnapshot(data: {
    profileId: number;
    label?: string;
    snapshotDate: Date;
    frequency?: string;
    notes?: string | null;
    immovableRows: Omit<InsertWealthImmovableRow, 'snapshotId'>[];
    movableRows: Omit<InsertWealthMovableRow, 'snapshotId'>[];
    otherRows: Omit<InsertWealthOtherRow, 'snapshotId'>[];
  }): Promise<WealthSnapshotWithRows> {
    const { immovableRows: immRows, movableRows: movRows, otherRows: othRows, ...header } = data;
    const snapshotHeader = {
      ...header,
      snapshotDate: normalizeWealthDate(header.snapshotDate) ?? new Date(),
    };
    const normalizedImmRows = immRows.map(r => ({
      ...r,
      acquisitionDate: normalizeWealthDate(r.acquisitionDate),
    }));
    const normalizedMovRows = movRows.map(r => ({
      ...r,
      acquisitionDate: normalizeWealthDate(r.acquisitionDate),
    }));
    const normalizedOthRows = othRows.map(r => ({
      ...r,
      acquisitionDate: normalizeWealthDate(r.acquisitionDate),
    }));

    const totalImmovable = normalizedImmRows.reduce((s, r) => s + Number(r.currentValue || 0), 0);
    const totalMovable = normalizedMovRows.reduce((s, r) => s + Number(r.currentValue || 0), 0);
    const totalOtherMovable = normalizedOthRows.reduce((s, r) => s + Number(r.currentValue || 0), 0);
    const totalLiabilities =
      normalizedImmRows.reduce((s, r) => s + Number(r.loanOutstanding || 0), 0) +
      normalizedMovRows.reduce((s, r) => s + Number(r.loanOutstanding || 0), 0);
    // Net worth = sum of all asset values (liabilities tracked separately)
    const netWorth = totalImmovable + totalMovable + totalOtherMovable;

    return await db.transaction(async (tx) => {
      const [snap] = await tx.insert(wealthSnapshots).values({
        ...snapshotHeader,
        totalImmovable: totalImmovable.toString(),
        totalMovable: totalMovable.toString(),
        totalOtherMovable: totalOtherMovable.toString(),
        totalLiabilities: totalLiabilities.toString(),
        netWorth: netWorth.toString(),
      }).returning();

      const insertedImm = immRows.length > 0
        ? await tx.insert(wealthImmovableRows).values(normalizedImmRows.map(r => ({ ...r, snapshotId: snap.id }))).returning()
        : [];
      const insertedMov = movRows.length > 0
        ? await tx.insert(wealthMovableRows).values(normalizedMovRows.map(r => ({ ...r, snapshotId: snap.id }))).returning()
        : [];
      const insertedOth = othRows.length > 0
        ? await tx.insert(wealthOtherRows).values(normalizedOthRows.map(r => ({ ...r, snapshotId: snap.id }))).returning()
        : [];

      return { ...snap, immovableRows: insertedImm, movableRows: insertedMov, otherRows: insertedOth };
    });
  }

  /** Update a snapshot: replace all rows and recompute totals (transactional). */
  async updateWealthSnapshot(id: number, data: {
    label?: string;
    snapshotDate?: Date;
    frequency?: string;
    notes?: string | null;
    immovableRows?: Omit<InsertWealthImmovableRow, 'snapshotId'>[];
    movableRows?: Omit<InsertWealthMovableRow, 'snapshotId'>[];
    otherRows?: Omit<InsertWealthOtherRow, 'snapshotId'>[];
  }): Promise<WealthSnapshotWithRows> {
    const { immovableRows: immRows, movableRows: movRows, otherRows: othRows, ...headerUpdates } = data;
    const normalizedHeaderUpdates = {
      ...headerUpdates,
      ...(headerUpdates.snapshotDate !== undefined && {
        snapshotDate: normalizeWealthDate(headerUpdates.snapshotDate) ?? new Date(),
      }),
    };
    const normalizedImmRows = immRows?.map(r => ({
      ...r,
      acquisitionDate: normalizeWealthDate(r.acquisitionDate),
    }));
    const normalizedMovRows = movRows?.map(r => ({
      ...r,
      acquisitionDate: normalizeWealthDate(r.acquisitionDate),
    }));
    const normalizedOthRows = othRows?.map(r => ({
      ...r,
      acquisitionDate: normalizeWealthDate(r.acquisitionDate),
    }));

    return await db.transaction(async (tx) => {
      // Replace rows if provided
      let currentImmRows: WealthImmovableRow[];
      let currentMovRows: WealthMovableRow[];
      let currentOthRows: WealthOtherRow[];

      if (normalizedImmRows !== undefined) {
        await tx.delete(wealthImmovableRows).where(eq(wealthImmovableRows.snapshotId, id));
        currentImmRows = normalizedImmRows.length > 0
          ? await tx.insert(wealthImmovableRows).values(normalizedImmRows.map(r => ({ ...r, snapshotId: id }))).returning()
          : [];
      } else {
        currentImmRows = await tx.select().from(wealthImmovableRows).where(eq(wealthImmovableRows.snapshotId, id));
      }

      if (normalizedMovRows !== undefined) {
        await tx.delete(wealthMovableRows).where(eq(wealthMovableRows.snapshotId, id));
        currentMovRows = normalizedMovRows.length > 0
          ? await tx.insert(wealthMovableRows).values(normalizedMovRows.map(r => ({ ...r, snapshotId: id }))).returning()
          : [];
      } else {
        currentMovRows = await tx.select().from(wealthMovableRows).where(eq(wealthMovableRows.snapshotId, id));
      }

      if (normalizedOthRows !== undefined) {
        await tx.delete(wealthOtherRows).where(eq(wealthOtherRows.snapshotId, id));
        currentOthRows = normalizedOthRows.length > 0
          ? await tx.insert(wealthOtherRows).values(normalizedOthRows.map(r => ({ ...r, snapshotId: id }))).returning()
          : [];
      } else {
        currentOthRows = await tx.select().from(wealthOtherRows).where(eq(wealthOtherRows.snapshotId, id));
      }

      // Recompute totals from current rows
      const totalImmovable = currentImmRows.reduce((s, r) => s + Number(r.currentValue || 0), 0);
      const totalMovable = currentMovRows.reduce((s, r) => s + Number(r.currentValue || 0), 0);
      const totalOtherMovable = currentOthRows.reduce((s, r) => s + Number(r.currentValue || 0), 0);
      const totalLiabilities =
        currentImmRows.reduce((s, r) => s + Number(r.loanOutstanding || 0), 0) +
        currentMovRows.reduce((s, r) => s + Number(r.loanOutstanding || 0), 0);
      // Net worth = sum of all asset values (liabilities tracked separately)
      const netWorth = totalImmovable + totalMovable + totalOtherMovable;

      const [updated] = await tx.update(wealthSnapshots).set({
        ...normalizedHeaderUpdates,
        totalImmovable: totalImmovable.toString(),
        totalMovable: totalMovable.toString(),
        totalOtherMovable: totalOtherMovable.toString(),
        totalLiabilities: totalLiabilities.toString(),
        netWorth: netWorth.toString(),
      }).where(eq(wealthSnapshots.id, id)).returning();

      return { ...updated, immovableRows: currentImmRows, movableRows: currentMovRows, otherRows: currentOthRows };
    });
  }

  /** Delete a snapshot and all its child rows. */
  async deleteWealthSnapshot(id: number): Promise<void> {
    await db.delete(wealthImmovableRows).where(eq(wealthImmovableRows.snapshotId, id));
    await db.delete(wealthMovableRows).where(eq(wealthMovableRows.snapshotId, id));
    await db.delete(wealthOtherRows).where(eq(wealthOtherRows.snapshotId, id));
    await db.delete(wealthSnapshots).where(eq(wealthSnapshots.id, id));
  }

  /** Wealth analytics: trend over time from all snapshots, plus smart insight metrics. */
  async getWealthAnalytics(profileId: number): Promise<{
    trend: Array<{ label: string; snapshotDate: string; netWorth: number; totalImmovable: number; totalMovable: number; totalOtherMovable: number; totalLiabilities: number; }>;
    latest: WealthSnapshotWithRows | null;
    insights: {
      netWorthGrowthPct: number | null;
      annualGrowthPct: number | null;
      largestAsset: { name: string; value: number; category: string } | null;
      financialAssetGrowthPct: number | null;
    };
  }> {
    const snaps = await db.select().from(wealthSnapshots)
      .where(eq(wealthSnapshots.profileId, profileId))
      .orderBy(asc(wealthSnapshots.snapshotDate));

    const trend = snaps.map(s => ({
      label: s.label || format(new Date(s.snapshotDate), "MMM yy"),
      snapshotDate: s.snapshotDate.toISOString(),
      netWorth: Number(s.netWorth),
      totalImmovable: Number(s.totalImmovable),
      totalMovable: Number(s.totalMovable),
      totalOtherMovable: Number(s.totalOtherMovable),
      totalLiabilities: Number(s.totalLiabilities),
    }));

    const latest = await this.getLatestWealthSnapshot(profileId);

    // Compute insights
    let netWorthGrowthPct: number | null = null;
    let annualGrowthPct: number | null = null;
    let financialAssetGrowthPct: number | null = null;

    if (trend.length >= 2) {
      const prev = trend[trend.length - 2];
      const curr = trend[trend.length - 1];
      if (prev.netWorth > 0) netWorthGrowthPct = ((curr.netWorth - prev.netWorth) / prev.netWorth) * 100;
      if (prev.totalOtherMovable > 0) financialAssetGrowthPct = ((curr.totalOtherMovable - prev.totalOtherMovable) / prev.totalOtherMovable) * 100;
    }

    if (trend.length >= 2) {
      const first = trend[0];
      const last = trend[trend.length - 1];
      const daysDiff = (new Date(last.snapshotDate).getTime() - new Date(first.snapshotDate).getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 0 && first.netWorth > 0) {
        annualGrowthPct = ((last.netWorth - first.netWorth) / first.netWorth) * (365 / daysDiff) * 100;
      }
    }

    // Find largest single asset from latest snapshot
    let largestAsset: { name: string; value: number; category: string } | null = null;
    if (latest) {
      const allAssets = [
        ...latest.immovableRows.map(r => ({ name: r.name, value: Number(r.currentValue), category: "Real Estate" })),
        ...latest.movableRows.map(r => ({ name: r.name, value: Number(r.currentValue), category: "Movable" })),
        ...latest.otherRows.map(r => ({ name: r.name, value: Number(r.currentValue), category: "Investments" })),
      ];
      if (allAssets.length > 0) {
        largestAsset = allAssets.reduce((max, a) => a.value > max.value ? a : max, allAssets[0]);
      }
    }

    return { trend, latest, insights: { netWorthGrowthPct, annualGrowthPct, largestAsset, financialAssetGrowthPct } };
  }
}

export const storage = new DatabaseStorage();

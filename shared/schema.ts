import { sql, relations } from "drizzle-orm";
import { pgTable, text, serial, integer, boolean, timestamp, numeric, varchar, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === AUTH TABLES ===
// sessions: used by connect-pg-simple for session storage (do not drop)
// authUsers: legacy table from Replit Auth (no longer used, kept for DB compatibility)

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

export const authUsers = pgTable("auth_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === APP TABLES ===

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(), // This will store email or phone
  password: text("password"), // Added for custom auth
  displayName: text("display_name"),
  email: text("email"),
  resetToken: text("reset_token"),
  resetExpires: timestamp("reset_expires"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  adminRole: text("admin_role").default("user").notNull(), // 'user' | 'super_admin' | 'admin' | 'support' | 'analyst'
  subscriptionStatus: text("subscription_status").default("free").notNull(), // 'free' | 'paid'
  accountStatus: text("account_status").default("active").notNull(), // 'active' | 'inactive' | 'suspended'
  lastLogin: timestamp("last_login"),
  activeProfileId: integer("active_profile_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_users_account_status_created_at").on(table.accountStatus, table.createdAt),
  index("IDX_users_last_login").on(table.lastLogin),
]);

export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  name: text("name").notNull(), // 'Personal', 'Family', 'Business'
  type: text("type").notNull(), // 'personal', 'family', 'business'
  currency: text("currency").default("INR").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("IDX_profiles_user_id").on(table.userId)]);

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => profiles.id),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'income' | 'expense'
  icon: text("icon"), // Lucide icon name
  isDefault: boolean("is_default").default(false),
  color: text("color"), // Hex code or tailwind class
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => profiles.id),
  categoryId: integer("category_id").references(() => categories.id),
  amount: numeric("amount").notNull(),
  date: timestamp("date").notNull(),
  note: text("note"),
  type: text("type").notNull(), // 'income' | 'expense'
  isRecurring: boolean("is_recurring").default(false),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("IDX_transactions_profile_date").on(table.profileId, table.date)]);

export const budgets = pgTable("budgets", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => profiles.id),
  month: integer("month").notNull(), // 1-12
  year: integer("year").notNull(),
  amount: numeric("amount").notNull(), // Monthly limit
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("IDX_budgets_profile_period").on(table.profileId, table.year, table.month)]);

// === RELATIONS ===

export const debts = pgTable("debts", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => profiles.id),
  type: text("type").notNull(), // 'gave' | 'got'
  contactName: text("contact_name").notNull(),
  contactPhone: text("contact_phone"),
  amount: numeric("amount").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  note: text("note"),
  status: text("status").default("pending").notNull(), // 'pending' | 'partial' | 'settled'
  settledAmount: numeric("settled_amount").default("0").notNull(),
  settledAt: timestamp("settled_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("IDX_debts_profile_date").on(table.profileId, table.date)]);

export const debtsRelations = relations(debts, ({ one }) => ({
  profile: one(profiles, {
    fields: [debts.profileId],
    references: [profiles.id],
  }),
}));

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
  categories: many(categories),
  transactions: many(transactions),
  budgets: many(budgets),
  debts: many(debts),
  wealthSnapshots: many(wealthSnapshots),
}));

export const usersRelations = relations(users, ({ many }) => ({
  profiles: many(profiles),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [categories.profileId],
    references: [profiles.id],
  }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  profile: one(profiles, {
    fields: [transactions.profileId],
    references: [profiles.id],
  }),
  category: one(categories, {
    fields: [transactions.categoryId],
    references: [categories.id],
  }),
}));

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  action: text("action").notNull(), // 'create', 'update', 'delete', 'export'
  entityType: text("entity_type").notNull(), // 'transaction', 'profile', 'category'
  entityId: integer("entity_id"),
  details: text("details"),
  success: boolean("success").default(true).notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("IDX_audit_logs_created_at").on(table.createdAt),
  index("IDX_audit_logs_actor_created_at").on(table.userId, table.createdAt),
  index("IDX_audit_logs_target_created_at").on(table.entityType, table.entityId, table.createdAt),
  index("IDX_audit_logs_action_created_at").on(table.action, table.createdAt),
]);

export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description").notNull().default(""),
  discountType: text("discount_type").notNull(), // 'percentage' | 'fixed_amount'
  discountValue: numeric("discount_value").notNull(),
  startsAt: timestamp("starts_at").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  maxRedemptions: integer("max_redemptions"),
  currentRedemptions: integer("current_redemptions").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: integer("created_by").notNull().references(() => users.id),
  updatedBy: integer("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("IDX_coupons_active_dates").on(table.isActive, table.startsAt, table.expiresAt),
  index("IDX_coupons_created_at").on(table.createdAt),
]);

export const adminSettings = pgTable("admin_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: integer("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = typeof coupons.$inferInsert;
export type AdminSetting = typeof adminSettings.$inferSelect;

export const categoryRules = pgTable("category_rules", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => profiles.id),
  keyword: text("keyword").notNull(),
  categoryId: integer("category_id").notNull().references(() => categories.id),
});

export const categoryRulesRelations = relations(categoryRules, ({ one }) => ({
  profile: one(profiles, {
    fields: [categoryRules.profileId],
    references: [profiles.id],
  }),
  category: one(categories, {
    fields: [categoryRules.categoryId],
    references: [categories.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });
export const insertCategoryRuleSchema = createInsertSchema(categoryRules).omit({ id: true });

export type AuditLog = typeof auditLogs.$inferSelect;
export type CategoryRule = typeof categoryRules.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type InsertCategoryRule = z.infer<typeof insertCategoryRuleSchema>;

export const billSplits = pgTable("bill_splits", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => profiles.id),
  totalAmount: numeric("total_amount").notNull(),
  description: text("description").notNull(),
  date: timestamp("date").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("IDX_bill_splits_profile_date").on(table.profileId, table.date)]);

export const billSplitParticipants = pgTable("bill_split_participants", {
  id: serial("id").primaryKey(),
  billSplitId: integer("bill_split_id").notNull().references(() => billSplits.id),
  contactName: text("contact_name").notNull(),
  contactPhone: text("contact_phone"),
  amount: numeric("amount").notNull(),
  settledAmount: numeric("settled_amount").default("0").notNull(),
  isSettled: boolean("is_settled").default(false).notNull(),
}, (table) => [index("IDX_bill_split_participants_split_id").on(table.billSplitId)]);

export const billSplitsRelations = relations(billSplits, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [billSplits.profileId],
    references: [profiles.id],
  }),
  participants: many(billSplitParticipants),
}));

export const billSplitParticipantsRelations = relations(billSplitParticipants, ({ one }) => ({
  billSplit: one(billSplits, {
    fields: [billSplitParticipants.billSplitId],
    references: [billSplits.id],
  }),
}));

export const insertBillSplitSchema = createInsertSchema(billSplits).omit({ id: true, createdAt: true });
export const insertBillSplitParticipantSchema = createInsertSchema(billSplitParticipants).omit({ id: true });

export type BillSplit = typeof billSplits.$inferSelect;
export type BillSplitParticipant = typeof billSplitParticipants.$inferSelect;
export type InsertBillSplit = z.infer<typeof insertBillSplitSchema>;
export type InsertBillSplitParticipant = z.infer<typeof insertBillSplitParticipantSchema>;

// === WEALTH / NET WORTH TABLES (Snapshot-Centric Model) ===
// Each wealthSnapshot is a full point-in-time statement.
// Child rows (immovable/movable/other) are scoped to snapshotId, not profileId.

export const wealthSnapshots = pgTable("wealth_snapshots", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => profiles.id),
  label: text("label").notNull().default(""),
  snapshotDate: timestamp("snapshot_date").notNull().defaultNow(),
  frequency: text("frequency").notNull().default("manual"), // 'monthly','quarterly','yearly','manual'
  totalImmovable: numeric("total_immovable").default("0").notNull(),
  totalMovable: numeric("total_movable").default("0").notNull(),
  totalOtherMovable: numeric("total_other_movable").default("0").notNull(),
  totalLiabilities: numeric("total_liabilities").default("0").notNull(),
  netWorth: numeric("net_worth").default("0").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [index("IDX_wealth_snapshots_profile_date").on(table.profileId, table.snapshotDate)]);

// Immovable property rows per snapshot
export const wealthImmovableRows = pgTable("wealth_immovable_rows", {
  id: serial("id").primaryKey(),
  snapshotId: integer("snapshot_id").notNull().references(() => wealthSnapshots.id),
  name: text("name").notNull(),                            // description of property
  type: text("type").notNull().default("land"),            // 'land','house','mortgage','other'
  location: text("location"),
  area: text("area"),                                      // e.g. "1200 sq ft" or "5 acres"
  natureOfLand: text("nature_of_land"),                    // e.g. "Agricultural", "Residential"
  extentOfInterest: text("extent_of_interest"),            // e.g. "Full owner", "50% share"
  mannerOfAcquisition: text("manner_of_acquisition"),      // e.g. "Purchased", "Inherited", "Gift"
  inWhoseName: text("in_whose_name"),                      // owner name
  acquisitionDate: timestamp("acquisition_date"),
  purchaseValue: numeric("purchase_value").default("0").notNull(),
  currentValue: numeric("current_value").default("0").notNull(),
  loanOutstanding: numeric("loan_outstanding").default("0").notNull(),
  monthlyRentalIncome: numeric("monthly_rental_income").default("0").notNull(),
  remarks: text("remarks"),
});

// Movable property rows per snapshot (physical assets: vehicles, jewellery, furniture)
export const wealthMovableRows = pgTable("wealth_movable_rows", {
  id: serial("id").primaryKey(),
  snapshotId: integer("snapshot_id").notNull().references(() => wealthSnapshots.id),
  name: text("name").notNull(),
  type: text("type").notNull().default("four_wheeler"),    // 'four_wheeler','two_wheeler','jewellery','furniture','other'
  description: text("description"),
  extentOfInterest: text("extent_of_interest"),
  mannerOfAcquisition: text("manner_of_acquisition"),
  inWhoseName: text("in_whose_name"),
  acquisitionDate: timestamp("acquisition_date"),
  purchaseValue: numeric("purchase_value").default("0").notNull(),
  currentValue: numeric("current_value").default("0").notNull(),
  loanOutstanding: numeric("loan_outstanding").default("0").notNull(),
  remarks: text("remarks"),
});

// Other movable assets (financial assets) per snapshot
export const wealthOtherRows = pgTable("wealth_other_rows", {
  id: serial("id").primaryKey(),
  snapshotId: integer("snapshot_id").notNull().references(() => wealthSnapshots.id),
  name: text("name").notNull(),
  type: text("type").notNull().default("mutual_funds"),    // 'cash','bank','insurance','shares','mutual_funds','nps','ssy','ppf','epf','bonds','other'
  inWhoseName: text("in_whose_name"),
  acquisitionDate: timestamp("acquisition_date"),
  mannerOfAcquisition: text("manner_of_acquisition"),
  investedAmount: numeric("invested_amount").default("0").notNull(),
  currentValue: numeric("current_value").default("0").notNull(),
  remarks: text("remarks"),
});

export const wealthSnapshotsRelations = relations(wealthSnapshots, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [wealthSnapshots.profileId],
    references: [profiles.id],
  }),
  immovableRows: many(wealthImmovableRows),
  movableRows: many(wealthMovableRows),
  otherRows: many(wealthOtherRows),
}));

export const wealthImmovableRowsRelations = relations(wealthImmovableRows, ({ one }) => ({
  snapshot: one(wealthSnapshots, {
    fields: [wealthImmovableRows.snapshotId],
    references: [wealthSnapshots.id],
  }),
}));

export const wealthMovableRowsRelations = relations(wealthMovableRows, ({ one }) => ({
  snapshot: one(wealthSnapshots, {
    fields: [wealthMovableRows.snapshotId],
    references: [wealthSnapshots.id],
  }),
}));

export const wealthOtherRowsRelations = relations(wealthOtherRows, ({ one }) => ({
  snapshot: one(wealthSnapshots, {
    fields: [wealthOtherRows.snapshotId],
    references: [wealthSnapshots.id],
  }),
}));

export const insertWealthSnapshotSchema = createInsertSchema(wealthSnapshots).omit({ id: true, createdAt: true });
export const insertWealthImmovableRowSchema = createInsertSchema(wealthImmovableRows).omit({ id: true });
export const insertWealthMovableRowSchema = createInsertSchema(wealthMovableRows).omit({ id: true });
export const insertWealthOtherRowSchema = createInsertSchema(wealthOtherRows).omit({ id: true });

export type WealthSnapshot = typeof wealthSnapshots.$inferSelect;
export type WealthImmovableRow = typeof wealthImmovableRows.$inferSelect;
export type WealthMovableRow = typeof wealthMovableRows.$inferSelect;
export type WealthOtherRow = typeof wealthOtherRows.$inferSelect;

export type InsertWealthSnapshot = z.infer<typeof insertWealthSnapshotSchema>;
export type InsertWealthImmovableRow = z.infer<typeof insertWealthImmovableRowSchema>;
export type InsertWealthMovableRow = z.infer<typeof insertWealthMovableRowSchema>;
export type InsertWealthOtherRow = z.infer<typeof insertWealthOtherRowSchema>;

export type WealthSnapshotWithRows = WealthSnapshot & {
  immovableRows: WealthImmovableRow[];
  movableRows: WealthMovableRow[];
  otherRows: WealthOtherRow[];
};

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertProfileSchema = createInsertSchema(profiles).omit({ id: true, createdAt: true });
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true, createdAt: true });
export const insertBudgetSchema = createInsertSchema(budgets).omit({ id: true, createdAt: true });
export const insertDebtSchema = createInsertSchema(debts).omit({ id: true, createdAt: true });

// === EXPLICIT API CONTRACT TYPES ===

// Base types
export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
export type Debt = typeof debts.$inferSelect;

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type InsertBudget = z.infer<typeof insertBudgetSchema>;
export type InsertDebt = z.infer<typeof insertDebtSchema>;

// Request types
export type CreateProfileRequest = InsertProfile;
export type UpdateProfileRequest = Partial<InsertProfile>;

export type CreateCategoryRequest = InsertCategory;
export type UpdateCategoryRequest = Partial<InsertCategory>;

export type CreateTransactionRequest = InsertTransaction;
export type UpdateTransactionRequest = Partial<InsertTransaction>;

export type CreateBudgetRequest = InsertBudget;
export type UpdateBudgetRequest = Partial<InsertBudget>;

export type CreateDebtRequest = InsertDebt;
export type UpdateDebtRequest = Partial<InsertDebt>;

// Response types
export type AuthUser = User & { profiles: Profile[] };

export interface TransactionSummary {
  income: number;
  expenses: number;
  balance: number;
}

export interface CategorySummary {
  categoryId: number;
  categoryName: string;
  total: number;
  color?: string;
}

export interface MonthlyAnalysis {
  month: string;
  income: number;
  expenses: number;
}

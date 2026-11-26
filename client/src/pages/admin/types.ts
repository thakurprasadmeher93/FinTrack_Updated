export type AdminOverviewData = {
  generatedAt: string;
  metrics: {
    users: {
      total: number;
      active: number;
      inactive: number;
      suspended: number;
      newToday: number;
      newThisWeek: number;
      newThisMonth: number;
      free: number;
      paid: number;
      dau: number;
      wau: number;
      mau: number;
      usersLast30Days: number;
      usersPrevious30Days: number;
      userGrowthPercent: number | null;
    };
    platform: {
      transactions: number;
      income: number;
      expenses: number;
      averageTransactionAmount: number;
      transactionsLast30Days: number;
      transactionsPrevious30Days: number;
      transactionGrowthPercent: number | null;
      budgets: number;
      activeBudgets: number;
      activeBudgetTotal: number;
      activeBudgetSpent: number;
      activeBudgetUsagePercent: number | null;
      profiles: number;
      wealthSnapshots: number;
      latestWealthProfiles: number;
      latestWealthAssets: number;
      latestWealthLiabilities: number;
    };
    udhari: {
      totalAmount: number;
      totalRecords: number;
      pendingRecords: number;
      settledRecords: number;
      settledAmount: number;
      outstandingReceivables: number;
      outstandingPayables: number;
      totalOutstanding: number;
      aging: { range: string; debts: number; splits: number; total: number }[];
    };
    splitBills: {
      total: number;
      active: number;
      settled: number;
      settledAmount: number;
      pendingSettlements: number;
      pendingAmount: number;
    };
  };
  charts: {
    dailyUserGrowth: { date: string; label: string; users: number }[];
    monthlyUserGrowth: { month: string; label: string; users: number }[];
    dailyTransactions: {
      date: string;
      label: string;
      transactions: number;
      income: number;
      expenses: number;
    }[];
    monthlyTransactions: {
      month: string;
      label: string;
      transactions: number;
      income: number;
      expenses: number;
    }[];
    subscriptionDistribution: { name: string; value: number }[];
  };
  activity: {
    recentRegistrations: {
      id: number;
      name: string | null;
      email: string;
      createdAt: string | null;
    }[];
    recentLogins: {
      id: number;
      name: string | null;
      email: string;
      lastLogin: string | null;
    }[];
    recentAdminActions: {
      id: number;
      action: string;
      entityType: string;
      entityId: number | null;
      details: string | null;
      createdAt: string | null;
      actorName: string | null;
      actorEmail: string;
    }[];
    recentPlatformActivity: {
      id: number;
      action: string;
      entityType: string;
      createdAt: string | null;
      actorName: string | null;
    }[];
  };
};

export type AdminUser = {
  id: number;
  username: string;
  displayName: string | null;
  email: string;
  accountStatus: "active" | "inactive" | "suspended";
  subscriptionStatus: "free" | "paid";
  isAdmin: boolean;
  adminRole: string;
  createdAt: string | null;
  lastLogin: string | null;
  transactionCount: number;
  profileCount: number;
};

export type AdminUserPage = {
  items: AdminUser[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AdminUserDetail = {
  user: Omit<AdminUser, "transactionCount" | "profileCount">;
  usage: {
    profiles: number;
    transactions: number;
    income: number;
    expenses: number;
    budgets: number;
    udhariRecords: number;
    udhariOutstanding: number;
    splitBills: number;
    pendingSplitSettlements: number;
    wealthSnapshots: number;
  };
  recentActivity: {
    id: number;
    action: string;
    entityType: string;
    entityId: number | null;
    actorId: number;
    actorName: string | null;
    actorEmail: string;
    details: string | null;
    success: boolean;
    createdAt: string | null;
  }[];
};

export type AdminAuditPage = {
  items: {
    id: number;
    actorId: number;
    actorName: string | null;
    actorEmail: string;
    action: string;
    entityType: string;
    entityId: number | null;
    details: string | null;
    success: boolean;
    metadata: Record<string, unknown>;
    targetName: string | null;
    targetEmail: string | null;
    createdAt: string | null;
  }[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  from: string;
  to: string;
  actor: string;
  action: string;
  target: string;
  targetUserId: number | null;
  result: "all" | "success" | "failure";
};

export type AdminCoupon = {
  id: number;
  code: string;
  description: string;
  discountType: "percentage" | "fixed_amount";
  discountValue: string;
  startsAt: string;
  expiresAt: string;
  maxRedemptions: number | null;
  currentRedemptions: number;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AdminCouponPage = {
  items: AdminCoupon[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type AdminPlatformSettings = {
  applicationName: string;
  supportEmail: string;
  registrationEnabled: boolean;
};

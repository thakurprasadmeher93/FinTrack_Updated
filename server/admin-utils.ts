export function normalizeAdminUserPageParams(params: {
  page?: unknown;
  pageSize?: unknown;
  search?: unknown;
  filter?: unknown;
  sortBy?: unknown;
  sortDir?: unknown;
}) {
  const allowedFilters = new Set(["all", "active", "inactive", "suspended", "free", "paid", "admin"]);
  const allowedSorts = new Set(["name", "email", "status", "subscription", "createdAt", "lastLogin"]);
  const parsedPage = Number(params.page);
  const parsedPageSize = Number(params.pageSize);
  return {
    page: Number.isSafeInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 1_000_000) : 1,
    pageSize: [25, 50, 100].includes(parsedPageSize) ? parsedPageSize : 25,
    search: String(params.search || "").trim().slice(0, 120),
    filter: allowedFilters.has(String(params.filter)) ? String(params.filter) : "all",
    sortBy: allowedSorts.has(String(params.sortBy)) ? String(params.sortBy) : "createdAt",
    sortDir: params.sortDir === "asc" ? "asc" as const : "desc" as const,
  };
}

export function toSafeAdminUser(user: Record<string, any>) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName ?? null,
    email: user.email,
    accountStatus: user.accountStatus,
    subscriptionStatus: user.subscriptionStatus,
    isAdmin: user.isAdmin,
    adminRole: user.adminRole || (user.isAdmin ? "admin" : "user"),
    createdAt: user.createdAt ?? null,
    lastLogin: user.lastLogin ?? null,
    ...(user.transactionCount === undefined ? {} : { transactionCount: user.transactionCount }),
    ...(user.profileCount === undefined ? {} : { profileCount: user.profileCount }),
  };
}

import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequireAdmin, adminAccountStatusUpdateSchema } from "./admin-authz";
import { normalizeAdminUserPageParams, toSafeAdminUser } from "./admin-utils";
import { createRequireRoles } from "./admin-authz";
import { couponCreateSchema, couponUpdateSchema, normalizeAdminAuditParams, platformSettingsSchema } from "./admin-validation";
import { calculateDebtBalanceAt, calculateSplitShareAt, obligationAgingBucket } from "./obligation-calculations";

function responseRecorder() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
}

test("Admin authorization rejects requests without an authenticated app user", async () => {
  let lookupCalled = false;
  let nextCalled = false;
  const response = responseRecorder();
  const guard = createRequireAdmin(async () => {
    lookupCalled = true;
    return true;
  });

  await guard({ appUserId: undefined } as any, response as any, () => { nextCalled = true; });

  assert.equal(response.statusCode, 401);
  assert.equal(lookupCalled, false);
  assert.equal(nextCalled, false);
});

test("Admin authorization denies an authenticated non-admin", async () => {
  let nextCalled = false;
  const response = responseRecorder();
  const guard = createRequireAdmin(async userId => userId === 17);

  await guard({ appUserId: 18 } as any, response as any, () => { nextCalled = true; });

  assert.equal(response.statusCode, 403);
  assert.deepEqual(response.body, { message: "Admin access required" });
  assert.equal(nextCalled, false);
});

test("Admin authorization permits an administrator verified by the backend", async () => {
  let nextCalled = false;
  const response = responseRecorder();
  const guard = createRequireAdmin(async userId => userId === 17);

  await guard({ appUserId: 17 } as any, response as any, () => { nextCalled = true; });

  assert.equal(response.statusCode, 200);
  assert.equal(nextCalled, true);
});

test("Admin authorization fails closed when the backend role check errors", async () => {
  let nextCalled = false;
  const response = responseRecorder();
  const guard = createRequireAdmin(async () => { throw new Error("database error"); });

  await guard({ appUserId: 17 } as any, response as any, () => { nextCalled = true; });

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, { message: "Unable to verify administrator access" });
  assert.equal(nextCalled, false);
});

test("admin user search, filter, sorting, and pagination inputs are normalized", () => {
  assert.deepEqual(normalizeAdminUserPageParams({
    page: "3",
    pageSize: "50",
    search: "  Alex  ",
    filter: "suspended",
    sortBy: "email",
    sortDir: "asc",
  }), {
    page: 3,
    pageSize: 50,
    search: "Alex",
    filter: "suspended",
    sortBy: "email",
    sortDir: "asc",
  });

  assert.deepEqual(normalizeAdminUserPageParams({
    page: "-2",
    pageSize: "900",
    search: "x".repeat(140),
    filter: "password",
    sortBy: "password",
    sortDir: "drop",
  }), {
    page: 1,
    pageSize: 25,
    search: "x".repeat(120),
    filter: "all",
    sortBy: "createdAt",
    sortDir: "desc",
  });
});

test("safe admin user projection never includes credentials or unexpected fields", () => {
  const safe = toSafeAdminUser({
    id: 9,
    username: "person@example.test",
    displayName: "Test Person",
    email: "person@example.test",
    accountStatus: "active",
    subscriptionStatus: "free",
    isAdmin: false,
    adminRole: "user",
    createdAt: null,
    lastLogin: null,
    transactionCount: 4,
    profileCount: 1,
    password: "should-not-leak",
    passwordHash: "should-not-leak",
    resetToken: "should-not-leak",
    resetExpires: new Date(),
    sessionSecret: "should-not-leak",
  });

  assert.deepEqual(safe, {
    id: 9,
    username: "person@example.test",
    displayName: "Test Person",
    email: "person@example.test",
    accountStatus: "active",
    subscriptionStatus: "free",
    isAdmin: false,
    adminRole: "user",
    createdAt: null,
    lastLogin: null,
    transactionCount: 4,
    profileCount: 1,
  });
});

test("admin account status updates reject privilege fields and unsupported values", () => {
  assert.equal(adminAccountStatusUpdateSchema.safeParse({ status: "suspended" }).success, true);
  assert.equal(adminAccountStatusUpdateSchema.safeParse({ status: "suspended", isAdmin: true }).success, false);
  assert.equal(adminAccountStatusUpdateSchema.safeParse({ status: "deleted" }).success, false);
});

test("role authorization grants only roles in the allowlist", async () => {
  const response = responseRecorder();
  let nextCalled = false;
  const guard = createRequireRoles(async () => ["analyst"], ["admin", "super_admin"]);
  await guard({ appUserId: 42 } as any, response as any, () => { nextCalled = true; });
  assert.equal(response.statusCode, 403);
  assert.equal(nextCalled, false);
});

test("coupon validation normalizes codes and rejects unsafe or invalid discount data", () => {
  const coupon = couponCreateSchema.safeParse({
    code: " spring-10 ",
    description: "Spring discount",
    discountType: "percentage",
    discountValue: 10,
    startsAt: "2026-10-01T00:00:00.000Z",
    expiresAt: "2026-11-01T00:00:00.000Z",
    maxRedemptions: 100,
    isActive: true,
  });
  assert.equal(coupon.success, true);
  if (coupon.success) assert.equal(coupon.data.code, "SPRING-10");

  assert.equal(couponCreateSchema.safeParse({
    code: "TOO-MUCH",
    description: "",
    discountType: "percentage",
    discountValue: 101,
    startsAt: "2026-10-01T00:00:00.000Z",
    expiresAt: "2026-11-01T00:00:00.000Z",
    maxRedemptions: null,
    isActive: true,
  }).success, false);
  assert.equal(couponUpdateSchema.safeParse({ currentRedemptions: 500 }).success, false);
});

test("coupon date and redemption validation rejects expiry before start", () => {
  const result = couponCreateSchema.safeParse({
    code: "WINTER",
    discountType: "fixed_amount",
    discountValue: 20,
    startsAt: "2026-12-01T00:00:00.000Z",
    expiresAt: "2026-11-01T00:00:00.000Z",
    maxRedemptions: null,
  });
  assert.equal(result.success, false);
});

test("platform settings accept only the safe allowlisted fields", () => {
  assert.equal(platformSettingsSchema.safeParse({
    applicationName: "FinTrack Pro",
    supportEmail: "help@example.com",
    registrationEnabled: false,
  }).success, true);
  assert.equal(platformSettingsSchema.safeParse({
    applicationName: "FinTrack",
    supportEmail: "",
    registrationEnabled: true,
    sessionSecret: "must-not-be-accepted",
  }).success, false);
});

test("audit filter inputs are bounded and normalized", () => {
  assert.deepEqual(normalizeAdminAuditParams({
    page: "4",
    pageSize: "50",
    from: "2026-10-01",
    to: "2026-10-16",
    actor: " Admin ",
    action: " admin:login ",
    target: "Alex",
    targetUserId: "23",
    result: "failure",
  }), {
    page: 4,
    pageSize: 50,
    from: "2026-10-01",
    to: "2026-10-16",
    actor: "Admin",
    action: "admin:login",
    target: "Alex",
    targetUserId: 23,
    result: "failure",
  });
  assert.equal(normalizeAdminAuditParams({ from: "not-a-date", targetUserId: "-1" }).from, "");
});

test("obligation calculations preserve as-of settlement, future-date, and aging rules", () => {
  const now = new Date("2026-10-16T12:00:00Z");
  assert.equal(calculateDebtBalanceAt({
    amount: "100",
    date: "2026-10-01T12:00:00Z",
    status: "partial",
    settledAmount: "25",
  }, now).outstanding, 75);
  assert.equal(calculateDebtBalanceAt({
    amount: "100",
    date: "2026-10-01T12:00:00Z",
    status: "settled",
    settledAmount: "100",
    settledAt: "2026-10-20T12:00:00Z",
  }, now).outstanding, 100);
  assert.equal(calculateDebtBalanceAt({
    amount: "100",
    date: "2026-10-20T12:00:00Z",
    status: "pending",
  }, now).relevant, false);
  assert.equal(calculateSplitShareAt({
    amount: "90",
    settledAmount: "30",
    isSettled: false,
    date: "2026-10-01T12:00:00Z",
  }, now).outstanding, 60);
  assert.equal(obligationAgingBucket(90), "61-90");
  assert.equal(obligationAgingBucket(91), "90+");
});

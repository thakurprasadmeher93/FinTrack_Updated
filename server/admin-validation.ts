import { z } from "zod";

const couponFields = {
  code: z.string()
    .trim()
    .min(3, "Coupon code must contain at least 3 characters")
    .max(40, "Coupon code must be 40 characters or fewer")
    .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, "Coupon code may use letters, numbers, hyphens, and underscores")
    .transform(value => value.toUpperCase()),
  description: z.string().trim().max(240).default(""),
  discountType: z.enum(["percentage", "fixed_amount"]),
  discountValue: z.number().finite().positive("Discount must be greater than zero").max(1_000_000_000),
  startsAt: z.union([z.date(), z.string().datetime()]).transform(value => value instanceof Date ? value : new Date(value)),
  expiresAt: z.union([z.date(), z.string().datetime()]).transform(value => value instanceof Date ? value : new Date(value)),
  maxRedemptions: z.number().int().positive().nullable(),
  isActive: z.boolean().default(true),
};

export const couponCreateSchema = z.object(couponFields).strict().superRefine((value, context) => {
  if (value.expiresAt <= value.startsAt) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["expiresAt"], message: "Expiry must be after the start date" });
  }
  if (value.discountType === "percentage" && value.discountValue > 100) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["discountValue"], message: "Percentage discounts cannot exceed 100%" });
  }
});

export const couponUpdateSchema = z.object({
  code: couponFields.code.optional(),
  description: couponFields.description.optional(),
  discountType: couponFields.discountType.optional(),
  discountValue: couponFields.discountValue.optional(),
  startsAt: couponFields.startsAt.optional(),
  expiresAt: couponFields.expiresAt.optional(),
  maxRedemptions: couponFields.maxRedemptions.optional(),
  isActive: couponFields.isActive.optional(),
}).strict();

export const platformSettingsSchema = z.object({
  applicationName: z.string().trim().min(2).max(60),
  supportEmail: z.union([z.string().trim().email().max(254), z.literal("")]),
  registrationEnabled: z.boolean(),
}).strict();

const dateOnly = (value: unknown): string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? "" : value;
};

export function normalizeAdminAuditParams(params: Record<string, unknown>) {
  const pageValue = Number(params.page);
  const sizeValue = Number(params.pageSize);
  const targetValue = Number(params.targetUserId);
  const success = ["success", "failure"].includes(String(params.result))
    ? String(params.result) as "success" | "failure"
    : "all";
  return {
    page: Number.isSafeInteger(pageValue) && pageValue > 0 ? Math.min(pageValue, 1_000_000) : 1,
    pageSize: [25, 50, 100].includes(sizeValue) ? sizeValue : 25,
    from: dateOnly(params.from),
    to: dateOnly(params.to),
    actor: String(params.actor || "").trim().slice(0, 120),
    action: String(params.action || "").trim().slice(0, 80),
    target: String(params.target || "").trim().slice(0, 120),
    targetUserId: Number.isSafeInteger(targetValue) && targetValue > 0 ? targetValue : null,
    result: success,
  };
}

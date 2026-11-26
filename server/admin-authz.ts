import type { RequestHandler } from "express";
import { z } from "zod";

type AdminLookup = (userId: number) => Promise<boolean>;
export const adminRoles = ["super_admin", "admin", "support", "analyst"] as const;
export type AdminRole = typeof adminRoles[number];
type RoleLookup = (userId: number) => Promise<AdminRole[]>;

export const adminAccountStatusUpdateSchema = z.object({
  status: z.enum(["active", "inactive", "suspended"]),
}).strict();

export function createRequireAdmin(isAdminUser: AdminLookup): RequestHandler {
  return createRequireRoles(
    async userId => (await isAdminUser(userId)) ? ["admin"] : [],
    ["super_admin", "admin"],
  );
}

export function createRequireRoles(
  getUserRoles: RoleLookup,
  allowedRoles: readonly AdminRole[],
): RequestHandler {
  return async (req: any, res, next) => {
    const userId = Number(req.appUserId);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const roles = await getUserRoles(userId);
      if (!roles.some(role => allowedRoles.includes(role))) {
        return res.status(403).json({ message: "Admin access required" });
      }
      return next();
    } catch {
      return res.status(500).json({ message: "Unable to verify administrator access" });
    }
  };
}

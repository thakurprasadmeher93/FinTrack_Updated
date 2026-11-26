import type { Express } from "express";
import { db } from "../../db";
import { users } from "../../../shared/schema";
import { eq } from "drizzle-orm";

export function registerAuthRoutes(app: Express): void {
  app.get("/api/auth/user", async (req: any, res) => {
    try {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");

      const customAuthUsername = (req.session as any)?.customAuthUsername;
      if (!customAuthUsername) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const [appUser] = await db.select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        email: users.email,
        isAdmin: users.isAdmin,
        subscriptionStatus: users.subscriptionStatus,
        accountStatus: users.accountStatus,
        lastLogin: users.lastLogin,
        activeProfileId: users.activeProfileId,
        createdAt: users.createdAt,
      }).from(users).where(eq(users.username, customAuthUsername));
      if (!appUser || appUser.accountStatus !== "active") {
        if (!appUser) {
          return res.status(401).json({ message: "Unauthorized" });
        }
        return res.status(401).json({ message: "Unauthorized" });
      }

      return res.json(appUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}

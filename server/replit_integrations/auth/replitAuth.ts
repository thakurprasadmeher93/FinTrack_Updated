import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "../../storage";
import { adminStorage } from "../../admin-storage";
import { db } from "../../db";
import { users } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    name: "fintrack.sid",
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
      sameSite: "lax",
      path: "/",
    },
  });
}

export async function setupAuth(app: Express) {
  // Seed admin user
  try {
    const adminEmail = "optimiselife365@gmail.com";
    const existingAdmin = await storage.getUserByUsername(adminEmail);
    if (!existingAdmin) {
      await storage.createUser({
        username: adminEmail,
        password: "Admin@123",
        displayName: "Admin",
        email: adminEmail,
        subscriptionStatus: "paid",
      });
      console.log("Admin user seeded");
    }
  } catch (err) {
    console.error("Failed to seed admin:", err);
  }

  app.set("trust proxy", 1);
  app.use(getSession());

  // Logout
  app.get("/api/logout", async (req: any, res) => {
    const username = (req.session as any)?.customAuthUsername;
    if (username) {
      try {
        const user = await storage.getUserByUsername(username);
        if (user) {
          await storage.createAuditLog({
            userId: user.id,
            action: "logout",
            entityType: "user",
            entityId: user.id,
            details: "User signed out",
          });
        }
      } catch {
        console.error("Failed to record logout activity");
      }
    }
    req.session.destroy((err: any) => {
      if (err) console.error("Session destroy error:", err);
      res.clearCookie("fintrack.sid");
      res.redirect("/");
    });
  });
}

export async function loginCustom(req: any, res: any) {
  const { username, password } = req.body;
  const user = await storage.getUserByUsername(username);

  if (!user || user.password !== password) {
    return res.status(401).json({ message: "Invalid credentials" });
  }
  if (user.accountStatus !== "active") {
    return res.status(403).json({ message: "This account is not active" });
  }

  await db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, user.id));
  try {
    await storage.createAuditLog({
      userId: user.id,
      action: "login",
      entityType: "user",
      entityId: user.id,
      details: "User signed in",
    });
  } catch (error) {
    console.error("Failed to record login activity");
  }

  (req.session as any).isCustomAuth = true;
  (req.session as any).customAuthUsername = username;

  req.session.save((err: any) => {
    if (err) return res.status(500).json({ message: "Session save failed" });
    const { password: _pw, resetToken: _rt, ...safeUser } = user;
    res.json(safeUser);
  });
}

export async function registerCustom(req: any, res: any) {
  const { username, password, displayName, email } = req.body;

  const settings = await adminStorage.getPlatformSettings();
  if (!settings.registrationEnabled) {
    return res.status(403).json({ message: "New account registration is currently disabled" });
  }

  const existing = await storage.getUserByUsername(username);
  if (existing) {
    return res.status(400).json({ message: "User already exists" });
  }

  const newUser = await storage.createUser({
    username,
    password,
    displayName,
    email,
    subscriptionStatus: "free",
  });

  // Create default profile
  const profile = await storage.createProfile({
    userId: newUser.id,
    name: "Personal",
    type: "personal",
    currency: "INR",
  });

  await db.update(users).set({ activeProfileId: profile.id }).where(eq(users.id, newUser.id));
  try {
    await storage.createAuditLog({
      userId: newUser.id,
      action: "register",
      entityType: "user",
      entityId: newUser.id,
      details: "User registered",
    });
  } catch {
    console.error("Failed to record registration activity");
  }

  (req.session as any).isCustomAuth = true;
  (req.session as any).customAuthUsername = username;

  req.session.save((err: any) => {
    if (err) return res.status(500).json({ message: "Session save failed" });
    const { password: _pw, resetToken: _rt, ...safeUser } = newUser;
    res.json(safeUser);
  });
}

export async function forgotPassword(req: any, res: any) {
  const { email } = req.body;
  const user = await storage.getUserByUsername(email);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const token = Math.random().toString(36).substring(2, 15);
  const expires = new Date(Date.now() + 3600000); // 1 hour

  await db.update(users).set({ resetToken: token, resetExpires: expires }).where(eq(users.id, user.id));

  res.json({ message: "Reset link sent to your email (Simulated)", token });
}

export async function resetPassword(req: any, res: any) {
  const { token, password } = req.body;
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.resetToken, token), sql`${users.resetExpires} > now()`));

  if (!user) {
    return res.status(400).json({ message: "Invalid or expired token" });
  }

  await db.update(users).set({ password, resetToken: null, resetExpires: null }).where(eq(users.id, user.id));
  res.json({ message: "Password updated successfully" });
}

export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
  const customAuthUsername = (req.session as any)?.customAuthUsername;
  if (customAuthUsername) {
    const user = await storage.getUserByUsername(customAuthUsername);
    if (user?.accountStatus === "active") return next();
  }
  return res.status(401).json({ message: "Unauthorized" });
};

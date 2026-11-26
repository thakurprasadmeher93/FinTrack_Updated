import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated, loginCustom, registerCustom, forgotPassword, resetPassword } from "./replit_integrations/auth";
// Note: Replit OIDC auth has been removed. Only custom email/password auth is used.
import { db } from "./db";
import { users, profiles, categories, transactions, debts, billSplits, wealthSnapshots, sessions } from "@shared/schema";
import { eq, and, sql, desc, asc } from "drizzle-orm";
import { adminStorage } from "./admin-storage";
import { adminAccountStatusUpdateSchema, adminRoles, createRequireRoles } from "./admin-authz";
import { couponCreateSchema, couponUpdateSchema, platformSettingsSchema } from "./admin-validation";

import { Parser } from 'json2csv';

async function recordAdminFailure(
  userId: number,
  action: string,
  entityType: string,
  entityId: number | null,
  details: string,
  metadata: Record<string, unknown> = {},
) {
  try {
    await storage.createAuditLog({
      userId,
      action,
      entityType,
      entityId,
      details,
      success: false,
      metadata,
    });
  } catch {
    console.error("Failed to record unsuccessful administrator action");
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // 1. Setup Auth
  await setupAuth(app);
  registerAuthRoutes(app);

  app.post("/api/login-custom", loginCustom);
  app.post("/api/register-custom", registerCustom);
  app.post("/api/forgot-password", forgotPassword);
  app.post("/api/reset-password", resetPassword);
  app.get("/api/platform-config", async (_req: any, res) => {
    try {
      const { applicationName, supportEmail, registrationEnabled } = await adminStorage.getPlatformSettings();
      res.json({ applicationName, supportEmail, registrationEnabled });
    } catch {
      res.status(500).json({ message: "Platform configuration is unavailable" });
    }
  });

  // 2. Middleware to sync auth user with App User and ensure profile exists
  app.use(async (req: any, res, next) => {
    try {
      const customAuthUsername = (req.session as any)?.customAuthUsername;

      if (!customAuthUsername) return next();

      let appUser = await storage.getUserByUsername(customAuthUsername);

      if (!appUser) {
        appUser = await storage.createUser({
          username: customAuthUsername,
          email: null,
          displayName: "User",
          subscriptionStatus: "free",
        });
      }

      // Auto-create a default profile + categories for any user who doesn't have one
      if (!appUser.activeProfileId) {
        const existingProfiles = await storage.getProfiles(appUser.id);
        let profile = existingProfiles[0];

        if (!profile) {
          profile = await storage.createProfile({
            userId: appUser.id,
            name: 'Personal',
            type: 'personal',
            currency: 'INR',
          });

          const defaultCategories = [
            { name: 'Food', type: 'expense', icon: 'Utensils', color: '#ef4444' },
            { name: 'Groceries', type: 'expense', icon: 'ShoppingBasket', color: '#10b981' },
            { name: 'Transport', type: 'expense', icon: 'Car', color: '#f97316' },
            { name: 'Fuel', type: 'expense', icon: 'Fuel', color: '#f59e0b' },
            { name: 'Taxi', type: 'expense', icon: 'Taxi', color: '#0ea5e9' },
            { name: 'Shopping', type: 'expense', icon: 'ShoppingBag', color: '#8b5cf6' },
            { name: 'Clothes', type: 'expense', icon: 'Shirt', color: '#ec4899' },
            { name: 'Bills', type: 'expense', icon: 'Receipt', color: '#ef4444' },
            { name: 'Electricity', type: 'expense', icon: 'Zap', color: '#f59e0b' },
            { name: 'Gas', type: 'expense', icon: 'Flame', color: '#f97316' },
            { name: 'Internet', type: 'expense', icon: 'Wifi', color: '#0ea5e9' },
            { name: 'Water', type: 'expense', icon: 'Droplets', color: '#3b82f6' },
            { name: 'Rent', type: 'expense', icon: 'Home', color: '#6366f1' },
            { name: 'House', type: 'expense', icon: 'Home', color: '#64748b' },
            { name: 'Maid Salary', type: 'expense', icon: 'User', color: '#10b981' },
            { name: 'Entertainment', type: 'expense', icon: 'Play', color: '#ec4899' },
            { name: 'Drink', type: 'expense', icon: 'CupSoda', color: '#f43f5e' },
            { name: 'Gym', type: 'expense', icon: 'Dumbbell', color: '#06b6d4' },
            { name: 'Subscriptions', type: 'expense', icon: 'Library', color: '#8b5cf6' },
            { name: 'Beauty/Haircut', type: 'expense', icon: 'Scissors', color: '#d946ef' },
            { name: 'Healthcare', type: 'expense', icon: 'HeartPulse', color: '#10b981' },
            { name: 'Recharge', type: 'expense', icon: 'Zap', color: '#f59e0b' },
            { name: 'Other', type: 'expense', icon: 'Tag', color: '#64748b' },
            { name: 'Salary', type: 'income', icon: 'Banknote', color: '#22c55e' },
            { name: 'Bonus', type: 'income', icon: 'Sparkles', color: '#f59e0b' },
            { name: 'Rental Income', type: 'income', icon: 'Home', color: '#6366f1' },
            { name: 'Dividend', type: 'income', icon: 'PieChart', color: '#8b5cf6' },
            { name: 'Interest', type: 'income', icon: 'TrendingUp', color: '#10b981' },
            { name: 'Refund', type: 'income', icon: 'RotateCcw', color: '#f43f5e' },
            { name: 'Gift', type: 'income', icon: 'Gift', color: '#ec4899' },
            { name: 'Freelance', type: 'income', icon: 'Briefcase', color: '#0ea5e9' },
            { name: 'Investment', type: 'income', icon: 'TrendingUp', color: '#f59e0b' },
            { name: 'Other', type: 'income', icon: 'PlusCircle', color: '#10b981' },
          ];
          for (const cat of defaultCategories) {
            await storage.createCategory({ profileId: profile.id, ...cat, isDefault: true });
          }
        }

        await db.update(users).set({ activeProfileId: profile.id }).where(eq(users.id, appUser.id));
        appUser.activeProfileId = profile.id;
      }

      req.appUserId = appUser.id;
    } catch (err) {
      console.error('[auth-middleware] error:', err);
    }
    next();
  });

  // App Routes
  // Note: /api/auth/user is handled in replit_integrations/auth/routes.ts
  // but we should ensure the frontend is hitting the right one.


  // Profiles
  app.get(api.profiles.list.path, isAuthenticated, async (req: any, res) => {
    const profiles = await storage.getProfiles(req.appUserId);
    res.json(profiles);
  });

  app.post(api.profiles.create.path, isAuthenticated, async (req: any, res) => {
    // Plan enforcement logic could go here
    try {
      const input = api.profiles.create.input.parse(req.body);
      
      // Check limits for Free plan
      const userProfiles = await storage.getProfiles(req.appUserId);
      const [user] = await db.select().from(users).where(eq(users.id, req.appUserId));
      
      if (user?.subscriptionStatus === 'free' && userProfiles.length >= 1) {
        return res.status(403).json({ message: 'Free plan limited to 1 profile. Upgrade to create more.' });
      }

      const profile = await storage.createProfile({ ...input, userId: req.appUserId });
      
      // Create default categories for new profile
      const defaultCategories = [
        { name: 'Food', type: 'expense', icon: 'Utensils', color: '#ef4444' },
        { name: 'Groceries', type: 'expense', icon: 'ShoppingBasket', color: '#10b981' },
        { name: 'Transport', type: 'expense', icon: 'Car', color: '#f97316' },
        { name: 'Fuel', type: 'expense', icon: 'Fuel', color: '#f59e0b' },
        { name: 'Taxi', type: 'expense', icon: 'Taxi', color: '#0ea5e9' },
        { name: 'Shopping', type: 'expense', icon: 'ShoppingBag', color: '#8b5cf6' },
        { name: 'Clothes', type: 'expense', icon: 'Shirt', color: '#ec4899' },
        { name: 'Bills', type: 'expense', icon: 'Receipt', color: '#ef4444' },
        { name: 'Electricity', type: 'expense', icon: 'Zap', color: '#f59e0b' },
        { name: 'Gas', type: 'expense', icon: 'Flame', color: '#f97316' },
        { name: 'Internet', type: 'expense', icon: 'Wifi', color: '#0ea5e9' },
        { name: 'Water', type: 'expense', icon: 'Droplets', color: '#3b82f6' },
        { name: 'Rent', type: 'expense', icon: 'Home', color: '#6366f1' },
        { name: 'House', type: 'expense', icon: 'Home', color: '#64748b' },
        { name: 'Maid Salary', type: 'expense', icon: 'User', color: '#10b981' },
        { name: 'Entertainment', type: 'expense', icon: 'Play', color: '#ec4899' },
        { name: 'Drink', type: 'expense', icon: 'CupSoda', color: '#f43f5e' },
        { name: 'Gym', type: 'expense', icon: 'Dumbbell', color: '#06b6d4' },
        { name: 'Subscriptions', type: 'expense', icon: 'Library', color: '#8b5cf6' },
        { name: 'Beauty/Haircut', type: 'expense', icon: 'Scissors', color: '#d946ef' },
        { name: 'Healthcare', type: 'expense', icon: 'HeartPulse', color: '#10b981' },
        { name: 'Recharge', type: 'expense', icon: 'Zap', color: '#f59e0b' },
        { name: 'Other', type: 'expense', icon: 'Tag', color: '#64748b' },
        { name: 'Salary', type: 'income', icon: 'Banknote', color: '#22c55e' },
        { name: 'Bonus', type: 'income', icon: 'Sparkles', color: '#f59e0b' },
        { name: 'Rental Income', type: 'income', icon: 'Home', color: '#6366f1' },
        { name: 'Dividend', type: 'income', icon: 'PieChart', color: '#8b5cf6' },
        { name: 'Interest', type: 'income', icon: 'TrendingUp', color: '#10b981' },
        { name: 'Refund', type: 'income', icon: 'RotateCcw', color: '#f43f5e' },
        { name: 'Gift', type: 'income', icon: 'Gift', color: '#ec4899' },
        { name: 'Freelance', type: 'income', icon: 'Briefcase', color: '#0ea5e9' },
        { name: 'Investment', type: 'income', icon: 'TrendingUp', color: '#f59e0b' },
        { name: 'Other', type: 'income', icon: 'PlusCircle', color: '#10b981' },
      ];

      for (const cat of defaultCategories) {
        await storage.createCategory({
          profileId: profile.id,
          ...cat,
          isDefault: true
        });
      }

      res.status(201).json(profile);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(500).json({ message: 'Internal Server Error' });
      }
    }
  });

  app.post(api.profiles.switch.path, isAuthenticated, async (req: any, res) => {
    try {
      const profileId = Number(req.params.id);
      const profile = await storage.getProfile(profileId);
      
      if (!profile || profile.userId !== req.appUserId) {
        return res.status(404).json({ message: 'Profile not found' });
      }

      const [updatedUser] = await db.update(users)
        .set({ activeProfileId: profileId })
        .where(eq(users.id, req.appUserId))
        .returning();

      res.json(updatedUser);
    } catch (err) {
      res.status(500).json({ message: 'Failed to switch profile' });
    }
  });

  app.patch("/api/profiles/:id", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = Number(req.params.id);
      const profile = await storage.getProfile(profileId);
      
      if (!profile || profile.userId !== req.appUserId) {
        return res.status(404).json({ message: 'Profile not found' });
      }

      const updated = await storage.updateProfile(profileId, req.body);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: 'Failed to update profile' });
    }
  });

  app.delete("/api/profiles/:id", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = Number(req.params.id);
      const profile = await storage.getProfile(profileId);
      
      if (!profile || profile.userId !== req.appUserId) {
        return res.status(404).json({ message: 'Profile not found' });
      }

      // Don't allow deleting the last profile
      const userProfiles = await storage.getProfiles(req.appUserId);
      if (userProfiles.length <= 1) {
        return res.status(400).json({ message: 'Cannot delete your only profile' });
      }

      await storage.deleteProfile(profileId);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: 'Failed to delete profile' });
    }
  });

  // Categories
  app.get(api.categories.list.path, isAuthenticated, async (req: any, res) => {
    try {
      const profileId = Number(req.params.profileId);
      let categoriesList = await storage.getCategories(profileId);
      
      // If no categories, seed them (for existing users who didn't get them)
      if (categoriesList.length === 0) {
        const defaultCategories = [
          { name: 'Food', type: 'expense', icon: 'Utensils', color: '#ef4444' },
          { name: 'Groceries', type: 'expense', icon: 'ShoppingBasket', color: '#10b981' },
          { name: 'Transport', type: 'expense', icon: 'Car', color: '#f97316' },
          { name: 'Fuel', type: 'expense', icon: 'Fuel', color: '#f59e0b' },
          { name: 'Taxi', type: 'expense', icon: 'Taxi', color: '#0ea5e9' },
          { name: 'Shopping', type: 'expense', icon: 'ShoppingBag', color: '#8b5cf6' },
          { name: 'Clothes', type: 'expense', icon: 'Shirt', color: '#ec4899' },
          { name: 'Bills', type: 'expense', icon: 'Receipt', color: '#ef4444' },
          { name: 'Electricity', type: 'expense', icon: 'Zap', color: '#f59e0b' },
          { name: 'Gas', type: 'expense', icon: 'Flame', color: '#f97316' },
          { name: 'Internet', type: 'expense', icon: 'Wifi', color: '#0ea5e9' },
          { name: 'Water', type: 'expense', icon: 'Droplets', color: '#3b82f6' },
          { name: 'Rent', type: 'expense', icon: 'Home', color: '#6366f1' },
          { name: 'House', type: 'expense', icon: 'Home', color: '#64748b' },
          { name: 'Maid Salary', type: 'expense', icon: 'User', color: '#10b981' },
          { name: 'Entertainment', type: 'expense', icon: 'Play', color: '#ec4899' },
          { name: 'Drink', type: 'expense', icon: 'CupSoda', color: '#f43f5e' },
          { name: 'Gym', type: 'expense', icon: 'Dumbbell', color: '#06b6d4' },
          { name: 'Subscriptions', type: 'expense', icon: 'Library', color: '#8b5cf6' },
          { name: 'Beauty/Haircut', type: 'expense', icon: 'Scissors', color: '#d946ef' },
          { name: 'Healthcare', type: 'expense', icon: 'HeartPulse', color: '#10b981' },
          { name: 'Recharge', type: 'expense', icon: 'Zap', color: '#f59e0b' },
          { name: 'Other', type: 'expense', icon: 'Tag', color: '#64748b' },
          { name: 'Salary', type: 'income', icon: 'Banknote', color: '#22c55e' },
          { name: 'Bonus', type: 'income', icon: 'Sparkles', color: '#f59e0b' },
          { name: 'Rental Income', type: 'income', icon: 'Home', color: '#6366f1' },
          { name: 'Dividend', type: 'income', icon: 'PieChart', color: '#8b5cf6' },
          { name: 'Interest', type: 'income', icon: 'TrendingUp', color: '#10b981' },
          { name: 'Refund', type: 'income', icon: 'RotateCcw', color: '#f43f5e' },
          { name: 'Gift', type: 'income', icon: 'Gift', color: '#ec4899' },
          { name: 'Freelance', type: 'income', icon: 'Briefcase', color: '#0ea5e9' },
          { name: 'Investment', type: 'income', icon: 'TrendingUp', color: '#f59e0b' },
          { name: 'Side Hustle', type: 'income', icon: 'Coins', color: '#10b981' },
          { name: 'Business Profit', type: 'income', icon: 'Store', color: '#0ea5e9' },
          { name: 'Stock Sale', type: 'income', icon: 'BarChart3', color: '#f59e0b' },
          { name: 'Other', type: 'income', icon: 'PlusCircle', color: '#10b981' },
        ];
        for (const cat of defaultCategories) {
          await storage.createCategory({ ...cat, profileId, isDefault: true } as any);
        }
        categoriesList = await storage.getCategories(profileId);
      }
      res.json(categoriesList);
    } catch (err) {
      res.status(500).json({ message: 'Failed to fetch categories' });
    }
  });

  app.post(api.categories.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.categories.create.input.parse(req.body);
      const category = await storage.createCategory({ ...input, profileId: Number(req.params.profileId) } as any);
      res.status(201).json(category);
    } catch (err) {
      res.status(400).json({ message: 'Invalid input' });
    }
  });

  app.patch('/api/profiles/:profileId/categories/:categoryId', isAuthenticated, async (req: any, res) => {
    try {
      const profileId = Number(req.params.profileId);
      const profile = await storage.getProfile(profileId);
      if (!profile || profile.userId !== req.appUserId) {
        return res.status(404).json({ message: 'Profile not found' });
      }
      const categoryId = Number(req.params.categoryId);
      const { name, color } = req.body;
      if (!name && !color) return res.status(400).json({ message: 'Nothing to update' });
      const updated = await storage.updateCategory(categoryId, { name, color });
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ message: err.message || 'Failed to update category' });
    }
  });

  app.delete('/api/profiles/:profileId/categories/:categoryId', isAuthenticated, async (req: any, res) => {
    try {
      const profileId = Number(req.params.profileId);
      const profile = await storage.getProfile(profileId);
      if (!profile || profile.userId !== req.appUserId) {
        return res.status(404).json({ message: 'Profile not found' });
      }
      const categoryId = Number(req.params.categoryId);
      const result = await storage.deleteCategory(categoryId, profileId);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ message: err.message || 'Failed to delete category' });
    }
  });

  // Transactions
  app.get(api.transactions.list.path, isAuthenticated, async (req, res) => {
    const profileId = Number(req.params.profileId);
    // Parse query params manually since express parses them as strings
    const options = {
      month: req.query.month ? Number(req.query.month) : undefined,
      year: req.query.year ? Number(req.query.year) : undefined,
      categoryId: req.query.categoryId ? Number(req.query.categoryId) : undefined,
    };
    
    const txs = await storage.getTransactions(profileId, options);
    // res.json(txs);
    // Explicitly mapping to ensure amounts are numbers and category is included
    res.json(txs.map(tx => ({
      ...tx,
      amount: tx.amount.toString(), // Drizzle numeric can be string, frontend expects string in types but often works with number
    })));
  });

  app.post(api.transactions.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const profileId = Number(req.params.profileId);
      
      // Free plan transaction limit enforcement
      const [user] = await db.select().from(users).where(eq(users.id, req.appUserId));
      if (user?.subscriptionStatus === 'free') {
        const txs = await storage.getTransactions(profileId);
        if (txs.length >= 20) {
          return res.status(403).json({ message: "Free plan is limited to 20 transactions. Upgrade to Pro for unlimited entries." });
        }
      }

      // Coerce amount to string/number if needed
      const body = {
        ...req.body,
        amount: req.body.amount?.toString(),
        date: req.body.date ? new Date(req.body.date) : undefined
      };
      const input = api.transactions.create.input.parse(body);
      const tx = await storage.createTransaction({ ...input, profileId: Number(req.params.profileId) });
      res.status(201).json(tx);
    } catch (err) {
      console.error("Transaction Create Error:", err);
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(400).json({ message: 'Invalid input' });
      }
    }
  });

  app.delete(api.transactions.delete.path, isAuthenticated, async (req, res) => {
    await storage.deleteTransaction(Number(req.params.id));
    res.status(204).send();
  });

  app.patch("/api/transactions/:id", isAuthenticated, async (req, res) => {
    try {
      const body = {
        ...req.body,
        ...(req.body.amount !== undefined && { amount: req.body.amount.toString() }),
        ...(req.body.categoryId !== undefined && { categoryId: Number(req.body.categoryId) }),
        ...(req.body.date !== undefined && { date: new Date(req.body.date) }),
      };

      const txId = Number(req.params.id);
      const existingTx = await storage.getTransactionById(txId);
      if (!existingTx) {
        return res.status(404).json({ message: "Transaction not found" });
      }

      const effectiveType = body.type ?? existingTx.type;
      const effectiveCategoryId = body.categoryId ?? existingTx.categoryId;

      const category = await storage.getCategory(effectiveCategoryId);
      if (!category) {
        return res.status(400).json({ message: "Category not found", field: "categoryId" });
      }
      if (category.type !== effectiveType) {
        return res.status(400).json({
          message: `Category type "${category.type}" does not match transaction type "${effectiveType}". Please select a category that matches the transaction type.`,
          field: "categoryId"
        });
      }

      const tx = await storage.updateTransaction(txId, body);
      res.json(tx);
    } catch (err) {
      console.error("Patch transaction error:", err);
      res.status(400).json({ message: "Failed to update transaction" });
    }
  });

  // Budgets
  app.get(api.budgets.get.path, isAuthenticated, async (req, res) => {
    const budget = await storage.getBudget(
      Number(req.params.profileId), 
      Number(req.query.month), 
      Number(req.query.year)
    );
    res.json(budget || null);
  });

  app.post(api.budgets.set.path, isAuthenticated, async (req, res) => {
    try {
      const body = {
        ...req.body,
        amount: req.body.amount?.toString(),
        month: req.body.month ? Number(req.body.month) : undefined,
        year: req.body.year ? Number(req.body.year) : undefined
      };
      const input = api.budgets.set.input.parse(body);
      const budget = await storage.upsertBudget({ ...input, profileId: Number(req.params.profileId) });
      res.json(budget);
    } catch (err) {
      console.error("Budget Set Error:", err);
      res.status(400).json({ message: 'Invalid input' });
    }
  });

  // Analytics
  app.get(api.analytics.summary.path, isAuthenticated, async (req, res) => {
    const profileId = Number(req.params.profileId);
    const month = Number(req.query.month);
    const year = Number(req.query.year);

    const summary = await storage.getTransactionSummary(profileId, month, year);
    const budget = await storage.getBudget(profileId, month, year);

    let budgetStatus: 'ok' | 'warning' | 'exceeded' = 'ok';
    let remainingBudget: number | null = null;

    if (budget) {
      const budgetAmt = Number(budget.amount);
      remainingBudget = budgetAmt - summary.expenses;
      if (remainingBudget < 0) budgetStatus = 'exceeded';
      else if (remainingBudget < budgetAmt * 0.2) budgetStatus = 'warning';
    }

    res.json({
      ...summary,
      remainingBudget,
      budgetStatus
    });
  });

  app.get(api.analytics.byCategory.path, isAuthenticated, async (req, res) => {
    const expenses = await storage.getCategoryAnalysis(
      Number(req.params.profileId),
      Number(req.query.month),
      Number(req.query.year)
    );
    const income = await storage.getIncomeCategoryAnalysis(
      Number(req.params.profileId),
      Number(req.query.month),
      Number(req.query.year)
    );
    res.json({ expenses, income });
  });

  app.get("/api/profiles/:profileId/analytics/debts", isAuthenticated, async (req, res) => {
    const data = await storage.getDebtAnalysis(
      Number(req.params.profileId),
      Number(req.query.month),
      Number(req.query.year)
    );
    res.json(data);
  });

  app.get("/api/profiles/:profileId/analytics/splits", isAuthenticated, async (req, res) => {
    const data = await storage.getSplitBillAnalysis(
      Number(req.params.profileId),
      Number(req.query.month),
      Number(req.query.year)
    );
    res.json(data);
  });

  app.get("/api/profiles/:profileId/analytics/outstanding-obligations", isAuthenticated, async (req, res) => {
    try {
      const asOfParam = typeof req.query.asOf === "string" ? req.query.asOf : undefined;
      const asOf = asOfParam ? new Date(asOfParam) : undefined;
      if (asOf && Number.isNaN(asOf.getTime())) {
        return res.status(400).json({ error: "Invalid as-of timestamp" });
      }
      const data = await (storage as any).getOutstandingObligations(Number(req.params.profileId), asOf);
      res.json(data);
    } catch (err: any) {
      console.error("[outstanding-obligations] error:", err?.message, err?.stack);
      res.status(500).json({ error: err?.message || "Internal error" });
    }
  });

  app.get(api.analytics.trend.path, isAuthenticated, async (req, res) => {
    const profileId = Number(req.params.profileId);
    const type = req.query.type || 'monthly'; // 'monthly', 'yearly', '3y', '5y', 'alltime'
    
    let data;
    switch (type) {
      case 'yearly':
        data = await (storage as any).getYearlyTrend(profileId, 1);
        break;
      case '3y':
        data = await (storage as any).getThreeYearTrend(profileId);
        break;
      case '5y':
        data = await (storage as any).getFiveYearTrend(profileId);
        break;
      case 'alltime':
        data = await (storage as any).getAllTimeTrend(profileId);
        break;
      default:
        data = await storage.getMonthlyTrend(profileId);
    }
    
    res.json(data);
  });

  app.get("/api/profiles/:profileId/analytics/daily-spending", isAuthenticated, async (req, res) => {
    const profileId = Number(req.params.profileId);
    const type = req.query.type || 'monthly'; // 'monthly', 'yearly', '3y', '5y', 'alltime'
    
    const data = await (storage as any).getDailySpendingPattern(profileId, type);
    res.json(data);
  });

  app.get("/api/profiles/:profileId/rules", isAuthenticated, async (req: any, res) => {
    const rules = await (storage as any).getCategoryRules(Number(req.params.profileId));
    res.json(rules);
  });

  app.delete("/api/rules/:id", isAuthenticated, async (req: any, res) => {
    await (storage as any).deleteCategoryRule(Number(req.params.id));
    res.status(204).send();
  });

  app.get("/api/profiles/:profileId/export", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = Number(req.params.profileId);
      const format = req.query.format || 'csv';
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;
      const [user] = await db.select().from(users).where(eq(users.id, req.appUserId));
      
      if (user?.subscriptionStatus !== 'paid') {
        return res.status(403).json({ message: "Export is a Pro feature. Upgrade to unlock." });
      }

      let txs: any[];
      if (startDate && endDate) {
        // Get transactions within the date range
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Include the entire end date
        
        txs = await db.query.transactions.findMany({
          where: and(
            eq(transactions.profileId, profileId),
            sql`${transactions.date} >= ${start.toISOString()}`,
            sql`${transactions.date} <= ${end.toISOString()}`
          ),
          with: { category: true },
          orderBy: [asc(transactions.date)]
        });
      } else {
        txs = await storage.getTransactions(profileId);
      }
      
      await storage.createAuditLog({
        userId: req.appUserId,
        action: 'export',
        entityType: 'profile',
        entityId: profileId,
        details: `Exported transactions in ${format} format`
      });

      if (format === 'pdf') {
        // Also fetch debts and bill splits for the same date range
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? (() => { const d = new Date(endDate); d.setHours(23, 59, 59, 999); return d; })() : null;

        let debtRows: any[] = [];
        let splitRows: any[] = [];

        if (start && end) {
          debtRows = await db.select().from(debts).where(
            and(
              eq(debts.profileId, profileId),
              sql`${debts.date} >= ${start.toISOString()}`,
              sql`${debts.date} <= ${end.toISOString()}`
            )
          ).orderBy(asc(debts.date));

          splitRows = await db.query.billSplits.findMany({
            where: and(
              eq(billSplits.profileId, profileId),
              sql`${billSplits.date} >= ${start.toISOString()}`,
              sql`${billSplits.date} <= ${end.toISOString()}`
            ),
            with: { participants: true },
            orderBy: [asc(billSplits.date)]
          });
        } else {
          debtRows = await db.select().from(debts).where(eq(debts.profileId, profileId)).orderBy(asc(debts.date));
          splitRows = await db.query.billSplits.findMany({
            where: eq(billSplits.profileId, profileId),
            with: { participants: true },
            orderBy: [asc(billSplits.date)]
          });
        }

        return res.json({ transactions: txs, debts: debtRows, billSplits: splitRows });
      }

      const fields = ['date', 'amount', 'type', 'category.name', 'note'];
      const parser = new Parser({ fields });
      const csv = parser.parse(txs.map(tx => ({
        ...tx,
        date: new Date(tx.date).toLocaleDateString(),
        amount: `Rs. ${Math.abs(Number(tx.amount)).toLocaleString('en-IN')}`,
        type: tx.type.toUpperCase(),
        'category.name': tx.category?.name || 'Uncategorized'
      })));

      res.header('Content-Type', 'text/csv');
      res.attachment(`FinTrack-Report-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);
    } catch (err) {
      res.status(500).json({ message: "Export failed" });
    }
  });

  app.get("/api/audit-logs", isAuthenticated, async (req: any, res) => {
    const logs = await storage.getAuditLogs(req.appUserId);
    res.json(logs);
  });

  // Every current and future Admin API is protected by the same backend guard.
  const requireAdmin = createRequireRoles(async userId => {
    const [admin] = await db.select({ isAdmin: users.isAdmin, adminRole: users.adminRole })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const roles = adminRoles.filter(role => role === admin?.adminRole);
    if (admin?.isAdmin && !roles.includes("admin")) roles.push("admin");
    return roles;
  }, ["super_admin", "admin"]);
  app.use("/api/admin", isAuthenticated, requireAdmin);

  app.get("/api/admin/overview", async (_req: any, res) => {
    try {
      res.json(await adminStorage.getOverview());
    } catch (error) {
      console.error("Admin overview query failed");
      res.status(500).json({ message: "Failed to load admin overview" });
    }
  });

  app.get("/api/admin/stats", async (_req: any, res) => {
    try {
      const overview = await adminStorage.getOverview();
      res.json(overview.metrics);
    } catch (error) {
      console.error("Admin stats query failed");
      res.status(500).json({ message: "Failed to load admin statistics" });
    }
  });

  app.get("/api/admin/analytics", async (_req: any, res) => {
    try {
      res.json(await adminStorage.getOverview());
    } catch {
      console.error("Admin analytics query failed");
      res.status(500).json({ message: "Failed to load admin analytics" });
    }
  });

  app.get("/api/admin/users", async (req: any, res) => {
    try {
      const result = await adminStorage.getUserPage({
        page: req.query.page,
        pageSize: req.query.pageSize,
        search: req.query.search,
        filter: req.query.filter,
        sortBy: req.query.sortBy,
        sortDir: req.query.sortDir,
      });
      res.json(result);
    } catch (error) {
      console.error("Admin user list query failed");
      res.status(500).json({ message: "Failed to load users" });
    }
  });

  app.get("/api/admin/users/:userId", async (req: any, res) => {
    const userId = Number(req.params.userId);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    try {
      const detail = await adminStorage.getUserDetail(userId);
      if (!detail) return res.status(404).json({ message: "User not found" });
      res.json(detail);
    } catch (error) {
      console.error("Admin user detail query failed");
      res.status(500).json({ message: "Failed to load user details" });
    }
  });

  app.patch("/api/admin/users/:userId/status", async (req: any, res) => {
    const userId = Number(req.params.userId);
    const parsed = adminAccountStatusUpdateSchema.safeParse(req.body);
    if (!Number.isSafeInteger(userId) || userId <= 0 || !parsed.success) {
      return res.status(400).json({ message: "Invalid user ID or account status" });
    }
    if (userId === req.appUserId) {
      return res.status(400).json({ message: "You cannot change your own account status" });
    }

    try {
      const target = await storage.getUser(userId);
      if (!target) return res.status(404).json({ message: "User not found" });
      if (target.isAdmin || target.adminRole !== "user") {
        return res.status(403).json({ message: "Admin account status cannot be changed here" });
      }

      await db.update(users)
        .set({ accountStatus: parsed.data.status })
        .where(eq(users.id, userId));

      if (parsed.data.status !== "active") {
        await db.delete(sessions)
          .where(sql`${sessions.sess}->>'customAuthUsername' = ${target.username}`);
      }
      const action = parsed.data.status === "suspended"
        ? "admin:user_suspend"
        : parsed.data.status === "inactive"
          ? "admin:user_deactivate"
          : target.accountStatus === "suspended"
            ? "admin:user_unsuspend"
            : "admin:user_activate";
      await storage.createAuditLog({
        userId: req.appUserId,
        action,
        entityType: "user",
        entityId: userId,
        details: `Changed account status from ${target.accountStatus} to ${parsed.data.status}`,
        metadata: { fromStatus: target.accountStatus, toStatus: parsed.data.status },
      });
      res.json({ id: userId, accountStatus: parsed.data.status });
    } catch (error) {
      await recordAdminFailure(req.appUserId, "admin:user_status_change_failed", "user", userId, "Account status update failed");
      console.error("Admin account status update failed");
      res.status(500).json({ message: "Failed to update account status" });
    }
  });

  app.post("/api/admin/users/:userId/force-logout", async (req: any, res) => {
    const userId = Number(req.params.userId);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    if (userId === req.appUserId) {
      return res.status(400).json({ message: "You cannot force logout your own account" });
    }

    try {
      const target = await storage.getUser(userId);
      if (!target) return res.status(404).json({ message: "User not found" });
      if (target.isAdmin || target.adminRole !== "user") {
        return res.status(403).json({ message: "Privileged account sessions cannot be invalidated here" });
      }
      const deleted = await db.delete(sessions)
        .where(sql`${sessions.sess}->>'customAuthUsername' = ${target.username}`)
        .returning({ sid: sessions.sid });
      await storage.createAuditLog({
        userId: req.appUserId,
        action: "admin:force_logout",
        entityType: "user",
        entityId: userId,
        details: `Invalidated ${deleted.length} active session(s)`,
        metadata: { sessionsInvalidated: deleted.length },
      });
      res.json({ id: userId, sessionsInvalidated: deleted.length });
    } catch (error) {
      await recordAdminFailure(req.appUserId, "admin:force_logout_failed", "user", userId, "Session invalidation failed");
      console.error("Admin force logout failed");
      res.status(500).json({ message: "Failed to invalidate user sessions" });
    }
  });

  app.get("/api/admin/audit-logs", async (req: any, res) => {
    try {
      res.json(await adminStorage.getAuditLogPage(req.query));
    } catch (error) {
      console.error("Admin audit log query failed");
      res.status(500).json({ message: "Failed to load audit logs" });
    }
  });

  app.get("/api/admin/coupons", async (req: any, res) => {
    try {
      res.json(await adminStorage.getCouponPage(req.query));
    } catch {
      console.error("Admin coupon list query failed");
      res.status(500).json({ message: "Failed to load coupons" });
    }
  });

  app.post("/api/admin/coupons", async (req: any, res) => {
    const parsed = couponCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      await recordAdminFailure(req.appUserId, "admin:coupon_create_failed", "coupon", null, "Coupon creation rejected", { reason: "validation" });
      return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid coupon details" });
    }
    try {
      const coupon = await adminStorage.createCoupon({
        ...parsed.data,
        discountValue: String(parsed.data.discountValue),
        currentRedemptions: 0,
        createdBy: req.appUserId,
        updatedBy: req.appUserId,
      });
      await storage.createAuditLog({
        userId: req.appUserId,
        action: "admin:coupon_create",
        entityType: "coupon",
        entityId: coupon.id,
        details: `Created coupon ${coupon.code}`,
        metadata: { couponId: coupon.id, code: coupon.code, discountType: coupon.discountType },
      });
      res.status(201).json(coupon);
    } catch (error: any) {
      if (error?.code === "23505") {
        await recordAdminFailure(req.appUserId, "admin:coupon_create_failed", "coupon", null, "Coupon creation rejected", { reason: "duplicate_code" });
        return res.status(409).json({ message: "A coupon with this code already exists" });
      }
      await recordAdminFailure(req.appUserId, "admin:coupon_create_failed", "coupon", null, "Coupon creation failed");
      console.error("Admin coupon creation failed");
      res.status(500).json({ message: "Failed to create coupon" });
    }
  });

  app.patch("/api/admin/coupons/:couponId", async (req: any, res) => {
    const couponId = Number(req.params.couponId);
    const parsed = couponUpdateSchema.safeParse(req.body);
    if (!Number.isSafeInteger(couponId) || couponId <= 0 || !parsed.success || Object.keys(parsed.data || {}).length === 0) {
      await recordAdminFailure(req.appUserId, "admin:coupon_update_failed", "coupon", Number.isSafeInteger(couponId) && couponId > 0 ? couponId : null, "Coupon update rejected", { reason: "validation" });
      return res.status(400).json({ message: "Invalid coupon ID or update fields" });
    }
    try {
      const existing = await adminStorage.getCoupon(couponId);
      if (!existing) return res.status(404).json({ message: "Coupon not found" });
      const candidate = couponCreateSchema.safeParse({
        code: parsed.data.code ?? existing.code,
        description: parsed.data.description ?? existing.description,
        discountType: parsed.data.discountType ?? existing.discountType,
        discountValue: parsed.data.discountValue ?? Number(existing.discountValue),
        startsAt: parsed.data.startsAt ?? existing.startsAt,
        expiresAt: parsed.data.expiresAt ?? existing.expiresAt,
        maxRedemptions: parsed.data.maxRedemptions === undefined ? existing.maxRedemptions : parsed.data.maxRedemptions,
        isActive: parsed.data.isActive ?? existing.isActive,
      });
      if (!candidate.success) {
        await recordAdminFailure(req.appUserId, "admin:coupon_update_failed", "coupon", couponId, "Coupon update rejected", { reason: "validation" });
        return res.status(400).json({ message: candidate.error.issues[0]?.message || "Invalid coupon details" });
      }
      if (candidate.data.maxRedemptions !== null && candidate.data.maxRedemptions < existing.currentRedemptions) {
        await recordAdminFailure(req.appUserId, "admin:coupon_update_failed", "coupon", couponId, "Coupon update rejected", { reason: "redemption_limit" });
        return res.status(400).json({ message: "Maximum redemptions cannot be lower than redemptions already used" });
      }
      const updated = await adminStorage.updateCoupon(couponId, {
        ...candidate.data,
        discountValue: String(candidate.data.discountValue),
      }, req.appUserId);
      if (!updated) return res.status(404).json({ message: "Coupon not found" });
      const action = Object.keys(parsed.data).length === 1 && parsed.data.isActive === true
        ? "admin:coupon_activate"
        : Object.keys(parsed.data).length === 1 && parsed.data.isActive === false
          ? "admin:coupon_deactivate"
          : "admin:coupon_update";
      await storage.createAuditLog({
        userId: req.appUserId,
        action,
        entityType: "coupon",
        entityId: couponId,
        details: `Updated coupon ${updated.code}`,
        metadata: { couponId, changedKeys: Object.keys(parsed.data) },
      });
      res.json(updated);
    } catch (error: any) {
      if (error?.code === "23505") {
        await recordAdminFailure(req.appUserId, "admin:coupon_update_failed", "coupon", couponId, "Coupon update rejected", { reason: "duplicate_code" });
        return res.status(409).json({ message: "A coupon with this code already exists" });
      }
      await recordAdminFailure(req.appUserId, "admin:coupon_update_failed", "coupon", couponId, "Coupon update failed");
      console.error("Admin coupon update failed");
      res.status(500).json({ message: "Failed to update coupon" });
    }
  });

  app.delete("/api/admin/coupons/:couponId", async (req: any, res) => {
    const couponId = Number(req.params.couponId);
    if (!Number.isSafeInteger(couponId) || couponId <= 0) {
      return res.status(400).json({ message: "Invalid coupon ID" });
    }
    try {
      const existing = await adminStorage.getCoupon(couponId);
      if (!existing) return res.status(404).json({ message: "Coupon not found" });
      if (existing.currentRedemptions > 0) {
        await recordAdminFailure(req.appUserId, "admin:coupon_delete_failed", "coupon", couponId, "Coupon deletion rejected", { reason: "already_redeemed" });
        return res.status(409).json({ message: "Coupons with redemptions cannot be deleted; deactivate it instead" });
      }
      const deleted = await adminStorage.deleteCouponIfUnused(couponId);
      if (!deleted) {
        await recordAdminFailure(req.appUserId, "admin:coupon_delete_failed", "coupon", couponId, "Coupon deletion rejected", { reason: "already_redeemed" });
        return res.status(409).json({ message: "Coupon has been redeemed and can no longer be deleted" });
      }
      await storage.createAuditLog({
        userId: req.appUserId,
        action: "admin:coupon_delete",
        entityType: "coupon",
        entityId: couponId,
        details: `Deleted coupon ${existing.code}`,
        metadata: { couponId, code: existing.code },
      });
      res.json({ id: couponId, deleted: true });
    } catch {
      await recordAdminFailure(req.appUserId, "admin:coupon_delete_failed", "coupon", couponId, "Coupon deletion failed");
      console.error("Admin coupon deletion failed");
      res.status(500).json({ message: "Failed to delete coupon" });
    }
  });

  app.get("/api/admin/settings", async (_req: any, res) => {
    try {
      res.json(await adminStorage.getPlatformSettings());
    } catch {
      console.error("Admin platform settings query failed");
      res.status(500).json({ message: "Failed to load platform settings" });
    }
  });

  app.put("/api/admin/settings", async (req: any, res) => {
    const parsed = platformSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      await recordAdminFailure(req.appUserId, "admin:settings_update_failed", "platform_settings", null, "Platform settings update rejected", { reason: "validation" });
      return res.status(400).json({ message: parsed.error.issues[0]?.message || "Invalid platform settings" });
    }
    try {
      const previous = await adminStorage.getPlatformSettings();
      const updated = await adminStorage.updatePlatformSettings(parsed.data, req.appUserId);
      const changedKeys = Object.keys(parsed.data).filter(key => previous[key as keyof typeof previous] !== parsed.data[key as keyof typeof parsed.data]);
      if (changedKeys.length) {
        await storage.createAuditLog({
          userId: req.appUserId,
          action: "admin:settings_update",
          entityType: "platform_settings",
          entityId: null,
          details: "Updated platform settings",
          metadata: { changedKeys },
        });
      }
      res.json(updated);
    } catch {
      await recordAdminFailure(req.appUserId, "admin:settings_update_failed", "platform_settings", null, "Platform settings update failed");
      console.error("Admin platform settings update failed");
      res.status(500).json({ message: "Failed to update platform settings" });
    }
  });

  app.get("/api/admin/transactions", async (_req: any, res) => {
    res.json(await storage.getAllTransactions());
  });

  app.get("/api/admin/debts", async (_req: any, res) => {
    res.json(await storage.getAllDebts());
  });

  app.get("/api/admin/split-bills", async (_req: any, res) => {
    res.json(await storage.getAllBillSplits());
  });

  // Debts (Udhari Khata)
  app.get("/api/profiles/:profileId/debts", isAuthenticated, async (req, res) => {
    const debts = await storage.getDebts(Number(req.params.profileId));
    const month = req.query.month ? Number(req.query.month) : null;
    const year = req.query.year ? Number(req.query.year) : null;
    
    if (month !== null && year !== null) {
      const filtered = debts.filter((d: any) => {
        const d_date = new Date(d.date);
        return d_date.getMonth() + 1 === month && d_date.getFullYear() === year;
      });
      return res.json(filtered);
    }
    
    res.json(debts);
  });

  app.post("/api/profiles/:profileId/debts", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = Number(req.params.profileId);
      const body = {
        ...req.body,
        amount: req.body.amount?.toString(),
        date: req.body.date ? new Date(req.body.date) : new Date()
      };
      
      const debt = await storage.createDebt({ ...body, profileId });
      
      res.status(201).json(debt);
    } catch (err) {
      res.status(400).json({ message: 'Invalid input' });
    }
  });

  app.patch("/api/debts/:id", isAuthenticated, async (req, res) => {
    try {
      const body = {
        ...req.body,
        ...(req.body.amount !== undefined && { amount: req.body.amount.toString() }),
        ...(req.body.date !== undefined && { date: new Date(req.body.date) }),
      };
      const debt = await storage.updateDebt(Number(req.params.id), body);
      res.json(debt);
    } catch (err) {
      console.error("Patch debt error:", err);
      res.status(400).json({ message: "Failed to update debt record" });
    }
  });

  app.patch("/api/debts/:id/settle", isAuthenticated, async (req, res) => {
    try {
      const { settledAmount, status } = req.body;
      const isFullySettled = String(status) === 'settled';
      const [updated] = await db
        .update(debts)
        .set({
          settledAmount: String(settledAmount),
          status: String(status),
          settledAt: isFullySettled ? new Date() : null,
        })
        .where(eq(debts.id, Number(req.params.id)))
        .returning();
      res.json(updated);
    } catch (err) {
      console.error("Settle debt error:", err);
      res.status(400).json({ message: "Failed to settle debt" });
    }
  });

  app.delete("/api/debts/:id", isAuthenticated, async (req, res) => {
    await storage.deleteDebt(Number(req.params.id));
    res.status(204).send();
  });

  // Split Bills
  app.get("/api/profiles/:profileId/bill-splits", isAuthenticated, async (req, res) => {
    const splits = await storage.getBillSplits(Number(req.params.profileId));
    const month = req.query.month ? Number(req.query.month) : null;
    const year = req.query.year ? Number(req.query.year) : null;
    
    if (month !== null && year !== null) {
      const filtered = splits.filter((s: any) => {
        const s_date = new Date(s.date);
        return s_date.getMonth() + 1 === month && s_date.getFullYear() === year;
      });
      return res.json(filtered);
    }
    
    res.json(splits);
  });

  app.post("/api/profiles/:profileId/bill-splits", isAuthenticated, async (req: any, res) => {
    try {
      const { split, participants } = req.body;
      const profileId = Number(req.params.profileId);
      const splitDate = split?.date ? new Date(split.date) : new Date();
      const normalizedParticipants = Array.isArray(participants) ? participants.map((p: any) => ({
        contactName: p.contactName ?? p.name ?? "",
        contactPhone: p.contactPhone ?? p.phone ?? "",
        amount: String(p.amount ?? 0),
        billSplitId: 0
      })) : [];
      const totalAmount = split?.amount ?? normalizedParticipants.reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0);
      
      const newSplit = await storage.createBillSplit(
        {
          profileId,
          description: split.description,
          totalAmount: String(totalAmount),
          date: splitDate
        },
        normalizedParticipants
      );
      await Promise.all(
        normalizedParticipants.map((p: any) =>
          storage.createDebt({
            profileId,
            type: 'gave',
            contactName: p.contactName,
            contactPhone: p.contactPhone,
            amount: String(p.amount),
            note: `Split: ${split.description}`,
            date: splitDate,
            status: 'pending'
          })
        )
      );

      // Add a category check to help user see categories
      const existingCategories = await storage.getCategories(profileId);
      if (existingCategories.length === 0) {
        console.log("No categories found for profile, creating defaults...");
        // This is a safety catch for existing users who might have missed the initial trigger
      }

      res.status(201).json(newSplit);
    } catch (err) {
      console.error("Split Create Error:", err);
      res.status(400).json({ message: 'Failed to create split' });
    }
  });

  app.delete("/api/bill-splits/:id", isAuthenticated, async (req, res) => {
    await storage.deleteBillSplit(Number(req.params.id));
    res.status(204).send();
  });

  app.patch("/api/bill-split-participants/:id/settle", isAuthenticated, async (req, res) => {
    try {
      const { settledAmount, isFullySettled } = req.body;
      const participant = await storage.updateBillSplitParticipant(Number(req.params.id), {
        settledAmount: String(settledAmount),
        isSettled: !!isFullySettled,
      });
      res.json(participant);
    } catch (err) {
      console.error("Settle participant error:", err);
      res.status(400).json({ message: "Failed to settle participant" });
    }
  });

  app.post("/api/profiles/:profileId/rules", isAuthenticated, async (req: any, res) => {
    const input = req.body;
    const rule = await storage.createCategoryRule({ ...input, profileId: Number(req.params.profileId) });
    res.status(201).json(rule);
  });


  // === WEALTH / NET WORTH ROUTES (Snapshot-Centric) ===

  // Helper: verify profile ownership
  async function assertProfileOwner(req: any, res: any, profileId: number): Promise<boolean> {
    const profile = await storage.getProfile(profileId);
    if (!profile || profile.userId !== req.appUserId) {
      res.status(403).json({ message: "Access denied" });
      return false;
    }
    return true;
  }

  // Helper: verify snapshot belongs to a profile that this user owns
  async function assertSnapshotOwner(req: any, res: any, snapshotId: number): Promise<{ snap: any; ok: boolean }> {
    const [row] = await db.select().from(wealthSnapshots).where(eq(wealthSnapshots.id, snapshotId));
    if (!row) { res.status(404).json({ message: "Snapshot not found" }); return { snap: null, ok: false }; }
    const ok = await assertProfileOwner(req, res, row.profileId);
    return { snap: row, ok };
  }

  // List all snapshots (headers only)
  app.get("/api/profiles/:profileId/wealth-snapshots", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = Number(req.params.profileId);
      if (!(await assertProfileOwner(req, res, profileId))) return;
      const snaps = await storage.getWealthSnapshots(profileId);
      res.json(snaps);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch wealth snapshots" });
    }
  });

  // Get single snapshot with all rows
  app.get("/api/wealth-snapshots/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const { ok } = await assertSnapshotOwner(req, res, id);
      if (!ok) return;
      const snap = await storage.getWealthSnapshot(id);
      if (!snap) return res.status(404).json({ message: "Snapshot not found" });
      res.json(snap);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch snapshot" });
    }
  });

  // Get latest snapshot with rows (for prefill on new snapshot form)
  app.get("/api/profiles/:profileId/wealth-snapshots/latest", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = Number(req.params.profileId);
      if (!(await assertProfileOwner(req, res, profileId))) return;
      const snap = await storage.getLatestWealthSnapshot(profileId);
      res.json(snap ?? null);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch latest snapshot" });
    }
  });

  // Create snapshot with all rows
  app.post("/api/profiles/:profileId/wealth-snapshots", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = Number(req.params.profileId);
      if (!(await assertProfileOwner(req, res, profileId))) return;

      const parseRows = (rows: any[], numericFields: string[]) =>
        (rows || []).map((r: any) => {
          const out: any = { ...r };
          for (const f of numericFields) {
            if (out[f] !== undefined) out[f] = (Number(out[f]) || 0).toString();
          }
          if (out.acquisitionDate) out.acquisitionDate = new Date(out.acquisitionDate);
          delete out.id;
          delete out.snapshotId;
          return out;
        });

      const snap = await storage.createWealthSnapshot({
        profileId,
        label: req.body.label ?? "",
        snapshotDate: req.body.snapshotDate ? new Date(req.body.snapshotDate) : new Date(),
        frequency: req.body.frequency || "manual",
        notes: req.body.notes ?? null,
        immovableRows: parseRows(req.body.immovableRows, ["purchaseValue","currentValue","loanOutstanding","monthlyRentalIncome"]),
        movableRows: parseRows(req.body.movableRows, ["purchaseValue","currentValue","loanOutstanding"]),
        otherRows: parseRows(req.body.otherRows, ["investedAmount","currentValue"]),
      });
      res.status(201).json(snap);
    } catch (err) {
      console.error("Create wealth snapshot error:", err);
      res.status(500).json({ message: "Failed to create wealth snapshot" });
    }
  });

  // Update snapshot handler (shared logic for PUT and PATCH)
  const handleUpdateWealthSnapshot = async (req: any, res: any) => {
    try {
      const id = Number(req.params.id);
      const { ok } = await assertSnapshotOwner(req, res, id);
      if (!ok) return;

      const parseRows = (rows: any[] | undefined, numericFields: string[]) => {
        if (rows === undefined) return undefined;
        return rows.map((r: any) => {
          const out: any = { ...r };
          for (const f of numericFields) {
            if (out[f] !== undefined) out[f] = (Number(out[f]) || 0).toString();
          }
          if (out.acquisitionDate) out.acquisitionDate = new Date(out.acquisitionDate);
          delete out.id;
          delete out.snapshotId;
          return out;
        });
      };

      const snap = await storage.updateWealthSnapshot(id, {
        ...(req.body.label !== undefined && { label: req.body.label }),
        ...(req.body.snapshotDate !== undefined && { snapshotDate: new Date(req.body.snapshotDate) }),
        ...(req.body.frequency !== undefined && { frequency: req.body.frequency }),
        ...(req.body.notes !== undefined && { notes: req.body.notes }),
        immovableRows: parseRows(req.body.immovableRows, ["purchaseValue","currentValue","loanOutstanding","monthlyRentalIncome"]),
        movableRows: parseRows(req.body.movableRows, ["purchaseValue","currentValue","loanOutstanding"]),
        otherRows: parseRows(req.body.otherRows, ["investedAmount","currentValue"]),
      });
      res.json(snap);
    } catch (err) {
      console.error("Update wealth snapshot error:", err);
      res.status(500).json({ message: "Failed to update wealth snapshot" });
    }
  };
  app.put("/api/wealth-snapshots/:id", isAuthenticated, handleUpdateWealthSnapshot);
  app.patch("/api/wealth-snapshots/:id", isAuthenticated, handleUpdateWealthSnapshot);

  // Delete snapshot and all rows
  app.delete("/api/wealth-snapshots/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const { ok } = await assertSnapshotOwner(req, res, id);
      if (!ok) return;
      await storage.deleteWealthSnapshot(id);
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "Failed to delete wealth snapshot" });
    }
  });

  // Wealth analytics: net worth trend + latest snapshot
  app.get("/api/profiles/:profileId/wealth-analytics", isAuthenticated, async (req: any, res) => {
    try {
      const profileId = Number(req.params.profileId);
      if (!(await assertProfileOwner(req, res, profileId))) return;
      const analytics = await storage.getWealthAnalytics(profileId);
      res.json(analytics);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch wealth analytics" });
    }
  });

  app.post("/api/user/upgrade", isAuthenticated, async (req: any, res) => {
    try {
      const [updated] = await db.update(users)
        .set({ subscriptionStatus: 'paid' })
        .where(eq(users.id, req.appUserId))
        .returning();
      console.log("User upgraded to Pro:", updated);
      res.json(updated);
    } catch (err) {
      console.error("Upgrade failed:", err);
      res.status(500).json({ message: 'Upgrade failed' });
    }
  });

  return httpServer;
}

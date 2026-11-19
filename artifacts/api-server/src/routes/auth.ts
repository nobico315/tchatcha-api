import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/authMiddleware";
import { createAgentOnboardingNotifications } from "../lib/onboardingNotifications";

const router = Router();

const pendingPinResets = new Map<string, { code: string; expiresAt: number }>();

function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  const hashed = scryptSync(pin, salt, 64).toString("hex");
  return `${salt}:${hashed}`;
}

function verifyPin(pin: string, storedHash: string): boolean {
  const [salt, hashed] = storedHash.split(":");
  if (!salt || !hashed) return false;
  const testHash = scryptSync(pin, salt, 64).toString("hex");
  return timingSafeEqual(Buffer.from(hashed, "hex"), Buffer.from(testHash, "hex"));
}

router.post("/register", async (req, res): Promise<void> => {
  const { firstName, lastName, phone, pin, role, managerId, inviteCode } = req.body;

  if (!firstName || !lastName || !phone || !pin || !role) {
    res.status(400).json({ success: false, error: "Champs requis manquants." });
    return;
  }

  try {
    const existing = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.phone, phone))
      .limit(1);

    if (existing.length > 0) {
      res.status(400).json({ success: false, error: "Ce numéro de téléphone est déjà utilisé." });
      return;
    }

    let resolvedManagerId = managerId || null;

    // Resolve invite code if passed and role is agent
    if (!resolvedManagerId && inviteCode && typeof inviteCode === "string" && inviteCode.trim()) {
      const cleanCode = inviteCode.trim().toUpperCase();
      const managers = await db.select().from(usersTable).where(eq(usersTable.role, "gerant"));
      const matched = managers.find((m) => {
        const prefix = (m.firstName.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4) || "MGR").padEnd(4, "X");
        const suffix = m.phone.replace(/[^0-9]/g, "").slice(-4) || "0000";
        return `${prefix}-${suffix}` === cleanCode;
      });
      if (matched) {
        resolvedManagerId = matched.id;
      }
    }

    const userId = Date.now().toString() + Math.random().toString(36).substring(2, 11);
    const hashedPin = hashPin(pin);
    const subscriptionExpiry = new Date();
    subscriptionExpiry.setDate(subscriptionExpiry.getDate() + 90); // 3 months (90 days) free trial

    await db.insert(usersTable).values({
      id: userId,
      firstName,
      lastName,
      phone,
      pin: hashedPin,
      role,
      managerId: resolvedManagerId,
      subscriptionExpiry,
    });

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    // Create session
    const sessionToken = randomBytes(32).toString("hex");
    const sessionId = randomBytes(16).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // Session valid for 30 days

    await db.insert(sessionsTable).values({
      id: sessionId,
      userId,
      token: sessionToken,
      expiresAt,
    });

    if (role === "agent") {
      try {
        await createAgentOnboardingNotifications(userId);
      } catch (error) {
        console.warn("[AUTH] Failed to create onboarding notifications:", error);
      }
    }

    res.cookie("session_token", sessionToken, {
      httpOnly: true,
      expires: expiresAt,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    let managerInfo = null;
    if (user.managerId) {
      try {
        const [mgr] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.id, user.managerId))
          .limit(1);
        if (mgr) {
          managerInfo = {
            id: mgr.id,
            firstName: mgr.firstName,
            lastName: mgr.lastName,
            phone: mgr.phone,
          };
        }
      } catch {}
    }

    res.json({
      success: true,
      token: sessionToken,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role as "agent" | "gerant",
        managerId: user.managerId,
        subscriptionExpiry: user.subscriptionExpiry,
        createdAt: user.createdAt,
        manager: managerInfo,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Erreur interne lors de l'inscription." });
  }
});

router.post("/login", async (req, res): Promise<void> => {
  const { phone, pin } = req.body;

  if (!phone || !pin) {
    res.status(400).json({ success: false, error: "Numéro de téléphone et PIN requis." });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.phone, phone))
      .limit(1);

    if (!user || !verifyPin(pin, user.pin)) {
      res.status(401).json({ success: false, error: "Numéro de téléphone ou PIN incorrect." });
      return;
    }

    // Create session
    const sessionToken = randomBytes(32).toString("hex");
    const sessionId = randomBytes(16).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await db.insert(sessionsTable).values({
      id: sessionId,
      userId: user.id,
      token: sessionToken,
      expiresAt,
    });

    res.cookie("session_token", sessionToken, {
      httpOnly: true,
      expires: expiresAt,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    let managerInfo = null;
    if (user.managerId) {
      const [mgr] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, user.managerId))
        .limit(1);
      if (mgr) {
        managerInfo = {
          id: mgr.id,
          firstName: mgr.firstName,
          lastName: mgr.lastName,
          phone: mgr.phone,
        };
      }
    }

    res.json({
      success: true,
      token: sessionToken,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role as "agent" | "gerant",
        managerId: user.managerId,
        subscriptionExpiry: user.subscriptionExpiry,
        createdAt: user.createdAt,
        manager: managerInfo,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Erreur interne lors de la connexion." });
  }
});

router.post("/logout", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  try {
    if (authReq.session) {
      await db.delete(sessionsTable).where(eq(sessionsTable.id, authReq.session.id));
    }
    res.clearCookie("session_token");
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: "Erreur serveur lors de la déconnexion." });
  }
});

router.get("/me", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user!;
  
  let managerInfo = null;
  if (user.managerId) {
    try {
      const [mgr] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, user.managerId))
        .limit(1);
      if (mgr) {
        managerInfo = {
          id: mgr.id,
          firstName: mgr.firstName,
          lastName: mgr.lastName,
          phone: mgr.phone,
        };
      }
    } catch {}
  }

  res.json({
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    role: user.role as "agent" | "gerant",
    managerId: user.managerId,
    subscriptionExpiry: user.subscriptionExpiry,
    createdAt: user.createdAt,
    manager: managerInfo,
  });
});

router.patch("/profile", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user!;
  const firstName = typeof req.body?.firstName === "string" ? req.body.firstName.trim() : "";
  const lastName = typeof req.body?.lastName === "string" ? req.body.lastName.trim() : "";

  if (!firstName || !lastName) {
    res.status(400).json({ success: false, error: "Le prénom et le nom sont requis." });
    return;
  }

  try {
    await db
      .update(usersTable)
      .set({ firstName, lastName })
      .where(eq(usersTable.id, user.id));

    res.json({
      success: true,
      user: {
        id: user.id,
        firstName,
        lastName,
        phone: user.phone,
        role: user.role as "agent" | "gerant",
        managerId: user.managerId,
        subscriptionExpiry: user.subscriptionExpiry,
        createdAt: user.createdAt,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: "Erreur lors de la mise à jour du profil." });
  }
});

router.post("/change-pin", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user!;
  const currentPin = typeof req.body?.currentPin === "string" ? req.body.currentPin : "";
  const newPin = typeof req.body?.newPin === "string" ? req.body.newPin : "";

  if (!/^\d{6}$/.test(newPin)) {
    res.status(400).json({ success: false, error: "Le nouveau code PIN doit contenir 6 chiffres." });
    return;
  }

  if (!currentPin || !verifyPin(currentPin, user.pin)) {
    res.status(401).json({ success: false, error: "Code PIN actuel incorrect." });
    return;
  }

  try {
    await db
      .update(usersTable)
      .set({ pin: hashPin(newPin) })
      .where(eq(usersTable.id, user.id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: "Erreur lors de la modification du code PIN." });
  }
});

router.post("/forgot-pin/request", async (req, res): Promise<void> => {
  const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
  if (!phone) {
    res.status(400).json({ success: false, error: "Numéro de téléphone requis." });
    return;
  }

  try {
    const [user] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.phone, phone))
      .limit(1);

    if (!user) {
      res.status(404).json({ success: false, error: "Aucun compte associé à ce numéro." });
      return;
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    pendingPinResets.set(phone, { code, expiresAt: Date.now() + 10 * 60 * 1000 });
    console.info(`[AUTH] Code OTP de réinitialisation pour ${phone}: ${code}`);

    res.json({
      success: true,
      ...(process.env.NODE_ENV !== "production" ? { devOtp: code } : {}),
    });
  } catch {
    res.status(500).json({ success: false, error: "Erreur lors de la demande de réinitialisation." });
  }
});

router.post("/forgot-pin/reset", async (req, res): Promise<void> => {
  const phone = typeof req.body?.phone === "string" ? req.body.phone.trim() : "";
  const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";
  const newPin = typeof req.body?.newPin === "string" ? req.body.newPin.trim() : "";

  if (!phone || !otp || !/^\d{6}$/.test(newPin)) {
    res.status(400).json({ success: false, error: "Numéro, code OTP et nouveau PIN à 6 chiffres requis." });
    return;
  }

  const entry = pendingPinResets.get(phone);
  if (!entry || entry.expiresAt < Date.now() || entry.code !== otp) {
    res.status(400).json({ success: false, error: "Code de vérification invalide ou expiré." });
    return;
  }

  try {
    await db
      .update(usersTable)
      .set({ pin: hashPin(newPin) })
      .where(eq(usersTable.phone, phone));

    pendingPinResets.delete(phone);
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: "Erreur lors de la réinitialisation du code PIN." });
  }
});

export default router;

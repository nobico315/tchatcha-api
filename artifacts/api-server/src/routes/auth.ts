import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/authMiddleware";

const router = Router();

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
  const { firstName, lastName, phone, pin, role, managerId } = req.body;

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

    const userId = Date.now().toString() + Math.random().toString(36).substring(2, 11);
    const hashedPin = hashPin(pin);
    const subscriptionExpiry = new Date();
    subscriptionExpiry.setDate(subscriptionExpiry.getDate() + 30); // 30 days trial

    await db.insert(usersTable).values({
      id: userId,
      firstName,
      lastName,
      phone,
      pin: hashedPin,
      role,
      managerId: managerId || null,
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

export default router;

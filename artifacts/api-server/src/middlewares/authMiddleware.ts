import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { sessionsTable, usersTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";

export interface AuthenticatedRequest extends Request {
  user?: typeof usersTable.$inferSelect;
  session?: typeof sessionsTable.$inferSelect;
}

// Routes that remain accessible even with an expired subscription
// Uses originalUrl (full path) to work regardless of router nesting
const SUBSCRIPTION_EXEMPT_PATHS = [
  "/auth/login",
  "/auth/register",
  "/auth/logout",
  "/auth/me",
  "/auth/forgot-pin",
  "/healthz",
  "/health",
];

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authReq = req as AuthenticatedRequest;
  
  let token = req.cookies?.session_token;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    res.status(412).json({ error: "Non authentifié. Session requise." });
    return;
  }

  try {
    const now = new Date();
    
    // Find valid session
    const [session] = await db
      .select()
      .from(sessionsTable)
      .where(
        and(
          eq(sessionsTable.token, token),
          gt(sessionsTable.expiresAt, now)
        )
      )
      .limit(1);

    if (!session) {
      res.status(412).json({ error: "Session expirée ou invalide." });
      return;
    }

    // Find associated user
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, session.userId))
      .limit(1);

    if (!user) {
      res.status(412).json({ error: "Utilisateur introuvable." });
      return;
    }

    // Check subscription expiry (exempt certain routes)
    const isExempt = SUBSCRIPTION_EXEMPT_PATHS.some((p) => req.originalUrl.startsWith(p));
    if (!isExempt && user.subscriptionExpiry && new Date(user.subscriptionExpiry) < now) {
      res.status(402).json({
        error: "Abonnement expiré. Veuillez renouveler votre abonnement pour continuer.",
        code: "SUBSCRIPTION_EXPIRED",
      });
      return;
    }

    authReq.user = user;
    authReq.session = session;
    next();
  } catch (error) {
    res.status(500).json({ error: "Erreur interne lors de la vérification de la session." });
  }
}

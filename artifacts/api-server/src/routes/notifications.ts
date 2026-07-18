import { Router } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/authMiddleware";
import { randomBytes } from "crypto";

const router = Router();

// GET / — Récupérer toutes les notifications de l'utilisateur connecté
router.get("/", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user!.id;

  try {
    const notifs = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.userId, userId))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);

    res.json(notifs);
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération des notifications." });
  }
});

// POST /:id/read — Marquer une notification comme lue
router.post("/:id/read", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user!.id;
  const { id } = req.params;

  try {
    await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId)));

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la mise à jour." });
  }
});

// POST /read-all — Marquer toutes les notifications comme lues
router.post("/read-all", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user!.id;

  try {
    await db
      .update(notificationsTable)
      .set({ isRead: true })
      .where(eq(notificationsTable.userId, userId));

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la mise à jour." });
  }
});

export default router;

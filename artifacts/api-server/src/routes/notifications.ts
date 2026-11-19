import { Router } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, desc, and, gte } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/authMiddleware";
import { randomBytes } from "crypto";

const router = Router();

function makeNotificationId(): string {
  return randomBytes(12).toString("hex");
}

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

// POST /low-balance — Notify the agent and their manager at the 10,000 and 5,000 FCFA thresholds.
router.post("/low-balance", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const agent = authReq.user!;
  const operator = req.body?.operator;
  const balance = Number(req.body?.balance);
  const threshold = Number(req.body?.threshold);

  if (agent.role !== "agent") {
    res.status(403).json({ error: "Cette alerte est réservée aux agents." });
    return;
  }
  if (!["MTN", "Moov", "Celtis"].includes(operator) || ![5_000, 10_000].includes(threshold) || !Number.isFinite(balance) || balance < 0 || balance > threshold) {
    res.status(400).json({ error: "Opérateur ou solde invalide." });
    return;
  }

  const thresholdLabel = threshold === 10_000 ? "Préalerte" : "Alerte critique";
  const title = `${thresholdLabel} de solde SIM · ${operator}`;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    const recipients = [
      {
        userId: agent.id,
        body: `Votre solde virtuel ${operator} est de ${balance.toLocaleString("fr-FR")} FCFA (seuil d'alerte : ${threshold.toLocaleString("fr-FR")} FCFA). Pensez à le recharger.`,
      },
      ...(agent.managerId
        ? [{
            userId: agent.managerId,
            body: `Le solde virtuel ${operator} de ${agent.firstName} ${agent.lastName} est de ${balance.toLocaleString("fr-FR")} FCFA (seuil d'alerte : ${threshold.toLocaleString("fr-FR")} FCFA).`,
          }]
        : []),
    ];

    const created: Array<{ id: string; userId: string; type: string; title: string; body: string; isRead: boolean; createdAt: string }> = [];
    for (const recipient of recipients) {
      const [existing] = await db
        .select({ id: notificationsTable.id })
        .from(notificationsTable)
        .where(and(
          eq(notificationsTable.userId, recipient.userId),
          eq(notificationsTable.type, "balance"),
          eq(notificationsTable.title, title),
          gte(notificationsTable.createdAt, today),
        ))
        .limit(1);

      if (existing) continue;

      const notification = {
        id: makeNotificationId(),
        userId: recipient.userId,
        type: "balance",
        title,
        body: recipient.body,
        isRead: false,
        createdAt: new Date(),
      };
      await db.insert(notificationsTable).values(notification);
      created.push({ ...notification, createdAt: notification.createdAt.toISOString() });
    }

    res.json({ success: true, notifications: created });
  } catch {
    res.status(500).json({ error: "Erreur lors de l'envoi de l'alerte de solde." });
  }
});

// POST /:id/read — Marquer une notification comme lue
router.post("/:id/read", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const userId = authReq.user!.id;
  const id = req.params.id as string;

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

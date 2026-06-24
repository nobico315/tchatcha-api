import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable, transactionLogsTable, savedClientsTable, usersTable, daySessionsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/authMiddleware";

const router = Router();

router.post("/", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const agent = authReq.user!;
  const { id, type, clientName, clientPhone, amount, operator, note, savedClient, saleMode, createdAt } = req.body;

  if (!id || !type || !clientName || !clientPhone || amount === undefined || !operator || createdAt === undefined) {
    res.status(400).json({ error: "Champs requis manquants." });
    return;
  }

  const today = new Date().toISOString().split("T")[0];

  try {
    const [session] = await db
      .select()
      .from(daySessionsTable)
      .where(and(eq(daySessionsTable.agentId, agent.id), eq(daySessionsTable.date, today), eq(daySessionsTable.isOpen, true)))
      .limit(1);

    if (!session) {
      res.status(400).json({ error: "Vous devez ouvrir votre journée avant d'enregistrer des transactions." });
      return;
    }

    await db.insert(transactionsTable).values({
      id,
      type,
      clientName,
      clientPhone,
      amount,
      operator,
      note: note || null,
      savedClient: !!savedClient,
      saleMode: saleMode || null,
      agentId: agent.id,
      createdAt: new Date(createdAt),
    });

    if (savedClient) {
      const cleanPhone = clientPhone.replace(/[^0-9]/g, "");
      const [existingClient] = await db
        .select()
        .from(savedClientsTable)
        .where(eq(savedClientsTable.phone, cleanPhone))
        .limit(1);

      if (existingClient) {
        if (existingClient.name !== clientName) {
          await db
            .update(savedClientsTable)
            .set({ name: clientName })
            .where(eq(savedClientsTable.id, existingClient.id));
        }
      } else {
        const clientUuid = Date.now().toString() + Math.random().toString(36).substring(2, 11);
        await db.insert(savedClientsTable).values({
          id: clientUuid,
          name: clientName,
          phone: cleanPhone,
        });
      }
    }

    const [tx] = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, id))
      .limit(1);

    res.json({
      id: tx.id,
      type: tx.type as "depot" | "retrait" | "vente",
      clientName: tx.clientName,
      clientPhone: tx.clientPhone,
      amount: tx.amount,
      operator: tx.operator as "MTN" | "Moov" | "Celtis",
      note: tx.note,
      savedClient: tx.savedClient,
      saleMode: tx.saleMode as "credit" | "forfait",
      agentId: tx.agentId,
      createdAt: tx.createdAt.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de l'enregistrement de la transaction." });
  }
});

router.get("/", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user!;

  try {
    let txs;
    if (user.role === "gerant") {
      const agents = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.managerId, user.id));

      const agentIds = agents.map((a) => a.id);
      if (agentIds.length === 0) {
        res.json([]);
        return;
      }

      txs = await db
        .select()
        .from(transactionsTable)
        .where(inArray(transactionsTable.agentId, agentIds));
    } else {
      txs = await db
        .select()
        .from(transactionsTable)
        .where(eq(transactionsTable.agentId, user.id));
    }

    txs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    res.json(
      txs.map((tx) => ({
        id: tx.id,
        type: tx.type as "depot" | "retrait" | "vente",
        clientName: tx.clientName,
        clientPhone: tx.clientPhone,
        amount: tx.amount,
        operator: tx.operator as "MTN" | "Moov" | "Celtis",
        note: tx.note,
        savedClient: tx.savedClient,
        saleMode: tx.saleMode as "credit" | "forfait",
        agentId: tx.agentId,
        createdAt: tx.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération des transactions." });
  }
});

router.put("/:id", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user!;
  const id = req.params.id as string;
  const changes = req.body;

  try {
    const [tx] = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, id))
      .limit(1);

    if (!tx) {
      res.status(404).json({ error: "Transaction non trouvée." });
      return;
    }

    if (tx.agentId !== user.id) {
      const [agent] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, tx.agentId))
        .limit(1);

      if (!agent || agent.managerId !== user.id) {
        res.status(403).json({ error: "Non autorisé à modifier cette transaction." });
        return;
      }
    }

    const logId = Date.now().toString() + Math.random().toString(36).substring(2, 11);
    await db.insert(transactionLogsTable).values({
      id: logId,
      transactionId: id,
      action: "edited",
      agentId: tx.agentId,
      userId: user.id,
      changes: changes,
    });

    await db
      .update(transactionsTable)
      .set({
        type: changes.type ?? tx.type,
        clientName: changes.clientName ?? tx.clientName,
        clientPhone: changes.clientPhone ?? tx.clientPhone,
        amount: changes.amount !== undefined ? changes.amount : tx.amount,
        operator: changes.operator ?? tx.operator,
        note: changes.note !== undefined ? changes.note : tx.note,
        savedClient: changes.savedClient !== undefined ? !!changes.savedClient : tx.savedClient,
        saleMode: changes.saleMode !== undefined ? changes.saleMode : tx.saleMode,
      })
      .where(eq(transactionsTable.id, id));

    const [updatedTx] = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, id))
      .limit(1);

    res.json({
      id: updatedTx.id,
      type: updatedTx.type as "depot" | "retrait" | "vente",
      clientName: updatedTx.clientName,
      clientPhone: updatedTx.clientPhone,
      amount: updatedTx.amount,
      operator: updatedTx.operator as "MTN" | "Moov" | "Celtis",
      note: updatedTx.note,
      savedClient: updatedTx.savedClient,
      saleMode: updatedTx.saleMode as "credit" | "forfait",
      agentId: updatedTx.agentId,
      createdAt: updatedTx.createdAt.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la modification de la transaction." });
  }
});

router.delete("/:id", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user!;
  const id = req.params.id as string;

  try {
    const [tx] = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, id))
      .limit(1);

    if (!tx) {
      res.status(404).json({ error: "Transaction non trouvée." });
      return;
    }

    if (tx.agentId !== user.id) {
      const [agent] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, tx.agentId))
        .limit(1);

      if (!agent || agent.managerId !== user.id) {
        res.status(403).json({ error: "Non autorisé à supprimer cette transaction." });
        return;
      }
    }

    const logId = Date.now().toString() + Math.random().toString(36).substring(2, 11);
    await db.insert(transactionLogsTable).values({
      id: logId,
      transactionId: id,
      action: "deleted",
      agentId: tx.agentId,
      userId: user.id,
      changes: tx,
    });

    await db.delete(transactionsTable).where(eq(transactionsTable.id, id));

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la suppression de la transaction." });
  }
});

router.get("/logs", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user!;

  try {
    let logs;
    if (user.role === "gerant") {
      const agents = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.managerId, user.id));

      const agentIds = agents.map((a) => a.id);
      if (agentIds.length === 0) {
        res.json([]);
        return;
      }

      logs = await db
        .select()
        .from(transactionLogsTable)
        .where(inArray(transactionLogsTable.agentId, agentIds));
    } else {
      logs = await db
        .select()
        .from(transactionLogsTable)
        .where(eq(transactionLogsTable.agentId, user.id));
    }

    logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    res.json(
      logs.map((log) => ({
        id: log.id,
        transactionId: log.transactionId,
        action: log.action as "deleted" | "edited",
        agentId: log.agentId,
        userId: log.userId,
        timestamp: log.timestamp.toISOString(),
        changes: log.changes,
      }))
    );
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération des logs." });
  }
});

export default router;

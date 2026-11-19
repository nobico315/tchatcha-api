import { Router } from "express";
import { db } from "@workspace/db";
import { transactionsTable, transactionLogsTable, savedClientsTable, usersTable, daySessionsTable, productsTable, productSalesTable } from "@workspace/db";
import { eq, and, inArray, gte } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/authMiddleware";

const router = Router();

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 11);
}

function parsePaid(value: unknown): boolean {
  if (value === false || value === "false") return false;
  if (value === true || value === "true") return true;
  return true;
}

router.post("/", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const agent = authReq.user!;
  const { id, type, clientName, clientPhone, amount, operator, note, savedClient, saleMode, createdAt, paid } = req.body;
  const normalizedPaid = parsePaid(paid);

  const normalizedPhone = typeof clientPhone === "string" ? clientPhone.trim() : "";
  const resolvedClientPhone = normalizedPhone || (type === "recharge" ? "0000000000" : "");
  const requiresPhone = type === "vente"; // only 'vente' requires a real client phone
  const missing: string[] = [];
  if (!id) missing.push("id");
  if (!type) missing.push("type");
  if (!clientName) missing.push("clientName");
  if (requiresPhone && !resolvedClientPhone) missing.push("clientPhone");
  if (amount === undefined) missing.push("amount");
  if (!operator) missing.push("operator");
  if (createdAt === undefined) missing.push("createdAt");

  if (missing.length > 0) {
    console.warn("[TX] Missing fields on create transaction:", missing, "payload:", req.body);
    res.status(400).json({ error: "Champs requis manquants.", missing });
    return;
  }

  const today = new Date().toISOString().split("T")[0];

  try {
    await db.insert(transactionsTable).values({
      id,
      type,
      clientName,
      clientPhone: resolvedClientPhone,
      amount,
      operator,
      note: note || null,
      paid: normalizedPaid,
      savedClient: !!savedClient,
      saleMode: saleMode || null,
      agentId: agent.id,
      createdAt: new Date(createdAt),
    });

    if (savedClient && resolvedClientPhone) {
      const cleanPhone = resolvedClientPhone.replace(/[^0-9]/g, "");
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

    // If the transaction includes sold items, persist them and update product stock
    const items = req.body.items;
    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        try {
          const saleId = item.id || generateId();
          await db.insert(productSalesTable).values({
            id: saleId,
            agentId: agent.id,
            productId: item.productId || null,
            productName: item.productName || item.name || null,
            unitPrice: item.unitPrice || item.price || 0,
            quantity: item.quantity || 1,
            totalPrice: item.totalPrice !== undefined ? item.totalPrice : ((item.unitPrice || item.price || 0) * (item.quantity || 1)),
            barcode: item.barcode || null,
            note: item.note || null,
            createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
          });

          // Decrement stock if product linked
          if (item.productId) {
            const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId)).limit(1);
            if (product && product.stock !== null) {
              await db.update(productsTable).set({
                stock: Math.max(0, (product.stock ?? 0) - (item.quantity || 1)),
                updatedAt: new Date(),
              }).where(eq(productsTable.id, item.productId));
            }
          }
        } catch (err) {
          // Non-fatal: continue processing other items
          console.error("Failed to persist sale item", err);
        }
      }
    }

    const [tx] = await db
      .select()
      .from(transactionsTable)
      .where(eq(transactionsTable.id, id))
      .limit(1);

    res.json({
      id: tx.id,
      type: tx.type as "depot" | "retrait" | "vente" | "recharge",
      clientName: tx.clientName,
      clientPhone: tx.clientPhone,
      amount: tx.amount,
      operator: tx.operator as "MTN" | "Moov" | "Celtis",
      note: tx.note,
      paid: tx.paid,
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
        type: tx.type as "depot" | "retrait" | "vente" | "recharge",
        clientName: tx.clientName,
        clientPhone: tx.clientPhone,
        amount: tx.amount,
        operator: tx.operator as "MTN" | "Moov" | "Celtis",
        note: tx.note,
        paid: tx.paid,
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

    const changedFields: Record<string, { before: unknown; after: unknown }> = {};
    const auditedFields = [
      "type",
      "clientName",
      "clientPhone",
      "amount",
      "operator",
      "note",
      "paid",
      "savedClient",
      "saleMode",
    ] as const;

    for (const field of auditedFields) {
      if (changes[field] !== undefined && changes[field] !== tx[field]) {
        changedFields[field] = {
          before: tx[field],
          after: changes[field],
        };
      }
    }

    const logId = Date.now().toString() + Math.random().toString(36).substring(2, 11);
    await db.insert(transactionLogsTable).values({
      id: logId,
      transactionId: id,
      action: "edited",
      agentId: tx.agentId,
      userId: user.id,
      changes: changedFields,
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
        paid: changes.paid !== undefined ? parsePaid(changes.paid) : tx.paid,
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
      type: updatedTx.type as "depot" | "retrait" | "vente" | "recharge",
      clientName: updatedTx.clientName,
      clientPhone: updatedTx.clientPhone,
      amount: updatedTx.amount,
      operator: updatedTx.operator as "MTN" | "Moov" | "Celtis",
      note: updatedTx.note,
      paid: updatedTx.paid,
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

// ─── POST /transactions/:id/mark-paid ───────────────────────────────────────
router.post("/:id/mark-paid", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user!;
  const id = req.params.id as string;

  try {
    const [tx] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
    if (!tx) {
      res.status(404).json({ error: "Transaction non trouvée." });
      return;
    }

    if (tx.agentId !== user.id) {
      const [agent] = await db.select().from(usersTable).where(eq(usersTable.id, tx.agentId)).limit(1);
      if (!agent || agent.managerId !== user.id) {
        res.status(403).json({ error: "Non autorisé." });
        return;
      }
    }

    await db.update(transactionsTable).set({ paid: true }).where(eq(transactionsTable.id, id));

    const [updated] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, id)).limit(1);
    res.json({ id: updated.id, paid: updated.paid });
  } catch (err) {
    res.status(500).json({ error: "Erreur lors de la mise à jour du statut payé." });
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

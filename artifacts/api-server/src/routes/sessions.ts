import { Router } from "express";
import { db } from "@workspace/db";
import { daySessionsTable, transactionsTable } from "@workspace/db";
import { eq, and, gte, lt } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/authMiddleware";

const router = Router();

router.get("/today", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const agent = authReq.user!;
  const today = new Date().toISOString().split("T")[0];

  try {
    const [session] = await db
      .select()
      .from(daySessionsTable)
      .where(and(eq(daySessionsTable.agentId, agent.id), eq(daySessionsTable.date, today)))
      .limit(1);

    if (!session) {
      res.status(404).json({ error: "Aucune session trouvée pour aujourd'hui." });
      return;
    }

    res.json({
      id: session.id,
      agentId: session.agentId,
      date: session.date,
      openingBalances: {
        cash: session.openingCash,
        MTN: session.openingMtn,
        Moov: session.openingMoov,
        Celtis: session.openingCeltis,
      },
      openingTotal: session.openingTotal,
      closingBalances: session.isOpen ? null : {
        cash: session.closingCash ?? 0,
        MTN: session.closingMtn ?? 0,
        Moov: session.closingMoov ?? 0,
        Celtis: session.closingCeltis ?? 0,
      },
      closingTotal: session.closingTotal,
      isOpen: session.isOpen,
      openedAt: session.openedAt.toISOString(),
      closedAt: session.closedAt?.toISOString() ?? null,
    });
  } catch (error) {
    res.status(500).json({ error: "Erreur interne lors de la récupération de la session." });
  }
});

router.post("/open", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const agent = authReq.user!;
  const { balances } = req.body;

  if (!balances) {
    res.status(400).json({ error: "Balances d'ouverture requises." });
    return;
  }

  const today = new Date().toISOString().split("T")[0];

  try {
    const [existing] = await db
      .select()
      .from(daySessionsTable)
      .where(and(eq(daySessionsTable.agentId, agent.id), eq(daySessionsTable.date, today)))
      .limit(1);

    if (existing) {
      if (existing.isOpen) {
        res.status(400).json({ error: "Une session journalière existe déjà pour aujourd'hui." });
        return;
      }

      await db
        .update(daySessionsTable)
        .set({
          isOpen: true,
          closingCash: null,
          closingMtn: null,
          closingMoov: null,
          closingCeltis: null,
          closingTotal: null,
          closedAt: null,
        })
        .where(eq(daySessionsTable.id, existing.id));

      const [reopened] = await db
        .select()
        .from(daySessionsTable)
        .where(eq(daySessionsTable.id, existing.id))
        .limit(1);

      res.json({
        id: reopened.id,
        agentId: reopened.agentId,
        date: reopened.date,
        openingBalances: {
          cash: reopened.openingCash,
          MTN: reopened.openingMtn,
          Moov: reopened.openingMoov,
          Celtis: reopened.openingCeltis,
        },
        openingTotal: reopened.openingTotal,
        closingBalances: null,
        closingTotal: null,
        isOpen: reopened.isOpen,
        openedAt: reopened.openedAt.toISOString(),
        closedAt: null,
      });
      return;
    }

    const sessionId = Date.now().toString() + Math.random().toString(36).substring(2, 11);
    const openingTotal = balances.cash + balances.MTN + balances.Moov + balances.Celtis;

    await db.insert(daySessionsTable).values({
      id: sessionId,
      agentId: agent.id,
      date: today,
      openingCash: balances.cash,
      openingMtn: balances.MTN,
      openingMoov: balances.Moov,
      openingCeltis: balances.Celtis,
      openingTotal,
      isOpen: true,
      openedAt: new Date(),
    });

    const [session] = await db
      .select()
      .from(daySessionsTable)
      .where(eq(daySessionsTable.id, sessionId))
      .limit(1);

    res.json({
      id: session.id,
      agentId: session.agentId,
      date: session.date,
      openingBalances: {
        cash: session.openingCash,
        MTN: session.openingMtn,
        Moov: session.openingMoov,
        Celtis: session.openingCeltis,
      },
      openingTotal: session.openingTotal,
      closingBalances: null,
      closingTotal: null,
      isOpen: session.isOpen,
      openedAt: session.openedAt.toISOString(),
      closedAt: null,
    });
  } catch (error) {
    res.status(500).json({ error: "Erreur interne lors de l'ouverture de la session." });
  }
});

router.post("/close", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const agent = authReq.user!;
  const { closingCash } = req.body;

  if (closingCash === undefined) {
    res.status(400).json({ error: "Le solde de caisse de clôture est requis." });
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
      res.status(400).json({ error: "Aucune session ouverte trouvée pour aujourd'hui." });
      return;
    }

    const todayStart = new Date(today + "T00:00:00.000Z");
    const todayEnd = new Date(today + "T23:59:59.999Z");

    const todayTxs = await db
      .select()
      .from(transactionsTable)
      .where(
        and(
          eq(transactionsTable.agentId, agent.id),
          gte(transactionsTable.createdAt, todayStart),
          lt(transactionsTable.createdAt, todayEnd)
        )
      );

    let mtn = session.openingMtn;
    let moov = session.openingMoov;
    let celtis = session.openingCeltis;

    todayTxs.forEach((tx) => {
      const amount = tx.amount;
      const op = tx.operator as "MTN" | "Moov" | "Celtis";
      if (tx.type === "depot") {
        if (op === "MTN") mtn += amount;
        else if (op === "Moov") moov += amount;
        else if (op === "Celtis") celtis += amount;
      } else if (tx.type === "vente") {
        if (op === "MTN") mtn -= amount;
        else if (op === "Moov") moov -= amount;
        else if (op === "Celtis") celtis -= amount;
      } else if (tx.type === "recharge" || tx.type === "retrait") {
        if (op === "MTN") mtn += amount;
        else if (op === "Moov") moov += amount;
        else if (op === "Celtis") celtis += amount;
      }
    });

    const closingTotal = closingCash + mtn + moov + celtis;
    const closedAt = new Date();

    await db
      .update(daySessionsTable)
      .set({
        isOpen: false,
        closingCash,
        closingMtn: mtn,
        closingMoov: moov,
        closingCeltis: celtis,
        closingTotal,
        closedAt,
      })
      .where(eq(daySessionsTable.id, session.id));

    res.json({
      id: session.id,
      agentId: session.agentId,
      date: session.date,
      openingBalances: {
        cash: session.openingCash,
        MTN: session.openingMtn,
        Moov: session.openingMoov,
        Celtis: session.openingCeltis,
      },
      openingTotal: session.openingTotal,
      closingBalances: {
        cash: closingCash,
        MTN: mtn,
        Moov: moov,
        Celtis: celtis,
      },
      closingTotal,
      isOpen: false,
      openedAt: session.openedAt.toISOString(),
      closedAt: closedAt.toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: "Erreur interne lors de la clôture de la session." });
  }
});

export default router;

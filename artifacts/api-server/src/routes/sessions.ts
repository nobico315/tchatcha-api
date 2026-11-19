import { Router } from "express";
import { db } from "@workspace/db";
import { daySessionsTable, transactionsTable } from "@workspace/db";
import { eq, and, gte, lt, desc } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/authMiddleware";

const router = Router();

export function calculateExpectedSessionBalances(
  session: typeof daySessionsTable.$inferSelect,
  txs: (typeof transactionsTable.$inferSelect)[]
) {
  let cash = session.openingCash;
  let mtn = session.openingMtn;
  let moov = session.openingMoov;
  let celtis = session.openingCeltis;

  txs.forEach((tx) => {
    const amount = tx.amount;
    const op = tx.operator as "MTN" | "Moov" | "Celtis";
    if (tx.type === "depot") {
      // Dépôt : l'agent reçoit du cash (+cash si payé) et envoie de la monnaie virtuelle (-opérateur)
      if (tx.paid !== false) cash += amount;
      if (op === "MTN") mtn -= amount;
      else if (op === "Moov") moov -= amount;
      else if (op === "Celtis") celtis -= amount;
    } else if (tx.type === "vente") {
      // Vente de forfait/crédit : cash + (si payé), monnaie virtuelle -
      if (tx.paid !== false) cash += amount;
      if (op === "MTN") mtn -= amount;
      else if (op === "Moov") moov -= amount;
      else if (op === "Celtis") celtis -= amount;
    } else if (tx.type === "recharge" || tx.type === "retrait") {
      // Retrait : l'agent donne du cash (-cash si payé) et reçoit de la monnaie virtuelle (+opérateur)
      if (tx.paid !== false) cash -= amount;
      if (op === "MTN") mtn += amount;
      else if (op === "Moov") moov += amount;
      else if (op === "Celtis") celtis += amount;
    }
  });

  return {
    cash,
    MTN: mtn,
    Moov: moov,
    Celtis: celtis,
    total: cash + mtn + moov + celtis,
  };
}

export async function autoClosePastSessions(agentId?: string) {
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();
  const isPast2359Today = now.getHours() === 23 && now.getMinutes() >= 59;

  const conditions = [eq(daySessionsTable.isOpen, true)];
  if (agentId) {
    conditions.push(eq(daySessionsTable.agentId, agentId));
  }

  const openSessions = await db
    .select()
    .from(daySessionsTable)
    .where(and(...conditions));

  for (const session of openSessions) {
    if (session.date < today || (session.date === today && isPast2359Today)) {
      const sessionDateStart = new Date(session.date + "T00:00:00.000Z");
      const sessionDateEnd = new Date(session.date + "T23:59:59.999Z");

      const dayTxs = await db
        .select()
        .from(transactionsTable)
        .where(
          and(
            eq(transactionsTable.agentId, session.agentId),
            gte(transactionsTable.createdAt, sessionDateStart),
            lt(transactionsTable.createdAt, sessionDateEnd)
          )
        );

      const expected = calculateExpectedSessionBalances(session, dayTxs);
      const closedAt = new Date(session.date + "T23:59:59.000Z");

      await db
        .update(daySessionsTable)
        .set({
          isOpen: false,
          closingCash: expected.cash,
          closingMtn: expected.MTN,
          closingMoov: expected.Moov,
          closingCeltis: expected.Celtis,
          closingTotal: expected.total,
          closedAt,
        })
        .where(eq(daySessionsTable.id, session.id));

      console.log(`[SESSION] 🌙 Clôture automatique à 23h59 appliquée pour la session ${session.id} (${session.date}) de l'agent ${session.agentId}`);
    }
  }
}

router.get("/today", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const agent = authReq.user!;
  const today = new Date().toISOString().split("T")[0];

  try {
    await autoClosePastSessions(agent.id);

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

    const expected = calculateExpectedSessionBalances(session, todayTxs);
    const mtn = expected.MTN;
    const moov = expected.Moov;
    const celtis = expected.Celtis;
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

router.get("/yesterday", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const agent = authReq.user!;
  const today = new Date().toISOString().split("T")[0];

  try {
    await autoClosePastSessions(agent.id);

    const [lastSession] = await db
      .select()
      .from(daySessionsTable)
      .where(and(eq(daySessionsTable.agentId, agent.id), lt(daySessionsTable.date, today)))
      .orderBy(desc(daySessionsTable.date))
      .limit(1);

    if (!lastSession) {
      res.status(404).json({ error: "Aucune session précédente trouvée." });
      return;
    }

    res.json({
      id: lastSession.id,
      agentId: lastSession.agentId,
      date: lastSession.date,
      closingBalances: {
        cash: lastSession.closingCash ?? lastSession.openingCash,
        MTN: lastSession.closingMtn ?? lastSession.openingMtn,
        Moov: lastSession.closingMoov ?? lastSession.openingMoov,
        Celtis: lastSession.closingCeltis ?? lastSession.openingCeltis,
      },
      closingTotal: lastSession.closingTotal ?? lastSession.openingTotal,
    });
  } catch (error) {
    res.status(500).json({ error: "Erreur lors de la récupération des soldes de la veille." });
  }
});

export default router;

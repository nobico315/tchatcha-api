import { Router } from "express";
import { db } from "@workspace/db";
import { savedClientsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/authMiddleware";

const router = Router();

router.get("/saved", requireAuth, async (req, res): Promise<void> => {
  try {
    const clients = await db
      .select()
      .from(savedClientsTable);

    res.json(
      clients.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        createdAt: c.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    res.status(500).json({ error: "Erreur interne lors de la récupération des clients." });
  }
});

export default router;

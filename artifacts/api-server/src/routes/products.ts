import { Router } from "express";
import { db } from "@workspace/db";
import { productsTable, productSalesTable } from "@workspace/db";
import { eq, and, or, ilike } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/authMiddleware";

const router = Router();

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substring(2, 11);
}

// ─── GET /products ───────────────────────────────────────────────────────────
router.get("/", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user!;
  try {
    const products = await db
      .select()
      .from(productsTable)
      .where(eq(productsTable.agentId, user.id));
    res.json(products.map((p) => ({
      id: p.id,
      agentId: p.agentId,
      name: p.name,
      barcode: p.barcode,
      price: p.price,
      stock: p.stock,
      category: p.category,
      description: p.description,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })));
  } catch {
    res.status(500).json({ error: "Erreur lors de la récupération des produits." });
  }
});

// ─── GET /products/barcode/:barcode ──────────────────────────────────────────
router.get("/barcode/:barcode", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user!;
  const { barcode } = req.params;
  try {
    const [product] = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.agentId, user.id), eq(productsTable.barcode, barcode)))
      .limit(1);
    if (!product) {
      res.status(404).json({ error: "Produit non trouvé." });
      return;
    }
    res.json({
      id: product.id,
      agentId: product.agentId,
      name: product.name,
      barcode: product.barcode,
      price: product.price,
      stock: product.stock,
      category: product.category,
      description: product.description,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    });
  } catch {
    res.status(500).json({ error: "Erreur lors de la recherche." });
  }
});

// ─── POST /products ───────────────────────────────────────────────────────────
router.post("/", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user!;
  const { name, barcode, price, stock, category, description } = req.body;

  if (!name || price === undefined) {
    res.status(400).json({ error: "Nom et prix requis." });
    return;
  }

  try {
    // Prevent duplicate barcode for the same agent
    if (barcode) {
      const [existing] = await db
        .select()
        .from(productsTable)
        .where(and(eq(productsTable.agentId, user.id), eq(productsTable.barcode, barcode)))
        .limit(1);
      if (existing) {
        res.status(400).json({ error: "Un produit avec ce code-barres existe déjà." });
        return;
      }
    }

    const id = generateId();
    const now = new Date();
    await db.insert(productsTable).values({
      id,
      agentId: user.id,
      name,
      barcode: barcode || null,
      price,
      stock: stock ?? null,
      category: category || null,
      description: description || null,
      createdAt: now,
      updatedAt: now,
    });

    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
    res.json({
      id: product.id,
      agentId: product.agentId,
      name: product.name,
      barcode: product.barcode,
      price: product.price,
      stock: product.stock,
      category: product.category,
      description: product.description,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    });
  } catch {
    res.status(500).json({ error: "Erreur lors de la création du produit." });
  }
});

// ─── PUT /products/:id ────────────────────────────────────────────────────────
router.put("/:id", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user!;
  const { id } = req.params;
  const { name, barcode, price, stock, category, description } = req.body;

  try {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
    if (!product || product.agentId !== user.id) {
      res.status(404).json({ error: "Produit non trouvé." });
      return;
    }

    await db.update(productsTable).set({
      name: name ?? product.name,
      barcode: barcode !== undefined ? barcode || null : product.barcode,
      price: price !== undefined ? price : product.price,
      stock: stock !== undefined ? stock : product.stock,
      category: category !== undefined ? category || null : product.category,
      description: description !== undefined ? description || null : product.description,
      updatedAt: new Date(),
    }).where(eq(productsTable.id, id));

    const [updated] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
    res.json({
      id: updated.id,
      agentId: updated.agentId,
      name: updated.name,
      barcode: updated.barcode,
      price: updated.price,
      stock: updated.stock,
      category: updated.category,
      description: updated.description,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch {
    res.status(500).json({ error: "Erreur lors de la mise à jour du produit." });
  }
});

// ─── DELETE /products/:id ─────────────────────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user!;
  const { id } = req.params;
  try {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
    if (!product || product.agentId !== user.id) {
      res.status(404).json({ error: "Produit non trouvé." });
      return;
    }
    await db.delete(productsTable).where(eq(productsTable.id, id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Erreur lors de la suppression." });
  }
});

// ─── GET /products/sales ──────────────────────────────────────────────────────
router.get("/sales", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user!;
  try {
    const sales = await db
      .select()
      .from(productSalesTable)
      .where(eq(productSalesTable.agentId, user.id));
    sales.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    res.json(sales.map((s) => ({
      id: s.id,
      agentId: s.agentId,
      productId: s.productId,
      productName: s.productName,
      unitPrice: s.unitPrice,
      quantity: s.quantity,
      totalPrice: s.totalPrice,
      barcode: s.barcode,
      note: s.note,
      createdAt: s.createdAt.toISOString(),
    })));
  } catch {
    res.status(500).json({ error: "Erreur lors de la récupération des ventes." });
  }
});

// ─── POST /products/sales ─────────────────────────────────────────────────────
router.post("/sales", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user!;
  const { id, productId, productName, unitPrice, quantity, totalPrice, barcode, note, createdAt } = req.body;

  if (!productName || unitPrice === undefined || !quantity || totalPrice === undefined) {
    res.status(400).json({ error: "Champs requis manquants." });
    return;
  }

  try {
    const saleId = id || generateId();
    await db.insert(productSalesTable).values({
      id: saleId,
      agentId: user.id,
      productId: productId || null,
      productName,
      unitPrice,
      quantity,
      totalPrice,
      barcode: barcode || null,
      note: note || null,
      createdAt: createdAt ? new Date(createdAt) : new Date(),
    });

    const [sale] = await db.select().from(productSalesTable).where(eq(productSalesTable.id, saleId)).limit(1);
    
    // Decrement stock if product linked
    if (productId) {
      const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId)).limit(1);
      if (product && product.stock !== null) {
        await db.update(productsTable).set({
          stock: Math.max(0, (product.stock ?? 0) - quantity),
          updatedAt: new Date(),
        }).where(eq(productsTable.id, productId));
      }
    }

    res.json({
      id: sale.id,
      agentId: sale.agentId,
      productId: sale.productId,
      productName: sale.productName,
      unitPrice: sale.unitPrice,
      quantity: sale.quantity,
      totalPrice: sale.totalPrice,
      barcode: sale.barcode,
      note: sale.note,
      createdAt: sale.createdAt.toISOString(),
    });
  } catch {
    res.status(500).json({ error: "Erreur lors de l'enregistrement de la vente." });
  }
});

export default router;

import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, notificationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/authMiddleware";
import { createAgentOnboardingNotifications } from "../lib/onboardingNotifications";

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

function notifId(): string {
  return randomBytes(12).toString("hex");
}

// GET / — List all agents belonging to the authenticated gérant
router.get("/", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const manager = authReq.user!;

  if (manager.role !== "gerant") {
    res.status(403).json({ error: "Seuls les gérants peuvent voir la liste des agents." });
    return;
  }

  try {
    const agents = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.role, "agent"), eq(usersTable.managerId, manager.id)));

    res.json(
      agents.map((a) => ({
        id: a.id,
        firstName: a.firstName,
        lastName: a.lastName,
        phone: a.phone,
        role: a.role as "agent" | "gerant",
        managerId: a.managerId,
        subscriptionExpiry: a.subscriptionExpiry,
        createdAt: a.createdAt,
      }))
    );
  } catch (error) {
    res.status(500).json({ error: "Erreur interne lors de la récupération des agents." });
  }
});

// POST /create — Gérant creates a new agent
// L'abonnement du gérant se propage automatiquement à l'agent créé
router.post("/create", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const manager = authReq.user!;
  const { firstName, lastName, phone, pin } = req.body;

  if (manager.role !== "gerant") {
    res.status(403).json({ success: false, error: "Seuls les gérants peuvent créer des agents." });
    return;
  }

  if (!firstName || !lastName || !phone || !pin) {
    res.status(400).json({ success: false, error: "Tous les champs sont requis." });
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

    const agentId = Date.now().toString() + Math.random().toString(36).substring(2, 11);
    const hashedPin = hashPin(pin);

    // ── Propagation de l'abonnement du gérant ────────────────────────────
    const managerExpiry = manager.subscriptionExpiry ?? new Date();
    const now = new Date();
    // L'agent bénéficie de l'abonnement du gérant si celui-ci est encore valide
    const agentExpiry = managerExpiry > now ? managerExpiry : new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    await db.insert(usersTable).values({
      id: agentId,
      firstName,
      lastName,
      phone,
      pin: hashedPin,
      role: "agent",
      managerId: manager.id,
      subscriptionExpiry: agentExpiry,
    });

    const [agent] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, agentId))
      .limit(1);

    // ── Notification pour l'agent ─────────────────────────────────────────
    await db.insert(notificationsTable).values({
      id: notifId(),
      userId: agentId,
      type: "agent_attached",
      title: "Bienvenue dans l'équipe ! 🎉",
      body: `Vous avez été ajouté(e) à l'équipe de ${manager.firstName} ${manager.lastName}. Votre abonnement est actif jusqu'au ${agentExpiry.toLocaleDateString("fr-FR")}.`,
    });

    try {
      await createAgentOnboardingNotifications(agentId);
    } catch (error) {
      console.warn("[AGENTS] Failed to create onboarding notifications:", error);
    }

    res.json({
      success: true,
      user: {
        id: agent.id,
        firstName: agent.firstName,
        lastName: agent.lastName,
        phone: agent.phone,
        role: agent.role as "agent" | "gerant",
        managerId: agent.managerId,
        subscriptionExpiry: agent.subscriptionExpiry,
        createdAt: agent.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Erreur interne lors de la création de l'agent." });
  }
});

// POST /attach — Gérant attaches an existing agent by phone + PIN
// L'abonnement du gérant se propage automatiquement
router.post("/attach", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const manager = authReq.user!;
  const { phone, pin } = req.body;

  if (manager.role !== "gerant") {
    res.status(403).json({ success: false, error: "Seuls les gérants peuvent rattacher des agents." });
    return;
  }

  if (!phone || !pin) {
    res.status(400).json({ success: false, error: "Téléphone et PIN requis." });
    return;
  }

  try {
    const [agent] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.phone, phone))
      .limit(1);

    if (!agent) {
      res.status(400).json({ success: false, error: "Aucun agent trouvé avec ce numéro." });
      return;
    }

    if (agent.role !== "agent") {
      res.status(400).json({ success: false, error: "L'utilisateur trouvé n'est pas un agent." });
      return;
    }

    if (!verifyPin(pin, agent.pin)) {
      res.status(401).json({ success: false, error: "Code PIN incorrect." });
      return;
    }

    if (agent.managerId && agent.managerId !== manager.id) {
      res.status(400).json({ success: false, error: "Cet agent est déjà rattaché à un autre gérant." });
      return;
    }

    // ── Propagation de l'abonnement du gérant ────────────────────────────
    const managerExpiry = manager.subscriptionExpiry ?? new Date();
    const now = new Date();
    const agentExpiry = managerExpiry > now ? managerExpiry : agent.subscriptionExpiry;

    const isAlreadyAttached = agent.managerId === manager.id;

    await db
      .update(usersTable)
      .set({ managerId: manager.id, subscriptionExpiry: agentExpiry })
      .where(eq(usersTable.id, agent.id));

    // ── Notification uniquement si c'est un nouveau rattachement ─────────
    if (!isAlreadyAttached) {
      await db.insert(notificationsTable).values({
        id: notifId(),
        userId: agent.id,
        type: "agent_attached",
        title: "Vous avez été rattaché(e) à un gérant ! 🔗",
        body: `${manager.firstName} ${manager.lastName} vous a ajouté(e) à son équipe. Votre abonnement est actif jusqu'au ${agentExpiry.toLocaleDateString("fr-FR")}.`,
      });
    }

    res.json({
      success: true,
      user: {
        id: agent.id,
        firstName: agent.firstName,
        lastName: agent.lastName,
        phone: agent.phone,
        role: agent.role as "agent" | "gerant",
        managerId: manager.id,
        subscriptionExpiry: agentExpiry,
        createdAt: agent.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Erreur interne lors du rattachement de l'agent." });
  }
});

// POST /propagate-subscription — Appelé quand le gérant renouvelle son abonnement
// Tous les agents rattachés bénéficient automatiquement du même abonnement
router.post("/propagate-subscription", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const manager = authReq.user!;

  if (manager.role !== "gerant") {
    res.status(403).json({ success: false, error: "Accès réservé aux gérants." });
    return;
  }

  try {
    // Récupérer tous les agents du gérant
    const agents = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.role, "agent"), eq(usersTable.managerId, manager.id)));

    if (agents.length === 0) {
      res.json({ success: true, updated: 0 });
      return;
    }

    const managerExpiry = manager.subscriptionExpiry;

    // Mettre à jour l'abonnement de chaque agent
    for (const agent of agents) {
      await db
        .update(usersTable)
        .set({ subscriptionExpiry: managerExpiry })
        .where(eq(usersTable.id, agent.id));

      // Notifier chaque agent
      await db.insert(notificationsTable).values({
        id: notifId(),
        userId: agent.id,
        type: "manager_subscribed",
        title: "Abonnement renouvelé ! 🎊",
        body: `Votre gérant ${manager.firstName} ${manager.lastName} a renouvelé son abonnement. Vous en bénéficiez automatiquement jusqu'au ${managerExpiry.toLocaleDateString("fr-FR")}.`,
      });
    }

    res.json({ success: true, updated: agents.length });
  } catch (error) {
    res.status(500).json({ success: false, error: "Erreur lors de la propagation de l'abonnement." });
  }
});

// Helper: Generates a short, clean invite code from manager's name and phone
export function generateManagerInviteCode(manager: { firstName: string; phone: string }): string {
  const prefix = (manager.firstName.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 4) || "MGR").padEnd(4, "X");
  const cleanPhone = manager.phone.replace(/[^0-9]/g, "");
  const suffix = cleanPhone.slice(-4) || "0000";
  return `${prefix}-${suffix}`;
}

// GET /invite-code — Gérant gets their unique team invite code
router.get("/invite-code", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user!;

  if (user.role !== "gerant") {
    res.status(403).json({ error: "Accès réservé aux gérants." });
    return;
  }

  const code = generateManagerInviteCode(user);
  res.json({
    code,
    managerName: `${user.firstName} ${user.lastName}`,
    shareMessage: `Bonjour ! Rejoins mon réseau Tcha-Tcha avec mon code d'invitation : ${code}. Télécharge l'application et saisis ce code lors de ton inscription ou dans ton profil.`,
  });
});

// POST /join-by-code — Agent joins a gérant's team using invite code
router.post("/join-by-code", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const agent = authReq.user!;
  const { code } = req.body;

  if (agent.role !== "agent") {
    res.status(400).json({ success: false, error: "Seuls les agents peuvent rejoindre un gérant avec un code." });
    return;
  }

  if (!code || typeof code !== "string" || !code.trim()) {
    res.status(400).json({ success: false, error: "Code d'invitation requis." });
    return;
  }

  const cleanCode = code.trim().toUpperCase();

  try {
    // Find all gérants and compare their computed code
    const managers = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.role, "gerant"));

    const matchedManager = managers.find((m) => generateManagerInviteCode(m) === cleanCode);

    if (!matchedManager) {
      res.status(404).json({ success: false, error: "Code d'invitation invalide ou gérant introuvable." });
      return;
    }

    if (agent.managerId && agent.managerId === matchedManager.id) {
      res.json({ success: true, message: "Vous êtes déjà rattaché(e) à ce gérant.", manager: matchedManager });
      return;
    }

    // Propagate manager subscription
    const managerExpiry = matchedManager.subscriptionExpiry ?? new Date();
    const now = new Date();
    const agentExpiry = managerExpiry > now ? managerExpiry : agent.subscriptionExpiry;

    await db
      .update(usersTable)
      .set({ managerId: matchedManager.id, subscriptionExpiry: agentExpiry })
      .where(eq(usersTable.id, agent.id));

    // Send notification to agent
    await db.insert(notificationsTable).values({
      id: notifId(),
      userId: agent.id,
      type: "agent_attached",
      title: "Rattaché(e) avec succès ! 🎉",
      body: `Vous avez rejoint l'équipe de ${matchedManager.firstName} ${matchedManager.lastName} via son code d'invitation ${cleanCode}.`,
    });

    res.json({
      success: true,
      message: `Vous êtes maintenant rattaché(e) à ${matchedManager.firstName} ${matchedManager.lastName}.`,
      manager: {
        id: matchedManager.id,
        firstName: matchedManager.firstName,
        lastName: matchedManager.lastName,
        phone: matchedManager.phone,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Erreur lors du rattachement avec le code." });
  }
});

export default router;

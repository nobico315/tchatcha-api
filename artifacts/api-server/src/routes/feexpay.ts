import { Router } from "express";
import { randomBytes } from "crypto";
import { db, usersTable, notificationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthenticatedRequest } from "../middlewares/authMiddleware";

const router = Router();

const FEEXPAY_TOKEN = process.env.FEEXPAY_TOKEN ?? process.env.EXPO_PUBLIC_FEEXPAY_TOKEN ?? "";
const FEEXPAY_ID = process.env.FEEXPAY_ID ?? process.env.EXPO_PUBLIC_FEEXPAY_ID ?? "";
const FEEXPAY_MODE = process.env.FEEXPAY_MODE === "LIVE" ? "LIVE" : "SANDBOX";

router.get("/feexpay/checkout", (req, res) => {
  if (!FEEXPAY_TOKEN || !FEEXPAY_ID) {
    res.status(500).send("FeexPay configuration missing on server. Set FEEXPAY_TOKEN and FEEXPAY_ID.");
    return;
  }

  const amount = Number(req.query.amount);
  const description = String(req.query.description ?? "Abonnement FeexPay");
  const reference = String(req.query.reference ?? "");
  const currency = String(req.query.currency ?? "XOF");
  const callbackUrl = String(req.query.callback_url ?? "");
  const errorCallbackUrl = String(req.query.error_callback_url ?? "");
  const mode = String(req.query.mode ?? FEEXPAY_MODE) === "LIVE" ? "LIVE" : "SANDBOX";
  const callbackInfoRaw = String(req.query.callback_info ?? "{}");

  if (!amount || !reference || !callbackUrl || !errorCallbackUrl) {
    res.status(400).send("Missing required parameters: amount, reference, callback_url, error_callback_url.");
    return;
  }

  let callbackInfo = {};
  try {
    callbackInfo = JSON.parse(callbackInfoRaw);
  } catch {
    callbackInfo = {};
  }

  const pageData = {
    amount,
    token: FEEXPAY_TOKEN,
    id: FEEXPAY_ID,
    description,
    currency,
    reference,
    mode,
    callback_url: callbackUrl,
    error_callback_url: errorCallbackUrl,
    callback_info: callbackInfo,
    buttonText: "Payer maintenant",
  };

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FeexPay Checkout</title>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f8fafc;
        font-family: Inter, system-ui, sans-serif;
      }
      #root {
        width: min(100%, 480px);
        padding: 24px;
        box-sizing: border-box;
      }
      .loading {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        color: #334155;
      }
    </style>
  </head>
  <body>
    <div id="root">
      <div class="loading">Préparation du paiement...</div>
    </div>
    <script type="module">
      import React from 'https://esm.sh/react@19.1.0';
      import { createRoot } from 'https://esm.sh/react-dom@19.1.0/client';
      import FeexPay from 'https://esm.sh/react-sdk-feexpay@1.0.3';

      const config = ${JSON.stringify(pageData)};
      const root = createRoot(document.getElementById('root'));
      const App = () => React.createElement(FeexPay, config);
      root.render(React.createElement(App));
    </script>
  </body>
</html>`);
});

router.get("/feexpay/verify", async (req, res) => {
  const reference = String(req.query.ref ?? req.query.reference ?? "");
  if (!reference) {
    res.status(400).json({ error: "Missing ref parameter" });
    return;
  }

  try {
    const apiUrl = `https://api-v2.feexpay.me/api/transactions/public/single/status/${encodeURIComponent(reference)}`;
    const r = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${FEEXPAY_TOKEN}` },
    });
    if (!r.ok) {
      const body = await r.text();
      res.status(r.status).json({ error: "FeexPay status check failed", body });
      return;
    }
    const data = await r.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Internal error", details: String(err) });
  }
});

router.post("/feexpay/confirm", requireAuth, async (req, res): Promise<void> => {
  const authReq = req as AuthenticatedRequest;
  const user = authReq.user!;
  const reference = typeof req.body?.reference === "string" ? req.body.reference.trim() : "";

  if (!reference) {
    res.status(400).json({ success: false, error: "Référence de paiement manquante." });
    return;
  }

  if (!FEEXPAY_TOKEN) {
    res.status(500).json({ success: false, error: "Configuration FeexPay manquante sur le serveur." });
    return;
  }

  try {
    const apiUrl = `https://api-v2.feexpay.me/api/transactions/public/single/status/${encodeURIComponent(reference)}`;
    const r = await fetch(apiUrl, {
      headers: { Authorization: `Bearer ${FEEXPAY_TOKEN}` },
    });

    if (!r.ok) {
      res.status(400).json({ success: false, error: "Impossible de vérifier le paiement auprès de FeexPay." });
      return;
    }

    const data = await r.json() as Record<string, unknown>;
    const paymentStatus = String(
      data.status ?? data.payment_status ?? data.statusCode ?? data.reason ?? ""
    ).toUpperCase();

    if (paymentStatus !== "SUCCESSFUL" && paymentStatus !== "SUCCESS") {
      res.status(400).json({ success: false, error: "Le paiement n'a pas encore été confirmé." });
      return;
    }

    const now = new Date();
    const baseDate = user.subscriptionExpiry > now ? new Date(user.subscriptionExpiry) : now;
    const newExpiry = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000);

    await db
      .update(usersTable)
      .set({ subscriptionExpiry: newExpiry })
      .where(eq(usersTable.id, user.id));

    await db.insert(notificationsTable).values({
      id: randomBytes(12).toString("hex"),
      userId: user.id,
      type: "subscription_renewed",
      title: "Abonnement renouvelé",
      body: `Votre abonnement est actif jusqu'au ${newExpiry.toLocaleDateString("fr-FR")}.`,
    });

    if (user.role === "gerant") {
      const agents = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(and(eq(usersTable.role, "agent"), eq(usersTable.managerId, user.id)));

      if (agents.length > 0) {
        await db
          .update(usersTable)
          .set({ subscriptionExpiry: newExpiry })
          .where(and(eq(usersTable.role, "agent"), eq(usersTable.managerId, user.id)));

        for (const agent of agents) {
          await db.insert(notificationsTable).values({
            id: randomBytes(12).toString("hex"),
            userId: agent.id,
            type: "subscription_renewed",
            title: "Abonnement renouvelé par votre gérant",
            body: `Votre abonnement a été prolongé jusqu'au ${newExpiry.toLocaleDateString("fr-FR")}.`,
          });
        }
      }
    }

    res.json({ success: true, subscriptionExpiry: newExpiry.toISOString() });
  } catch (err) {
    res.status(500).json({ success: false, error: "Erreur lors de la confirmation du paiement.", details: String(err) });
  }
});

export default router;

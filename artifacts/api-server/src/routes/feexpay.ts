import { Router } from "express";

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

export default router;

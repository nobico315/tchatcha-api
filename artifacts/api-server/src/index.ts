import app from "./app";
import { logger } from "./lib/logger";
import { autoClosePastSessions } from "./routes/sessions";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");

  // Clôture automatique à 23h59 et vérification des sessions passées chaque minute
  autoClosePastSessions().catch((e) => logger.warn({ err: e }, "Initial autoClosePastSessions failed"));
  setInterval(() => {
    autoClosePastSessions().catch((e) => logger.warn({ err: e }, "Periodic autoClosePastSessions failed"));
  }, 60000);
});

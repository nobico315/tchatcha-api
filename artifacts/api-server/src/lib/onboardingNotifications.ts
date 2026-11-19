import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";

const AGENT_ONBOARDING_NOTIFICATIONS = [
  {
    title: "Bienvenue sur Tcha-Tcha",
    body: "Votre compte est prêt. Suivez ces étapes pour commencer votre journée.",
  },
  {
    title: "1. Démarrez votre journée",
    body: "Ouvrez votre journée depuis l'accueil avant de commencer vos opérations.",
  },
  {
    title: "2. Renseignez vos soldes de départ",
    body: "Saisissez le montant disponible pour chaque opérateur au moment de l'ouverture.",
  },
  {
    title: "3. Enregistrez une transaction",
    body: "Appuyez sur le bouton + pour enregistrer un dépôt, un retrait ou un crédit.",
  },
] as const;

export async function createAgentOnboardingNotifications(userId: string): Promise<void> {
  await db.insert(notificationsTable).values(
    AGENT_ONBOARDING_NOTIFICATIONS.map((notification) => ({
      id: randomBytes(12).toString("hex"),
      userId,
      type: "info",
      title: notification.title,
      body: notification.body,
    })),
  );
}

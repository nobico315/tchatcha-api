import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  reportLowBalance,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useTransactions } from "@/context/TransactionContext";

export type AlertType = "balance" | "subscription" | "sync" | "reminder";

export type AlertActionRoute =
  | "/ouvrir-journee"
  | "/fermer-journee"
  | "/(tabs)/transactions"
  | "/abonnement";

export interface AppAlert {
  id: string;
  type: AlertType;
  title: string;
  description: string;
  read: boolean;
  createdAt: string;
  source?: "local" | "server";
  actionLabel?: string;
  actionRoute?: AlertActionRoute;
}

interface ServerNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

interface AlertContextType {
  alerts: AppAlert[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
  dismissAlert: (id: string) => void;
  refreshAlerts: () => Promise<void>;
  sendReminder: (title: string, description: string) => Promise<void>;
}

const AlertContext = createContext<AlertContextType | null>(null);
const ALERTS_KEY = "@tcha_alerts";
const NOTIF_PREFS_KEY = "@tcha_notif_prefs";

const SIM_ALERT_THRESHOLDS = [
  { amount: 10_000, label: "Préalerte" },
  { amount: 5_000, label: "Alerte critique" },
] as const;

const CASH_ALERT_THRESHOLDS = [
  { amount: 20_000, label: "Préalerte" },
  { amount: 5_000, label: "Alerte critique" },
] as const;

const OPERATORS = ["MTN", "Moov", "Celtis"] as const;

function mapServerNotification(notification: ServerNotification): AppAlert {
  return {
    id: notification.id,
    type:
      notification.type === "balance" ||
      notification.type === "subscription" ||
      notification.type === "sync"
        ? notification.type
        : "reminder",
    title: notification.title,
    description: notification.body,
    read: notification.isRead,
    createdAt: notification.createdAt,
    source: "server",
  };
}

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const { transactions, isOnline, getTodaySession, getSessionBalances } = useTransactions();
  const [localAlerts, setLocalAlerts] = useState<AppAlert[]>([]);
  const [serverAlerts, setServerAlerts] = useState<AppAlert[]>([]);
  const alertedKeysRef = useRef(new Set<string>());
  const reportedBalanceKeysRef = useRef(new Set<string>());
  const reportingBalanceKeysRef = useRef(new Set<string>());
  const knownServerAlertIdsRef = useRef(new Set<string>());
  const serverAlertsLoadedRef = useRef(false);
  const vibratedAlertKeysRef = useRef(new Set<string>());

  const vibrateForAlert = useCallback((alert: AppAlert) => {
    if (Platform.OS === "web") return;
    const key = `${alert.title}:${alert.createdAt.slice(0, 10)}`;
    if (vibratedAlertKeysRef.current.has(key)) return;
    vibratedAlertKeysRef.current.add(key);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(ALERTS_KEY)
      .then((json) => {
        if (!active || !json) return;
        const stored: AppAlert[] = JSON.parse(json);
        const local = stored.filter((alert) => !["1", "2", "3"].includes(alert.id));
        if (local.length !== stored.length) {
          void AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(local));
        }
        setLocalAlerts(local.map((alert) => ({ ...alert, source: "local" })));
        local.forEach((alert) => {
          alertedKeysRef.current.add(alert.id);
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const saveLocalAlerts = useCallback(async (updated: AppAlert[]) => {
    setLocalAlerts(updated);
    await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(updated));
  }, []);

  const addLocalAlert = useCallback(
    async (alert: AppAlert) => {
      const json = await AsyncStorage.getItem(ALERTS_KEY);
      const current: AppAlert[] = json ? JSON.parse(json) : [];
      const isNew = !current.some((item) => item.id === alert.id);
      if (!isNew) return;
      const updated = [{ ...alert, source: "local" as const }, ...current].slice(0, 80);
      await saveLocalAlerts(updated);
      vibrateForAlert(alert);
    },
    [saveLocalAlerts, vibrateForAlert]
  );

  const refreshServerAlerts = useCallback(async () => {
    if (!user || authLoading || !isOnline) return;
    try {
      const notifications = await getNotifications();
      const newNotifications: ServerNotification[] = serverAlertsLoadedRef.current
        ? notifications.filter(
            (n: ServerNotification) => !n.isRead && !knownServerAlertIdsRef.current.has(n.id)
          )
        : [];
      knownServerAlertIdsRef.current = new Set(notifications.map((n: ServerNotification) => n.id));
      serverAlertsLoadedRef.current = true;
      setServerAlerts(notifications.map(mapServerNotification));
      if (newNotifications[0]) {
        vibrateForAlert(mapServerNotification(newNotifications[0]));
      }
    } catch {}
  }, [authLoading, isOnline, user, vibrateForAlert]);

  useEffect(() => {
    if (!user || authLoading || !isOnline) return;
    void refreshServerAlerts();
    const interval = setInterval(() => {
      void refreshServerAlerts();
    }, 15000);
    return () => clearInterval(interval);
  }, [authLoading, isOnline, refreshServerAlerts, user]);

  // Logique métier de prévention : soldes SIM, cash, dettes, ouverture/clôture, sync & abonnement
  useEffect(() => {
    if (!user || authLoading) return;

    const evaluateBusinessAlerts = async () => {
      let prefs = { rappelJournee: true, syncAlert: true };
      try {
        const raw = await AsyncStorage.getItem(NOTIF_PREFS_KEY);
        if (raw) prefs = { ...prefs, ...JSON.parse(raw) };
      } catch {}

      const todayStr = new Date().toISOString().split("T")[0];
      const session = getTodaySession(user.id);
      const agentTxToday = transactions.filter(
        (t) => t.agentId === user.id && t.createdAt.startsWith(todayStr)
      );

      // 1. Prévention soldes SIM + Espèces (pour les agents ayant ouvert la journée)
      if (user.role === "agent" && session?.isOpen) {
        const balances = getSessionBalances(user.id);

        OPERATORS.forEach((operator) => {
          const balance = balances[operator];
          const openingBalance = session.openingBalances?.[operator] ?? 0;
          SIM_ALERT_THRESHOLDS.forEach((threshold) => {
            if (balance > threshold.amount) return;
            if (balance <= 0 && openingBalance <= 0) return;

            const key = `${user.id}:${session.date}:${operator}:${threshold.amount}`;
            const alertId = `low-balance:${key}`;
            if (!alertedKeysRef.current.has(alertId)) {
              alertedKeysRef.current.add(alertId);
              void addLocalAlert({
                id: alertId,
                type: "balance",
                title: `${threshold.label} solde ${operator}`,
                description: `Solde virtuel ${operator} à ${balance.toLocaleString("fr-FR")} FCFA (seuil : ${threshold.amount.toLocaleString("fr-FR")} FCFA). Pensez à recharger vos UV.`,
                read: false,
                createdAt: new Date().toISOString(),
              });
            }

            if (
              !isOnline ||
              reportedBalanceKeysRef.current.has(key) ||
              reportingBalanceKeysRef.current.has(key)
            ) {
              return;
            }
            reportingBalanceKeysRef.current.add(key);
            void reportLowBalance(operator, balance, threshold.amount)
              .then(async () => {
                reportedBalanceKeysRef.current.add(key);
                await refreshServerAlerts();
              })
              .catch(() => {})
              .finally(() => reportingBalanceKeysRef.current.delete(key));
          });
        });

        // Prévention caisse espèces basse
        const cashBalance = balances.cash;
        const openingCash = session.openingBalances?.cash ?? 0;
        CASH_ALERT_THRESHOLDS.forEach((threshold) => {
          if (cashBalance > threshold.amount) return;
          if (cashBalance <= 0 && openingCash <= 0) return;

          const alertId = `low-cash:${user.id}:${session.date}:${threshold.amount}`;
          if (!alertedKeysRef.current.has(alertId)) {
            alertedKeysRef.current.add(alertId);
            void addLocalAlert({
              id: alertId,
              type: "balance",
              title: `${threshold.label} espèces en caisse`,
              description: `Il reste ${cashBalance.toLocaleString("fr-FR")} FCFA en espèces. Risque de blocage sur les prochains retraits.`,
              read: false,
              createdAt: new Date().toISOString(),
            });
          }
        });
      }

      // 2. Prévention impayés / crédits clients
      if (user.role === "agent") {
        const unpaidTxs = transactions.filter((t) => t.agentId === user.id && t.paid === false);
        if (unpaidTxs.length >= 2) {
          const totalDebt = unpaidTxs.reduce((sum, t) => sum + t.amount, 0);
          const alertId = `unpaid-debt:${user.id}:${todayStr}`;
          if (!alertedKeysRef.current.has(alertId)) {
            alertedKeysRef.current.add(alertId);
            void addLocalAlert({
              id: alertId,
              type: "reminder",
              title: `${unpaidTxs.length} crédits clients en attente`,
              description: `Total non encaissé : ${totalDebt.toLocaleString("fr-FR")} FCFA. Pensez à relancer vos clients avant la clôture.`,
              read: false,
              createdAt: new Date().toISOString(),
              actionLabel: "Voir les dettes",
              actionRoute: "/(tabs)/transactions",
            });
          }
        }
      }

      // 3. Rappels ouverture / clôture de journée
      if (user.role === "agent" && prefs.rappelJournee) {
        if (!session && agentTxToday.length >= 1) {
          const alertId = `open-day-reminder:${user.id}:${todayStr}`;
          if (!alertedKeysRef.current.has(alertId)) {
            alertedKeysRef.current.add(alertId);
            void addLocalAlert({
              id: alertId,
              type: "reminder",
              title: "Journée non ouverte",
              description: `${agentTxToday.length} opération(s) enregistrée(s) aujourd'hui sans fond de caisse initial.`,
              read: false,
              createdAt: new Date().toISOString(),
              actionLabel: "Ouvrir la journée",
              actionRoute: "/ouvrir-journee",
            });
          }
        }

        const hour = new Date().getHours();
        if (session?.isOpen && hour >= 19) {
          const alertId = `close-day-reminder:${user.id}:${todayStr}`;
          if (!alertedKeysRef.current.has(alertId)) {
            alertedKeysRef.current.add(alertId);
            void addLocalAlert({
              id: alertId,
              type: "reminder",
              title: "Clôture de caisse conseillée",
              description: "Il est plus de 19h : pensez à compter votre caisse et clôturer la journée.",
              read: false,
              createdAt: new Date().toISOString(),
              actionLabel: "Clôturer",
              actionRoute: "/fermer-journee",
            });
          }
        }
      }

      // 4. Alerte transactions en attente de synchro
      if (prefs.syncAlert) {
        const pendingCount = transactions.filter(
          (t) => t.agentId === user.id && t.syncStatus !== "synced"
        ).length;
        if (!isOnline && pendingCount >= 3) {
          const alertId = `offline-pending:${user.id}:${todayStr}`;
          if (!alertedKeysRef.current.has(alertId)) {
            alertedKeysRef.current.add(alertId);
            void addLocalAlert({
              id: alertId,
              type: "sync",
              title: `${pendingCount} opérations en attente hors ligne`,
              description: "Elles seront automatiquement envoyées au serveur dès le retour de la connexion.",
              read: false,
              createdAt: new Date().toISOString(),
            });
          }
        }
      }

      // 5. Prévention expiration abonnement (<= 7 jours)
      if (user.subscriptionExpiry) {
        const daysLeft = Math.ceil(
          (new Date(user.subscriptionExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        if (daysLeft <= 7) {
          const alertId = `sub-expiry:${user.id}:${todayStr}`;
          if (!alertedKeysRef.current.has(alertId)) {
            alertedKeysRef.current.add(alertId);
            void addLocalAlert({
              id: alertId,
              type: "subscription",
              title: daysLeft <= 0 ? "Abonnement expiré" : `Abonnement expire dans ${daysLeft} jour(s)`,
              description:
                daysLeft <= 0
                  ? "La synchronisation en ligne est suspendue. Renouvelez votre accès pour continuer à sauvegarder vos données."
                  : "Pensez à renouveler votre accès avant la fin de la période pour éviter toute coupure de synchronisation.",
              read: false,
              createdAt: new Date().toISOString(),
              actionLabel: "Gérer l'abonnement",
              actionRoute: "/abonnement",
            });
          }
        }
      }
    };

    void evaluateBusinessAlerts();
  }, [
    addLocalAlert,
    authLoading,
    getSessionBalances,
    getTodaySession,
    isOnline,
    refreshServerAlerts,
    transactions,
    user,
  ]);

  const markAsRead = useCallback(
    (id: string) => {
      const remoteAlert = serverAlerts.find((alert) => alert.id === id);
      if (remoteAlert) {
        setServerAlerts((current) =>
          current.map((alert) => (alert.id === id ? { ...alert, read: true } : alert))
        );
        void markNotificationRead(id).catch(() => {});
        return;
      }
      void saveLocalAlerts(
        localAlerts.map((alert) => (alert.id === id ? { ...alert, read: true } : alert))
      );
    },
    [localAlerts, saveLocalAlerts, serverAlerts]
  );

  const markAllRead = useCallback(() => {
    setServerAlerts((current) => current.map((alert) => ({ ...alert, read: true })));
    void markAllNotificationsRead().catch(() => {});
    void saveLocalAlerts(localAlerts.map((alert) => ({ ...alert, read: true })));
  }, [localAlerts, saveLocalAlerts]);

  const dismissAlert = useCallback(
    (id: string) => {
      const remoteAlert = serverAlerts.find((alert) => alert.id === id);
      if (remoteAlert) {
        markAsRead(id);
        return;
      }
      void saveLocalAlerts(localAlerts.filter((alert) => alert.id !== id));
    },
    [localAlerts, markAsRead, saveLocalAlerts, serverAlerts]
  );

  const sendReminder = useCallback(
    async (title: string, description: string) => {
      const next: AppAlert = {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 8),
        type: "reminder",
        title,
        description,
        read: false,
        createdAt: new Date().toISOString(),
        source: "local",
      };
      await addLocalAlert(next);
    },
    [addLocalAlert]
  );

  const serverKeys = new Set(
    serverAlerts.map((alert) => `${alert.title}:${alert.createdAt.slice(0, 10)}`)
  );
  const alerts = [
    ...serverAlerts,
    ...localAlerts.filter(
      (alert) => !serverKeys.has(`${alert.title}:${alert.createdAt.slice(0, 10)}`)
    ),
  ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  const unreadCount = alerts.filter((alert) => !alert.read).length;

  return (
    <AlertContext.Provider
      value={{
        alerts,
        unreadCount,
        markAsRead,
        markAllRead,
        dismissAlert,
        refreshAlerts: refreshServerAlerts,
        sendReminder,
      }}
    >
      {children}
    </AlertContext.Provider>
  );
}

export function useAlerts() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error("useAlerts must be used inside AlertProvider");
  return ctx;
}

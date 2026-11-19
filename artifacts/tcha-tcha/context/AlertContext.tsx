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

export interface AppAlert {
  id: string;
  type: AlertType;
  title: string;
  description: string;
  read: boolean;
  createdAt: string;
  source?: "local" | "server";
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
  sendReminder: (title: string, description: string) => Promise<void>;
}

const AlertContext = createContext<AlertContextType | null>(null);
const ALERTS_KEY = "@tcha_alerts";
const BALANCE_ALERT_THRESHOLDS = [
  { amount: 10_000, label: "Préalerte" },
  { amount: 5_000, label: "Alerte critique" },
] as const;
const OPERATORS = ["MTN", "Moov", "Celtis"] as const;

function mapServerNotification(notification: ServerNotification): AppAlert {
  return {
    id: notification.id,
    type: notification.type === "balance" || notification.type === "subscription" || notification.type === "sync"
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
  const { isOnline, getTodaySession, getSessionBalances } = useTransactions();
  const [localAlerts, setLocalAlerts] = useState<AppAlert[]>([]);
  const [serverAlerts, setServerAlerts] = useState<AppAlert[]>([]);
  const alertedBalanceKeysRef = useRef(new Set<string>());
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
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
      .catch((error: unknown) => console.warn("[ALERT] Failed to vibrate for notification:", error));
  }, []);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(ALERTS_KEY).then((json) => {
      if (!active || !json) return;
      const stored: AppAlert[] = JSON.parse(json);
      const local = stored.filter((alert) => !["1", "2", "3"].includes(alert.id));
      if (local.length !== stored.length) void AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(local));
      setLocalAlerts(local.map((alert) => ({ ...alert, source: "local" })));
      local.forEach((alert) => {
        if (alert.id.startsWith("low-balance:")) alertedBalanceKeysRef.current.add(alert.id.slice("low-balance:".length));
      });
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const saveLocalAlerts = useCallback(async (updated: AppAlert[]) => {
    setLocalAlerts(updated);
    await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(updated));
  }, []);

  const addLocalAlert = useCallback(async (alert: AppAlert) => {
    const json = await AsyncStorage.getItem(ALERTS_KEY);
    const current: AppAlert[] = json ? JSON.parse(json) : [];
    const isNew = !current.some((item) => item.id === alert.id);
    const updated = [{ ...alert, source: "local" as const }, ...current.filter((item) => item.id !== alert.id)];
    await saveLocalAlerts(updated);
    if (isNew) vibrateForAlert(alert);
  }, [saveLocalAlerts, vibrateForAlert]);

  const refreshServerAlerts = useCallback(async () => {
    if (!user || authLoading || !isOnline) return;
    try {
      const notifications = await getNotifications();
      const newNotifications: ServerNotification[] = serverAlertsLoadedRef.current
        ? notifications.filter((notification: ServerNotification) =>
            !notification.isRead && !knownServerAlertIdsRef.current.has(notification.id),
          )
        : [];
      knownServerAlertIdsRef.current = new Set(
        notifications.map((notification: ServerNotification) => notification.id),
      );
      serverAlertsLoadedRef.current = true;
      setServerAlerts(notifications.map(mapServerNotification));
      const newNotification = newNotifications[0];
      if (newNotification) {
        vibrateForAlert(mapServerNotification(newNotification));
      }
    } catch {}
  }, [authLoading, isOnline, user, vibrateForAlert]);

  useEffect(() => {
    if (!user || authLoading || !isOnline) return;
    void refreshServerAlerts();
    const interval = setInterval(() => { void refreshServerAlerts(); }, 15000);
    return () => clearInterval(interval);
  }, [authLoading, isOnline, refreshServerAlerts, user]);

  useEffect(() => {
    if (!user || user.role !== "agent" || authLoading) return;
    const session = getTodaySession(user.id);
    if (!session?.isOpen) return;

    const balances = getSessionBalances(user.id);
    OPERATORS.forEach((operator) => {
      const balance = balances[operator];
      const openingBalance = session.openingBalances?.[operator] ?? 0;
      BALANCE_ALERT_THRESHOLDS.forEach((threshold) => {
        if (balance > threshold.amount) return;
        if (balance <= 0 && openingBalance <= 0) return;

        const key = `${user.id}:${session.date}:${operator}:${threshold.amount}`;
        if (!alertedBalanceKeysRef.current.has(key)) {
          alertedBalanceKeysRef.current.add(key);
          void addLocalAlert({
            id: `low-balance:${key}`,
            type: "balance",
            title: `${threshold.label} de solde SIM · ${operator}`,
            description: `Votre solde virtuel ${operator} est de ${balance.toLocaleString("fr-FR")} FCFA (seuil d'alerte : ${threshold.amount.toLocaleString("fr-FR")} FCFA). Pensez à le recharger.`,
            read: false,
            createdAt: new Date().toISOString(),
          });
        }

        if (!isOnline || reportedBalanceKeysRef.current.has(key) || reportingBalanceKeysRef.current.has(key)) return;
        reportingBalanceKeysRef.current.add(key);
        void reportLowBalance(operator, balance, threshold.amount)
          .then(async () => {
            reportedBalanceKeysRef.current.add(key);
            await refreshServerAlerts();
          })
          .catch((error) => console.warn("[ALERT] Failed to notify manager of low SIM balance:", error?.message))
          .finally(() => reportingBalanceKeysRef.current.delete(key));
      });
    });
  }, [addLocalAlert, authLoading, getSessionBalances, getTodaySession, isOnline, refreshServerAlerts, user]);

  const markAsRead = useCallback((id: string) => {
    const remoteAlert = serverAlerts.find((alert) => alert.id === id);
    if (remoteAlert) {
      setServerAlerts((current) => current.map((alert) => alert.id === id ? { ...alert, read: true } : alert));
      void markNotificationRead(id).catch(() => {});
      return;
    }
    void saveLocalAlerts(localAlerts.map((alert) => alert.id === id ? { ...alert, read: true } : alert));
  }, [localAlerts, saveLocalAlerts, serverAlerts]);

  const markAllRead = useCallback(() => {
    setServerAlerts((current) => current.map((alert) => ({ ...alert, read: true })));
    void markAllNotificationsRead().catch(() => {});
    void saveLocalAlerts(localAlerts.map((alert) => ({ ...alert, read: true })));
  }, [localAlerts, saveLocalAlerts]);

  const sendReminder = useCallback(async (title: string, description: string) => {
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
  }, [addLocalAlert]);

  const serverKeys = new Set(serverAlerts.map((alert) => `${alert.title}:${alert.createdAt.slice(0, 10)}`));
  const alerts = [...serverAlerts, ...localAlerts.filter((alert) => !serverKeys.has(`${alert.title}:${alert.createdAt.slice(0, 10)}`))]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const unreadCount = alerts.filter((alert) => !alert.read).length;

  return (
    <AlertContext.Provider value={{ alerts, unreadCount, markAsRead, markAllRead, sendReminder }}>
      {children}
    </AlertContext.Provider>
  );
}

export function useAlerts() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error("useAlerts must be used inside AlertProvider");
  return ctx;
}
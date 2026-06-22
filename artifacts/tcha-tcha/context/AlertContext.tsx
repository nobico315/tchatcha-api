import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type AlertType = "balance" | "subscription" | "sync";

export interface AppAlert {
  id: string;
  type: AlertType;
  title: string;
  description: string;
  read: boolean;
  createdAt: string;
}

interface AlertContextType {
  alerts: AppAlert[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
}

const AlertContext = createContext<AlertContextType | null>(null);
const ALERTS_KEY = "@tcha_alerts";

const defaultAlerts: AppAlert[] = [
  {
    id: "1",
    type: "balance",
    title: "Solde flottant bas",
    description: "Votre solde est en dessous de 50 000 FCFA. Rechargez votre compte.",
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: "2",
    type: "subscription",
    title: "Abonnement bientôt expirant",
    description: "Votre abonnement expire dans 5 jours. Renouvelez pour continuer.",
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: "3",
    type: "sync",
    title: "Synchronisation réussie",
    description: "Toutes vos transactions ont été synchronisées avec le serveur.",
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
];

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<AppAlert[]>(defaultAlerts);

  useEffect(() => {
    (async () => {
      const json = await AsyncStorage.getItem(ALERTS_KEY);
      if (json) setAlerts(JSON.parse(json));
      else await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(defaultAlerts));
    })();
  }, []);

  const save = async (updated: AppAlert[]) => {
    setAlerts(updated);
    await AsyncStorage.setItem(ALERTS_KEY, JSON.stringify(updated));
  };

  const markAsRead = useCallback((id: string) => {
    save(alerts.map((a) => (a.id === id ? { ...a, read: true } : a)));
  }, [alerts]);

  const markAllRead = useCallback(() => {
    save(alerts.map((a) => ({ ...a, read: true })));
  }, [alerts]);

  const unreadCount = alerts.filter((a) => !a.read).length;

  return (
    <AlertContext.Provider value={{ alerts, unreadCount, markAsRead, markAllRead }}>
      {children}
    </AlertContext.Provider>
  );
}

export function useAlerts() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error("useAlerts must be used inside AlertProvider");
  return ctx;
}

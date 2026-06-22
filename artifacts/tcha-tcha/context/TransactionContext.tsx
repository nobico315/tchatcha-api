import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

export type TransactionType = "depot" | "retrait";
export type SyncStatus = "synced" | "pending" | "error";
export type Operator = "MTN" | "Moov" | "Celtis";

export interface Transaction {
  id: string;
  type: TransactionType;
  clientName: string;
  clientPhone: string;
  amount: number;
  operator: Operator;
  note?: string;
  syncStatus: SyncStatus;
  agentId: string;
  createdAt: string;
}

export interface DaySession {
  id: string;
  agentId: string;
  date: string;
  openingBalance: number;
  closingBalance?: number;
  isOpen: boolean;
  openedAt: string;
  closedAt?: string;
}

interface TransactionContextType {
  transactions: Transaction[];
  sessions: DaySession[];
  isOnline: boolean;
  syncStatusGlobal: SyncStatus;
  addTransaction: (data: Omit<Transaction, "id" | "syncStatus" | "createdAt">) => Promise<Transaction>;
  deleteTransaction: (id: string) => Promise<void>;
  getBalance: (agentId: string) => number;
  getTransactionsByDate: (date: string, agentId?: string) => Transaction[];
  getTodayStats: (agentId?: string) => { depots: number; retraits: number; soldeNet: number; count: number };
  refreshTransactions: () => Promise<void>;
  getTodaySession: (agentId: string) => DaySession | null;
  openDay: (agentId: string, openingBalance: number) => Promise<DaySession>;
  closeDay: (agentId: string, closingBalance: number) => Promise<DaySession>;
}

const TransactionContext = createContext<TransactionContextType | null>(null);

const TX_KEY = "@tcha_transactions";
const SESSIONS_KEY = "@tcha_sessions";

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

export function TransactionProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sessions, setSessions] = useState<DaySession[]>([]);
  const [isOnline, setIsOnline] = useState(true);

  const loadData = async () => {
    const txJson = await AsyncStorage.getItem(TX_KEY);
    setTransactions(txJson ? JSON.parse(txJson) : []);
    const sessJson = await AsyncStorage.getItem(SESSIONS_KEY);
    setSessions(sessJson ? JSON.parse(sessJson) : []);
  };

  const saveTransactions = async (txs: Transaction[]) => {
    await AsyncStorage.setItem(TX_KEY, JSON.stringify(txs));
    setTransactions(txs);
  };

  const saveSessions = async (sess: DaySession[]) => {
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sess));
    setSessions(sess);
  };

  useEffect(() => {
    loadData();
    const unsub = NetInfo.addEventListener((state) => {
      setIsOnline(!!state.isConnected);
    });
    return () => unsub();
  }, []);

  const syncStatusGlobal: SyncStatus = !isOnline
    ? "error"
    : transactions.some((t) => t.syncStatus === "pending")
    ? "pending"
    : "synced";

  const addTransaction = useCallback(async (data: Omit<Transaction, "id" | "syncStatus" | "createdAt">) => {
    const newTx: Transaction = {
      ...data,
      id: generateId(),
      syncStatus: isOnline ? "synced" : "pending",
      createdAt: new Date().toISOString(),
    };
    const stored = await AsyncStorage.getItem(TX_KEY);
    const all: Transaction[] = stored ? JSON.parse(stored) : [];
    const updated = [newTx, ...all];
    await saveTransactions(updated);
    return newTx;
  }, [isOnline]);

  const deleteTransaction = useCallback(async (id: string) => {
    const stored = await AsyncStorage.getItem(TX_KEY);
    const all: Transaction[] = stored ? JSON.parse(stored) : [];
    await saveTransactions(all.filter((t) => t.id !== id));
  }, []);

  const getTodaySession = useCallback((agentId: string): DaySession | null => {
    const today = todayString();
    return sessions.find((s) => s.agentId === agentId && s.date === today) ?? null;
  }, [sessions]);

  const getBalance = useCallback((agentId: string): number => {
    const session = sessions.find((s) => s.agentId === agentId && s.date === todayString());
    const opening = session?.openingBalance ?? 0;
    const filtered = transactions.filter((t) => t.agentId === agentId && t.createdAt.startsWith(todayString()));
    return filtered.reduce((sum, t) => (t.type === "depot" ? sum + t.amount : sum - t.amount), opening);
  }, [transactions, sessions]);

  const getTransactionsByDate = useCallback((date: string, agentId?: string) => {
    return transactions.filter((t) => {
      const txDate = new Date(t.createdAt).toDateString();
      const filterDate = new Date(date).toDateString();
      const matchDate = txDate === filterDate;
      const matchAgent = agentId ? t.agentId === agentId : true;
      return matchDate && matchAgent;
    });
  }, [transactions]);

  const getTodayStats = useCallback((agentId?: string) => {
    const today = getTransactionsByDate(new Date().toISOString(), agentId);
    const depots = today.filter((t) => t.type === "depot").reduce((s, t) => s + t.amount, 0);
    const retraits = today.filter((t) => t.type === "retrait").reduce((s, t) => s + t.amount, 0);
    return { depots, retraits, soldeNet: depots - retraits, count: today.length };
  }, [getTransactionsByDate]);

  const refreshTransactions = useCallback(async () => {
    if (isOnline) {
      const stored = await AsyncStorage.getItem(TX_KEY);
      const all: Transaction[] = stored ? JSON.parse(stored) : [];
      const synced = all.map((t) => ({ ...t, syncStatus: "synced" as SyncStatus }));
      await saveTransactions(synced);
    }
  }, [isOnline]);

  const openDay = useCallback(async (agentId: string, openingBalance: number): Promise<DaySession> => {
    const stored = await AsyncStorage.getItem(SESSIONS_KEY);
    const all: DaySession[] = stored ? JSON.parse(stored) : [];
    const today = todayString();
    const existing = all.find((s) => s.agentId === agentId && s.date === today);
    if (existing) return existing;
    const newSession: DaySession = {
      id: generateId(),
      agentId,
      date: today,
      openingBalance,
      isOpen: true,
      openedAt: new Date().toISOString(),
    };
    await saveSessions([newSession, ...all]);
    return newSession;
  }, []);

  const closeDay = useCallback(async (agentId: string, closingBalance: number): Promise<DaySession> => {
    const stored = await AsyncStorage.getItem(SESSIONS_KEY);
    const all: DaySession[] = stored ? JSON.parse(stored) : [];
    const today = todayString();
    const updated = all.map((s) => {
      if (s.agentId === agentId && s.date === today && s.isOpen) {
        return { ...s, isOpen: false, closingBalance, closedAt: new Date().toISOString() };
      }
      return s;
    });
    await saveSessions(updated);
    return updated.find((s) => s.agentId === agentId && s.date === today)!;
  }, []);

  return (
    <TransactionContext.Provider value={{
      transactions, sessions, isOnline, syncStatusGlobal,
      addTransaction, deleteTransaction, getBalance,
      getTransactionsByDate, getTodayStats, refreshTransactions,
      getTodaySession, openDay, closeDay,
    }}>
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransactions() {
  const ctx = useContext(TransactionContext);
  if (!ctx) throw new Error("useTransactions must be used inside TransactionProvider");
  return ctx;
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from "react";
import NetInfo from "@react-native-community/netinfo";
import { 
  getTransactions as apiGetTransactions,
  createTransaction as apiCreateTransaction,
  updateTransaction as apiUpdateTransaction,
  deleteTransaction as apiDeleteTransaction,
  getTransactionLogs as apiGetTransactionLogs,
  getTodaySession as apiGetTodaySession,
  openSession as apiOpenSession,
  closeSession as apiCloseSession,
  getSavedClients as apiGetSavedClients
} from "@workspace/api-client-react";

export type TransactionType = "depot" | "retrait" | "vente";
export type SyncStatus = "synced" | "pending" | "error";
export type Operator = "MTN" | "Moov" | "Celtis";

export interface SavedClient {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  clientName: string;
  clientPhone: string;
  amount: number;
  operator: Operator;
  note?: string;
  savedClient?: boolean;
  saleMode?: "credit" | "forfait";
  syncStatus: SyncStatus;
  agentId: string;
  createdAt: string;
}

export interface DaySession {
  id: string;
  agentId: string;
  date: string;
  openingBalances?: {
    cash: number;
    MTN: number;
    Moov: number;
    Celtis: number;
  };
  openingBalance?: number;
  openingTotal?: number;
  closingBalances?: {
    cash: number;
    MTN: number;
    Moov: number;
    Celtis: number;
  };
  closingTotal?: number;
  isOpen: boolean;
  openedAt: string;
  closedAt?: string;
}

interface TransactionLog {
  id: string;
  transactionId: string;
  action: "deleted" | "edited";
  agentId: string;
  userId: string;
  timestamp: string;
  changes?: Partial<Transaction>;
}

interface TransactionContextType {
  transactions: Transaction[];
  sessions: DaySession[];
  transactionLogs: TransactionLog[];
  isOnline: boolean;
  syncStatusGlobal: SyncStatus;
  addTransaction: (data: Omit<Transaction, "id" | "syncStatus" | "createdAt">) => Promise<Transaction>;
  updateTransaction: (id: string, changes: Partial<Omit<Transaction, "id" | "createdAt">>) => Promise<Transaction | null>;
  deleteTransaction: (id: string) => Promise<void>;
  getBalance: (agentId: string) => number;
  getSessionBalances: (agentId: string) => { cash: number; MTN: number; Moov: number; Celtis: number; total: number };
  getSavedClientByPhone: (phone: string) => SavedClient | null;
  getTransactionsByDate: (date: string, agentId?: string) => Transaction[];
  getTodayStats: (agentId?: string) => { depots: number; retraits: number; vente: number; soldeNet: number; count: number };
  refreshTransactions: () => Promise<void>;
  getTodaySession: (agentId: string) => DaySession | null;
  openDay: (agentId: string, balances: { cash: number; MTN: number; Moov: number; Celtis: number }) => Promise<DaySession>;
  closeDay: (agentId: string, closingCash: number) => Promise<DaySession>;
  getTransactionLogs: (transactionId?: string) => TransactionLog[];
}

const TransactionContext = createContext<TransactionContextType | null>(null);

const TX_KEY = "@tcha_transactions";
const SESSIONS_KEY = "@tcha_sessions";
const CLIENTS_KEY = "@tcha_saved_clients";
const TX_LOGS_KEY = "@tcha_transaction_logs";

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

export function TransactionProvider({ children }: { children: React.ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sessions, setSessions] = useState<DaySession[]>([]);
  const [transactionLogs, setTransactionLogs] = useState<TransactionLog[]>([]);
  const [savedClients, setSavedClients] = useState<SavedClient[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const isSyncingRef = useRef(false);

  async function loadData<T>(key: string): Promise<T[]> {
    const json = await AsyncStorage.getItem(key);
    return json ? JSON.parse(json) : [];
  }

  const loadInitialData = async () => {
    const [txData, sessionData, clientsData, logsData] = await Promise.all([
      loadData<Transaction>(TX_KEY),
      loadData<DaySession>(SESSIONS_KEY),
      loadData<SavedClient>(CLIENTS_KEY),
      loadData<TransactionLog>(TX_LOGS_KEY),
    ]);

    setTransactions(txData);
    setSessions(sessionData);
    setSavedClients(clientsData);
    setTransactionLogs(logsData);
  };

  const saveTransactions = async (txs: Transaction[]) => {
    await AsyncStorage.setItem(TX_KEY, JSON.stringify(txs));
    setTransactions(txs);
  };

  const saveSessions = async (sess: DaySession[]) => {
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sess));
    setSessions(sess);
  };

  const saveClients = async (clients: SavedClient[]) => {
    await AsyncStorage.setItem(CLIENTS_KEY, JSON.stringify(clients));
    setSavedClients(clients);
  };

  const syncPendingData = useCallback(async () => {
    if (isSyncingRef.current || !isOnline) return;
    isSyncingRef.current = true;

    try {
      // 1. Sync pending transactions
      const localTxs = await loadData<Transaction>(TX_KEY);
      const pendingTxs = localTxs.filter((t) => t.syncStatus === "pending");

      if (pendingTxs.length > 0) {
        for (const tx of pendingTxs) {
          try {
            await apiCreateTransaction({
              id: tx.id,
              type: tx.type,
              clientName: tx.clientName,
              clientPhone: tx.clientPhone,
              amount: tx.amount,
              operator: tx.operator,
              note: tx.note || undefined,
              savedClient: !!tx.savedClient,
              saleMode: tx.saleMode || undefined,
              createdAt: tx.createdAt,
            });
            // Mark as synced
            tx.syncStatus = "synced";
          } catch (err) {
            // Keep as pending to retry later
          }
        }
        await saveTransactions(localTxs);
      }

      // 2. Fetch fresh data from backend
      try {
        const serverTxs = await apiGetTransactions();
        const normalized = serverTxs.map((t) => ({
          id: t.id,
          type: t.type as TransactionType,
          clientName: t.clientName,
          clientPhone: t.clientPhone,
          amount: t.amount,
          operator: t.operator as Operator,
          note: t.note || undefined,
          savedClient: t.savedClient,
          saleMode: (t.saleMode as "credit" | "forfait") || undefined,
          syncStatus: "synced" as SyncStatus,
          agentId: t.agentId,
          createdAt: t.createdAt,
        }));

        // Merge keeping pending ones
        const latestLocal = await loadData<Transaction>(TX_KEY);
        const pending = latestLocal.filter((t) => t.syncStatus === "pending");
        const merged = [
          ...pending,
          ...normalized.filter((st) => !pending.some((pt) => pt.id === st.id))
        ];
        await saveTransactions(merged);
      } catch {}

      // 3. Sync sessions
      try {
        const todaySess = await apiGetTodaySession();
        if (todaySess) {
          const normalizedSess: DaySession = {
            id: todaySess.id,
            agentId: todaySess.agentId,
            date: todaySess.date,
            openingBalances: todaySess.openingBalances,
            openingTotal: todaySess.openingTotal,
            closingBalances: todaySess.closingBalances || undefined,
            closingTotal: todaySess.closingTotal || undefined,
            isOpen: todaySess.isOpen,
            openedAt: todaySess.openedAt,
            closedAt: todaySess.closedAt || undefined,
          };
          const latestSessions = await loadData<DaySession>(SESSIONS_KEY);
          const filtered = latestSessions.filter((s) => s.id !== normalizedSess.id);
          await saveSessions([normalizedSess, ...filtered]);
        }
      } catch {}

      // 4. Sync clients
      try {
        const serverClients = await apiGetSavedClients();
        const mapped: SavedClient[] = serverClients.map((c) => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          createdAt: c.createdAt,
        }));
        await saveClients(mapped);
      } catch {}

      // 5. Sync logs
      try {
        const serverLogs = await apiGetTransactionLogs();
        const mappedLogs: TransactionLog[] = serverLogs.map((l) => ({
          id: l.id,
          transactionId: l.transactionId,
          action: l.action as "deleted" | "edited",
          agentId: l.agentId,
          userId: l.userId,
          timestamp: l.timestamp,
          changes: l.changes as Partial<Transaction>,
        }));
        await AsyncStorage.setItem(TX_LOGS_KEY, JSON.stringify(mappedLogs));
        setTransactionLogs(mappedLogs);
      } catch {}

    } catch (e) {
    } finally {
      isSyncingRef.current = false;
    }
  }, [isOnline]);

  useEffect(() => {
    loadInitialData();
    const unsub = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected;
      setIsOnline(online);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isOnline) {
      syncPendingData();
    }
  }, [isOnline, syncPendingData]);

  const normalizePhone = (phone: string) => phone.replace(/[^0-9]/g, "");

  const getSavedClientByPhone = useCallback((phone: string) => {
    const normalized = normalizePhone(phone);
    return savedClients.find((client) => normalizePhone(client.phone) === normalized) ?? null;
  }, [savedClients]);

  const registerClientLocally = async (name: string, phone: string) => {
    const normalized = normalizePhone(phone);
    const existing = savedClients.find((client) => normalizePhone(client.phone) === normalized);
    if (existing) {
      if (existing.name !== name) {
        const updated = savedClients.map((client) =>
          normalizePhone(client.phone) === normalized ? { ...client, name } : client
        );
        await saveClients(updated);
      }
      return existing;
    }

    const newClient: SavedClient = {
      id: generateId(),
      name,
      phone,
      createdAt: new Date().toISOString(),
    };
    const updated = [newClient, ...savedClients];
    await saveClients(updated);
    return newClient;
  };

  const getOpeningBalances = (session: DaySession) => ({
    cash: session.openingBalances?.cash ?? session.openingBalance ?? 0,
    MTN: session.openingBalances?.MTN ?? 0,
    Moov: session.openingBalances?.Moov ?? 0,
    Celtis: session.openingBalances?.Celtis ?? 0,
  });

  const calculateSessionBalances = (session: DaySession, txs: Transaction[]) => {
    const openingBalances = getOpeningBalances(session);
    const balances = {
      cash: openingBalances.cash,
      MTN: openingBalances.MTN,
      Moov: openingBalances.Moov,
      Celtis: openingBalances.Celtis,
    };

    txs.forEach((tx) => {
      const operator = tx.operator;
      if (tx.type === "depot") {
        balances.cash -= tx.amount;
        balances[operator] += tx.amount;
      } else {
        balances.cash += tx.amount;
        balances[operator] -= tx.amount;
      }
    });

    return {
      ...balances,
      total: balances.cash + balances.MTN + balances.Moov + balances.Celtis,
    };
  };

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
    if (newTx.savedClient) {
      await registerClientLocally(newTx.clientName, newTx.clientPhone);
    }

    if (isOnline) {
      try {
        await apiCreateTransaction({
          id: newTx.id,
          type: newTx.type,
          clientName: newTx.clientName,
          clientPhone: newTx.clientPhone,
          amount: newTx.amount,
          operator: newTx.operator,
          note: newTx.note || undefined,
          savedClient: !!newTx.savedClient,
          saleMode: newTx.saleMode || undefined,
          createdAt: newTx.createdAt,
        });
      } catch (err) {
        // Switch to pending if network fails
        newTx.syncStatus = "pending";
        const latest = await loadData<Transaction>(TX_KEY);
        const rolledBack = latest.map((t) => t.id === newTx.id ? { ...t, syncStatus: "pending" as SyncStatus } : t);
        await saveTransactions(rolledBack);
      }
    }
    return newTx;
  }, [isOnline, savedClients]);

  const deleteTransaction = async (id: string) => {
    const stored = await AsyncStorage.getItem(TX_KEY);
    const all: Transaction[] = stored ? JSON.parse(stored) : [];
    const updated = all.filter((t) => t.id !== id);
    await saveTransactions(updated);

    if (isOnline) {
      try {
        await apiDeleteTransaction(id);
      } catch {}
    }
  };

  const updateTransaction = async (id: string, changes: Partial<Omit<Transaction, "id" | "createdAt">>) => {
    const stored = await AsyncStorage.getItem(TX_KEY);
    const all: Transaction[] = stored ? JSON.parse(stored) : [];
    const updated = all.map((tx) => (tx.id === id ? { ...tx, ...changes } : tx));
    const changedTx = updated.find((tx) => tx.id === id) ?? null;
    await saveTransactions(updated);

    if (isOnline && changedTx) {
      try {
        await apiUpdateTransaction(id, {
          type: changedTx.type,
          clientName: changedTx.clientName,
          clientPhone: changedTx.clientPhone,
          amount: changedTx.amount,
          operator: changedTx.operator,
          note: changedTx.note || undefined,
          savedClient: !!changedTx.savedClient,
          saleMode: changedTx.saleMode || undefined,
        });
      } catch {}
    }

    return changedTx;
  };

  const getTransactionLogs = useCallback((transactionId?: string) => {
    return transactionId
      ? transactionLogs.filter((log) => log.transactionId === transactionId)
      : transactionLogs;
  }, [transactionLogs]);

  const getTodaySession = useCallback((agentId: string): DaySession | null => {
    const today = todayString();
    return sessions.find((s) => s.agentId === agentId && s.date === today) ?? null;
  }, [sessions]);

  const getSessionBalances = useCallback((agentId: string) => {
    const session = sessions.find((s) => s.agentId === agentId && s.date === todayString());
    if (!session) {
      return { cash: 0, MTN: 0, Moov: 0, Celtis: 0, total: 0 };
    }
    const filtered = transactions.filter((t) => t.agentId === agentId && t.createdAt.startsWith(todayString()));
    return calculateSessionBalances(session, filtered);
  }, [sessions, transactions]);

  const getBalance = useCallback((agentId: string): number => {
    return getSessionBalances(agentId).total;
  }, [getSessionBalances]);

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
    const vente = today.filter((t) => t.type === "vente").reduce((s, t) => s + t.amount, 0);
    return { depots, retraits, vente, soldeNet: depots - retraits, count: today.length };
  }, [getTransactionsByDate]);

  const refreshTransactions = useCallback(async () => {
    await syncPendingData();
  }, [syncPendingData]);

  const openDay = useCallback(async (agentId: string, openingBalances: { cash: number; MTN: number; Moov: number; Celtis: number }): Promise<DaySession> => {
    const stored = await AsyncStorage.getItem(SESSIONS_KEY);
    const all: DaySession[] = stored ? JSON.parse(stored) : [];
    const today = todayString();
    const existing = all.find((s) => s.agentId === agentId && s.date === today);
    if (existing) return existing;

    const openingTotal = openingBalances.cash + openingBalances.MTN + openingBalances.Moov + openingBalances.Celtis;
    const newSession: DaySession = {
      id: generateId(),
      agentId,
      date: today,
      openingBalances,
      openingTotal,
      isOpen: true,
      openedAt: new Date().toISOString(),
    };
    await saveSessions([newSession, ...all]);

    if (isOnline) {
      try {
        const res = await apiOpenSession({
          balances: openingBalances
        });
        const normalizedSess: DaySession = {
          id: res.id,
          agentId: res.agentId,
          date: res.date,
          openingBalances: res.openingBalances,
          openingTotal: res.openingTotal,
          closingBalances: res.closingBalances || undefined,
          closingTotal: res.closingTotal || undefined,
          isOpen: res.isOpen,
          openedAt: res.openedAt,
          closedAt: res.closedAt || undefined,
        };
        const latest = await loadData<DaySession>(SESSIONS_KEY);
        const filtered = latest.filter((s) => s.date !== today || s.agentId !== agentId);
        await saveSessions([normalizedSess, ...filtered]);
        return normalizedSess;
      } catch (err) {}
    }
    return newSession;
  }, [isOnline]);

  const closeDay = useCallback(async (agentId: string, closingCash: number): Promise<DaySession> => {
    const stored = await AsyncStorage.getItem(SESSIONS_KEY);
    const all: DaySession[] = stored ? JSON.parse(stored) : [];
    const today = todayString();
    const currentSession = all.find((s) => s.agentId === agentId && s.date === today);
    if (!currentSession) {
      throw new Error("No session found for today.");
    }

    const txs = transactions.filter((t) => t.agentId === agentId && t.createdAt.startsWith(today));
    const sessionBalances = calculateSessionBalances(currentSession, txs);
    const closingBalances = {
      cash: closingCash,
      MTN: sessionBalances.MTN,
      Moov: sessionBalances.Moov,
      Celtis: sessionBalances.Celtis,
    };
    const closingTotal = closingCash + sessionBalances.MTN + sessionBalances.Moov + sessionBalances.Celtis;

    const updated = all.map((s) => {
      if (s.agentId === agentId && s.date === today && s.isOpen) {
        return {
          ...s,
          isOpen: false,
          closingBalances,
          closingTotal,
          closedAt: new Date().toISOString(),
        };
      }
      return s;
    });
    await saveSessions(updated);

    if (isOnline) {
      try {
        const res = await apiCloseSession({
          closingCash
        });
        const normalizedSess: DaySession = {
          id: res.id,
          agentId: res.agentId,
          date: res.date,
          openingBalances: res.openingBalances,
          openingTotal: res.openingTotal,
          closingBalances: res.closingBalances || undefined,
          closingTotal: res.closingTotal || undefined,
          isOpen: res.isOpen,
          openedAt: res.openedAt,
          closedAt: res.closedAt || undefined,
        };
        const latest = await loadData<DaySession>(SESSIONS_KEY);
        const filtered = latest.filter((s) => s.id !== normalizedSess.id);
        await saveSessions([normalizedSess, ...filtered]);
        return normalizedSess;
      } catch (err) {}
    }
    return updated.find((s) => s.agentId === agentId && s.date === today)!;
  }, [isOnline, transactions]);

  return (
    <TransactionContext.Provider value={{
      transactions, sessions, transactionLogs, isOnline, syncStatusGlobal,
      addTransaction, updateTransaction, deleteTransaction, getBalance,
      getSessionBalances, getTransactionsByDate, getTodayStats, refreshTransactions,
      getTodaySession, openDay, closeDay,
      getSavedClientByPhone, getTransactionLogs,
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


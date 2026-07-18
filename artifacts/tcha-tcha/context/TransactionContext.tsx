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

export type TransactionType = "depot" | "retrait" | "vente" | "recharge";
export type SyncStatus = "synced" | "pending" | "error" | "pending_update";
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
  syncStatus?: "synced" | "pending" | "pending_close" | "error";
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
  getErrorTransactions: () => Transaction[];
  clearErrorTransaction: (id: string) => Promise<void>;
  getBalance: (agentId: string) => number;
  getSessionBalances: (agentId: string) => { cash: number; MTN: number; Moov: number; Celtis: number; total: number };
  getSavedClientByPhone: (phone: string) => SavedClient | null;
  getTransactionsByDate: (date: string, agentId?: string) => Transaction[];
  getTodayStats: (agentId?: string) => { depots: number; retraits: number; vente: number; soldeNet: number; count: number };
  refreshTransactions: () => Promise<void>;
  getTodaySession: (agentId: string) => DaySession | null;
  openDay: (agentId: string, balances: { cash: number; MTN: number; Moov: number; Celtis: number }) => Promise<DaySession>;
  reopenDay: (agentId: string) => Promise<DaySession>;
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
      // 0. Sync pending deletions
      try {
        const delStored = await AsyncStorage.getItem("@tcha_pending_deletions");
        const delQueue: string[] = delStored ? JSON.parse(delStored) : [];
        if (delQueue.length > 0) {
          const remainingDeletes: string[] = [];
          for (const id of delQueue) {
            try {
              await apiDeleteTransaction(id);
            } catch (err: any) {
              const status = err?.status ?? err?.statusCode;
              if (status !== 404) {
                remainingDeletes.push(id);
              }
            }
          }
          await AsyncStorage.setItem("@tcha_pending_deletions", JSON.stringify(remainingDeletes));
        }
      } catch (err) {
        console.warn("[TX] Pending deletes sync failed:", err);
      }

      // 1. Sync pending creations and updates (skip error ones)
      const localTxs = await loadData<Transaction>(TX_KEY);
      let subscriptionExpired = false;
      let txsChanged = false;

      for (const tx of localTxs) {
        if (tx.syncStatus !== "pending" && tx.syncStatus !== "pending_update") continue;
        if (subscriptionExpired) break;

        try {
          if (tx.syncStatus === "pending") {
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
          } else if (tx.syncStatus === "pending_update") {
            await apiUpdateTransaction(tx.id, {
              type: tx.type,
              clientName: tx.clientName,
              clientPhone: tx.clientPhone,
              amount: tx.amount,
              operator: tx.operator,
              note: tx.note || undefined,
              savedClient: !!tx.savedClient,
              saleMode: tx.saleMode || undefined,
            });
          }
          tx.syncStatus = "synced";
          txsChanged = true;
          console.log(`[TX] ✓ Transaction synced: ${tx.id}`);
        } catch (err: any) {
          const errorMsg = err?.message || "";
          const status = err?.status ?? err?.statusCode;

          if (status === 402) {
            subscriptionExpired = true;
            console.warn("[TX] ⛔ Subscription expired — halting sync.");
          } else if (status === 400 && errorMsg.includes("journée")) {
            tx.syncStatus = "error";
            txsChanged = true;
            console.warn(`[TX] ✗ Transaction marked as ERROR (day closed): ${tx.id}`);
          } else {
            console.warn(`[TX] ⏳ Failed to sync transaction ${tx.id} (will retry): ${errorMsg}`);
          }
        }
      }
      
      if (txsChanged) {
        await saveTransactions(localTxs);
      }

      if (subscriptionExpired) return;

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

        // Merge: keep pending + error locals; replace synced with server data
        const latestLocal = await loadData<Transaction>(TX_KEY);
        const localNonSynced = latestLocal.filter((t) => t.syncStatus !== "synced");
        const merged = [
          ...localNonSynced,
          ...normalized.filter((st) => !localNonSynced.some((lt) => lt.id === st.id)),
        ];
        await saveTransactions(merged);
      } catch {}

      // 3. Sync sessions (pending opens and closes)
      try {
        const latestSessions = await loadData<DaySession>(SESSIONS_KEY);
        let sessionsChanged = false;

        for (const session of latestSessions) {
          if (session.syncStatus === "pending") {
            try {
              const res = await apiOpenSession({
                balances: {
                  cash: session.openingBalances?.cash ?? 0,
                  MTN: session.openingBalances?.MTN ?? 0,
                  Moov: session.openingBalances?.Moov ?? 0,
                  Celtis: session.openingBalances?.Celtis ?? 0,
                }
              });
              session.id = res.id;
              session.syncStatus = "synced";
              sessionsChanged = true;
              
              if (!session.isOpen && session.closingBalances) {
                const closeRes = await apiCloseSession({
                  closingCash: session.closingBalances.cash
                });
                session.closingBalances = closeRes.closingBalances || session.closingBalances;
                session.closingTotal = closeRes.closingTotal;
                session.closedAt = closeRes.closedAt;
              }
            } catch (err: any) {
              console.warn("[SESSION] Failed to sync opening:", err?.message);
            }
          } else if (session.syncStatus === "pending_close") {
            try {
              if (session.closingBalances) {
                const closeRes = await apiCloseSession({
                  closingCash: session.closingBalances.cash
                });
                session.syncStatus = "synced";
                session.closingBalances = closeRes.closingBalances || session.closingBalances;
                session.closingTotal = closeRes.closingTotal;
                session.closedAt = closeRes.closedAt;
                sessionsChanged = true;
              }
            } catch (err: any) {
              const status = err?.status ?? err?.statusCode;
              console.warn("[SESSION] Failed to sync closing:", err?.message);
              // Si le serveur dit qu'aucune session n'est ouverte (HTTP 400), on arrête d'insister
              if (status === 400 || err?.message?.includes("400") || err?.message?.includes("Aucune session")) {
                session.syncStatus = "synced"; // On force le statut à synchronisé car elle n'existe pas en ligne
                sessionsChanged = true;
              }
            }
          }
        }

        if (sessionsChanged) {
          await saveSessions(latestSessions);
        }

        const today = todayString();
        const hasPendingToday = latestSessions.some((s) => s.date === today && s.syncStatus !== "synced");
        
        if (!hasPendingToday) {
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
                syncStatus: "synced",
              };
              const filtered = latestSessions.filter((s) => s.date !== today);
              await saveSessions([normalizedSess, ...filtered]);
            }
          } catch (err: any) {
            const status = err?.status ?? err?.statusCode;
            if (status !== 404) {
              throw err;
            }
          }
        }
      } catch (err) {
        console.warn("[SESSION] Sync failed:", err);
      }

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
      
      // Set up periodic sync every 10 seconds if online
      const syncInterval = setInterval(() => {
        syncPendingData();
      }, 10000);
      
      return () => clearInterval(syncInterval);
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
        // Dépôt : l'agent reçoit du cash physique (+cash) et transfère de la monnaie électronique (-opérateur)
        balances.cash += tx.amount;
        balances[operator] -= tx.amount;
      } else if (tx.type === "vente") {
        // Vente de crédit/forfait : l'agent reçoit du cash (+cash) et déduit de la monnaie électronique (-opérateur)
        balances.cash += tx.amount;
        balances[operator] -= tx.amount;
      } else if (tx.type === "recharge" || tx.type === "retrait") {
        // Recharge d’un compte virtuel : le cash diminue et le compte virtuel augmente
        balances.cash -= tx.amount;
        balances[operator] += tx.amount;
      }
    });

    return {
      ...balances,
      total: balances.cash + balances.MTN + balances.Moov + balances.Celtis,
    };
  };

  const syncStatusGlobal: SyncStatus = !isOnline
    ? "error"
    : transactions.some((t) => t.syncStatus === "pending" || t.syncStatus === "pending_update")
    ? "pending"
    : "synced";

  const addTransaction = useCallback(async (data: Omit<Transaction, "id" | "syncStatus" | "createdAt">): Promise<Transaction> => {
    // Check if day session is open before creating transaction
    const sessionData = await loadData<DaySession>(SESSIONS_KEY);
    const today = todayString();
    const todaySess = sessionData.find((s) => s.agentId === data.agentId && s.date === today);
    
    if (!todaySess || !todaySess.isOpen) {
      throw new Error("Vous devez ouvrir votre journée avant d'enregistrer des transactions.");
    }

    const newTx: Transaction = {
      ...data,
      id: generateId(),
      syncStatus: "pending", // Always start as pending, mark as synced after successful server response
      createdAt: new Date().toISOString(),
    };
    
    const stored = await AsyncStorage.getItem(TX_KEY);
    const all: Transaction[] = stored ? JSON.parse(stored) : [];
    const updated = [newTx, ...all];
    await saveTransactions(updated);
    
    if (newTx.savedClient) {
      await registerClientLocally(newTx.clientName, newTx.clientPhone);
    }

    // Try to sync immediately if online
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
        
        // Mark as synced only after successful response
        newTx.syncStatus = "synced";
        const latest = await loadData<Transaction>(TX_KEY);
        const updated = latest.map((t) => t.id === newTx.id ? { ...t, syncStatus: "synced" as SyncStatus } : t);
        await saveTransactions(updated);
        
        console.log("[TX] Transaction synced successfully:", newTx.id);
      } catch (err: any) {
        // Keep as pending to retry later
        console.warn("[TX] Failed to sync transaction, keeping as pending:", newTx.id, err?.message);
        // Don't throw here - transaction is saved locally and will be retried
      }
    } else {
      console.log("[TX] Offline mode - transaction saved as pending:", newTx.id);
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
    } else {
      const delStored = await AsyncStorage.getItem("@tcha_pending_deletions");
      const delQueue: string[] = delStored ? JSON.parse(delStored) : [];
      if (!delQueue.includes(id)) {
        delQueue.push(id);
        await AsyncStorage.setItem("@tcha_pending_deletions", JSON.stringify(delQueue));
      }
    }
  };

  const getErrorTransactions = useCallback(() => {
    return transactions.filter((t) => t.syncStatus === "error");
  }, [transactions]);

  const clearErrorTransaction = async (id: string) => {
    const stored = await AsyncStorage.getItem(TX_KEY);
    const all: Transaction[] = stored ? JSON.parse(stored) : [];
    const updated = all.filter((t) => t.id !== id);
    await saveTransactions(updated);
    console.log(`[TX] Cleared error transaction: ${id}`);
  };

  const updateTransaction = async (id: string, changes: Partial<Omit<Transaction, "id" | "createdAt">>) => {
    const stored = await AsyncStorage.getItem(TX_KEY);
    const all: Transaction[] = stored ? JSON.parse(stored) : [];
    
    const originalTx = all.find((tx) => tx.id === id);
    if (!originalTx) return null;

    const newSyncStatus = originalTx.syncStatus === "pending" ? "pending" : "pending_update";

    const updated = all.map((tx) => (tx.id === id ? { ...tx, ...changes, syncStatus: newSyncStatus as SyncStatus } : tx));
    const changedTx = updated.find((tx) => tx.id === id) ?? null;
    await saveTransactions(updated);

    if (isOnline && changedTx) {
      try {
        if (newSyncStatus === "pending") {
          // Handled by pending create sync loop
        } else {
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
          const latest = await loadData<Transaction>(TX_KEY);
          const finalTxs = latest.map((t) => t.id === id ? { ...t, syncStatus: "synced" as SyncStatus } : t);
          await saveTransactions(finalTxs);
        }
      } catch {
        // Keeps pending_update status
      }
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

  const reopenDay = useCallback(async (agentId: string): Promise<DaySession> => {
    const stored = await AsyncStorage.getItem(SESSIONS_KEY);
    const all: DaySession[] = stored ? JSON.parse(stored) : [];
    const today = todayString();
    const existing = all.find((s) => s.agentId === agentId && s.date === today && !s.isOpen);
    if (!existing) throw new Error("Aucune session clôturée à rouvrir pour aujourd'hui.");

    const reopenedSession: DaySession = {
      ...existing,
      isOpen: true,
      closingBalances: undefined,
      closingTotal: undefined,
      closedAt: undefined,
      syncStatus: isOnline ? "pending_update" : "pending_update",
    };
    const remaining = all.filter((s) => s.id !== existing.id);
    await saveSessions([reopenedSession, ...remaining]);

    if (isOnline) {
      try {
        const res = await apiOpenSession({
          balances: existing.openingBalances ?? {
            cash: existing.openingBalance ?? 0,
            MTN: 0,
            Moov: 0,
            Celtis: 0,
          },
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
          syncStatus: "synced",
        };
        const latest = await loadData<DaySession>(SESSIONS_KEY);
        const filtered = latest.filter((s) => s.id !== normalizedSess.id);
        await saveSessions([normalizedSess, ...filtered]);
        return normalizedSess;
      } catch (err) {}
    }
    return reopenedSession;
  }, [isOnline]);

  const openDay = useCallback(async (agentId: string, openingBalances: { cash: number; MTN: number; Moov: number; Celtis: number }): Promise<DaySession> => {
    const stored = await AsyncStorage.getItem(SESSIONS_KEY);
    const all: DaySession[] = stored ? JSON.parse(stored) : [];
    const today = todayString();
    const existing = all.find((s) => s.agentId === agentId && s.date === today);
    if (existing) {
      if (existing.isOpen) return existing;
      return reopenDay(agentId);
    }

    const openingTotal = openingBalances.cash + openingBalances.MTN + openingBalances.Moov + openingBalances.Celtis;
    const newSession: DaySession = {
      id: generateId(),
      agentId,
      date: today,
      openingBalances,
      openingTotal,
      isOpen: true,
      openedAt: new Date().toISOString(),
      syncStatus: "pending",
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
          syncStatus: "synced",
        };
        const latest = await loadData<DaySession>(SESSIONS_KEY);
        const filtered = latest.filter((s) => s.date !== today || s.agentId !== agentId);
        await saveSessions([normalizedSess, ...filtered]);
        return normalizedSess;
      } catch (err) {}
    }
    return newSession;
  }, [isOnline, reopenDay]);

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

    const newSyncStatus = currentSession.syncStatus === "pending" ? "pending" : "pending_close";

    const updated = all.map((s) => {
      if (s.agentId === agentId && s.date === today && s.isOpen) {
        return {
          ...s,
          isOpen: false,
          closingBalances,
          closingTotal,
          closedAt: new Date().toISOString(),
          syncStatus: newSyncStatus as "synced" | "pending" | "pending_close" | "error",
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
          syncStatus: "synced",
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
      addTransaction, updateTransaction, deleteTransaction, getErrorTransactions, clearErrorTransaction, getBalance,
      getSessionBalances, getTransactionsByDate, getTodayStats, refreshTransactions,
      getTodaySession, openDay, reopenDay, closeDay,
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


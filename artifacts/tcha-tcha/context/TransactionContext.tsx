import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from "react";
import NetInfo from "@react-native-community/netinfo";
import { isSubscriptionActive, useAuth } from "@/context/AuthContext";
import { offlineAccountStore } from "@/utils/offlineAccountStore";
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
  paid?: boolean;
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
  changes?: Record<string, unknown> | null;
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
  getYesterdayClosingBalances: (agentId: string) => { cash: number; MTN: number; Moov: number; Celtis: number; total: number; date: string } | null;
  autoCloseExpiredSessions: (agentId: string) => Promise<void>;
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

function parsePaid(value: unknown): boolean {
  if (value === false || value === "false") return false;
  if (value === true || value === "true") return true;
  return true;
}

function getOpeningBalances(session: DaySession) {
  return {
    cash: session.openingBalances?.cash ?? session.openingBalance ?? 0,
    MTN: session.openingBalances?.MTN ?? 0,
    Moov: session.openingBalances?.Moov ?? 0,
    Celtis: session.openingBalances?.Celtis ?? 0,
  };
}

function calculateSessionBalances(session: DaySession, txs: Transaction[]) {
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
      if (tx.paid !== false) balances.cash += tx.amount;
      balances[operator] -= tx.amount;
    } else if (tx.type === "vente") {
      if (tx.paid !== false) balances.cash += tx.amount;
      balances[operator] -= tx.amount;
    } else if (tx.type === "recharge" || tx.type === "retrait") {
      if (tx.paid !== false) balances.cash -= tx.amount;
      balances[operator] += tx.amount;
    }
  });

  return {
    ...balances,
    total: balances.cash + balances.MTN + balances.Moov + balances.Celtis,
  };
}

export function TransactionProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [sessions, setSessions] = useState<DaySession[]>([]);
  const [transactionLogs, setTransactionLogs] = useState<TransactionLog[]>([]);
  const [savedClients, setSavedClients] = useState<SavedClient[]>([]);
  const [loadedAccountId, setLoadedAccountId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const isSyncingRef = useRef(false);
  const activeAccountIdRef = useRef<string | null>(user?.id ?? null);
  activeAccountIdRef.current = user?.id ?? null;
  const canSyncOnline = isOnline && isSubscriptionActive(user?.subscriptionExpiry);

  const getStoredItem = useCallback(
    (key: string) => user ? offlineAccountStore.getItem(user.id, key) : Promise.resolve(null),
    [user?.id]
  );

  const setStoredItem = useCallback((key: string, value: string) => {
    if (!user) return Promise.reject(new Error("Aucun compte connecté pour le stockage local."));
    return offlineAccountStore.setItem(user.id, key, value);
  }, [user?.id]);

  const loadData = useCallback(async <T,>(key: string): Promise<T[]> => {
    const json = await getStoredItem(key);
    return json ? JSON.parse(json) : [];
  }, [getStoredItem]);

  const loadInitialData = async (accountId: string) => {
    const loadAccountData = async <T,>(
      key: string,
      legacyOwner?: (item: T) => boolean
    ): Promise<T[]> => {
      const scoped = await offlineAccountStore.getItem(accountId, key);
      if (scoped !== null) return JSON.parse(scoped) as T[];
      if (!legacyOwner) return [];

      const legacy = await AsyncStorage.getItem(key);
      if (!legacy) return [];
      const legacyItems = JSON.parse(legacy) as T[];
      const matching = legacyItems.filter(legacyOwner);
      if (matching.length > 0) {
        await offlineAccountStore.setItem(accountId, key, JSON.stringify(matching));
        const otherAccounts = legacyItems.filter((item) => !legacyOwner(item));
        if (otherAccounts.length > 0) {
          await AsyncStorage.setItem(key, JSON.stringify(otherAccounts));
        } else {
          await AsyncStorage.removeItem(key);
        }
      }
      return matching;
    };

    const [txData, sessionData, clientsData, logsData] = await Promise.all([
      loadAccountData<Transaction>(TX_KEY, (tx) => tx.agentId === accountId),
      loadAccountData<DaySession>(SESSIONS_KEY, (session) => session.agentId === accountId),
      loadAccountData<SavedClient>(CLIENTS_KEY, () => false),
      loadAccountData<TransactionLog>(TX_LOGS_KEY, (log) => log.userId === accountId),
    ]);

    const today = todayString();
    const now = new Date();
    const isPast2359 = now.getHours() === 23 && now.getMinutes() >= 59;

    let sessionsChanged = false;
    const normalizedSessions = sessionData.map((s) => {
      if (s.isOpen && (s.date < today || (s.date === today && isPast2359))) {
        sessionsChanged = true;
        const dayTxs = txData.filter((t) => t.agentId === s.agentId && t.createdAt.startsWith(s.date));
        const calcBalances = calculateSessionBalances(s, dayTxs);
        return {
          ...s,
          isOpen: false,
          closingBalances: {
            cash: calcBalances.cash,
            MTN: calcBalances.MTN,
            Moov: calcBalances.Moov,
            Celtis: calcBalances.Celtis,
          },
          closingTotal: calcBalances.total,
          closedAt: `${s.date}T23:59:59.000Z`,
          syncStatus: (s.syncStatus === "pending" ? "pending" : "pending_close") as DaySession["syncStatus"],
        };
      }
      return s;
    });

    if (sessionsChanged) {
      await offlineAccountStore.setItem(accountId, SESSIONS_KEY, JSON.stringify(normalizedSessions));
    }
    return { transactions: txData, sessions: normalizedSessions, clients: clientsData, logs: logsData };
  };

  const saveTransactions = async (txs: Transaction[]) => {
    await setStoredItem(TX_KEY, JSON.stringify(txs));
    if (activeAccountIdRef.current === user?.id) setTransactions(txs);
  };

  const saveSessions = async (sess: DaySession[]) => {
    await setStoredItem(SESSIONS_KEY, JSON.stringify(sess));
    if (activeAccountIdRef.current === user?.id) setSessions(sess);
  };

  const saveClients = async (clients: SavedClient[]) => {
    await setStoredItem(CLIENTS_KEY, JSON.stringify(clients));
    if (activeAccountIdRef.current === user?.id) setSavedClients(clients);
  };

  const refreshTransactionLogs = useCallback(async () => {
    if (!user) return;
    try {
      const serverLogs = await apiGetTransactionLogs();
      const mappedLogs: TransactionLog[] = serverLogs.map((log) => ({
        id: log.id,
        transactionId: log.transactionId,
        action: log.action,
        agentId: log.agentId,
        userId: log.userId,
        timestamp: log.timestamp,
        changes: log.changes as Record<string, unknown> | null,
      }));
      await setStoredItem(TX_LOGS_KEY, JSON.stringify(mappedLogs));
      if (activeAccountIdRef.current === user.id) setTransactionLogs(mappedLogs);
    } catch (error) {
      console.warn("[TX] Failed to refresh transaction history:", error);
    }
  }, [setStoredItem, user]);

  useEffect(() => {
    let cancelled = false;
    setTransactions([]);
    setSessions([]);
    setSavedClients([]);
    setTransactionLogs([]);
    setLoadedAccountId(null);

    if (authLoading || !user) return () => { cancelled = true; };

    void loadInitialData(user.id).then((data) => {
      if (cancelled) return;
      setTransactions(data.transactions);
      setSessions(data.sessions);
      setSavedClients(data.clients);
      setTransactionLogs(data.logs);
      setLoadedAccountId(user.id);
    }).catch((error) => {
      console.error("[TX] Échec du chargement du coffre local :", error);
    });

    return () => { cancelled = true; };
  }, [authLoading, user?.id]);

  const syncPendingData = useCallback(async () => {
    if (isSyncingRef.current || !canSyncOnline || authLoading || !user || loadedAccountId !== user.id || !isSubscriptionActive(user.subscriptionExpiry)) return;
    isSyncingRef.current = true;

    try {
      // 0. Sync pending deletions
      try {
        const delStored = await getStoredItem("@tcha_pending_deletions");
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
          await setStoredItem("@tcha_pending_deletions", JSON.stringify(remainingDeletes));
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
              paid: parsePaid(tx.paid),
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
              paid: parsePaid(tx.paid),
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
          } else if (status === 404 && tx.syncStatus === "pending_update") {
            tx.syncStatus = "error";
            txsChanged = true;
            console.warn(`[TX] ✗ Updated transaction not found on server; keeping local copy as ERROR: ${tx.id}`);
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
          paid: parsePaid(t.paid),
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
                if (closeRes.closingTotal != null) session.closingTotal = closeRes.closingTotal;
                if (closeRes.closedAt != null) session.closedAt = closeRes.closedAt;
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
                if (closeRes.closingTotal != null) session.closingTotal = closeRes.closingTotal;
                if (closeRes.closedAt != null) session.closedAt = closeRes.closedAt;
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
      await refreshTransactionLogs();

    } catch (e) {
    } finally {
      isSyncingRef.current = false;
    }
  }, [canSyncOnline, authLoading, getStoredItem, loadData, loadedAccountId, refreshTransactionLogs, setStoredItem, user?.id, user?.subscriptionExpiry]);


  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected;
      setIsOnline(online);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (canSyncOnline) {
      syncPendingData();
      
      // Set up periodic sync every 10 seconds if online
      const syncInterval = setInterval(() => {
        syncPendingData();
      }, 10000);
      
      return () => clearInterval(syncInterval);
    }
  }, [canSyncOnline, syncPendingData]);

  const normalizePhone = (phone: string) => phone.replace(/[^0-9]/g, "");

  const getSavedClientByPhone = useCallback((phone: string) => {
    if (loadedAccountId !== user?.id) return null;
    const normalized = normalizePhone(phone);
    return savedClients.find((client) => normalizePhone(client.phone) === normalized) ?? null;
  }, [loadedAccountId, savedClients, user?.id]);

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



  const currentTransactions = loadedAccountId === user?.id ? transactions : [];
  const currentSessions = loadedAccountId === user?.id ? sessions : [];
  const currentTransactionLogs = loadedAccountId === user?.id ? transactionLogs : [];

  const syncStatusGlobal: SyncStatus = !isOnline
    ? "error"
    : currentTransactions.some((t) => t.syncStatus === "pending" || t.syncStatus === "pending_update")
    ? "pending"
    : "synced";

  const addTransaction = useCallback(async (data: Omit<Transaction, "id" | "syncStatus" | "createdAt">): Promise<Transaction> => {
    if (!user || loadedAccountId !== user.id) throw new Error("Le stockage local du compte n’est pas encore prêt.");
    // Vérification ouverture de journée :
    // On autorise 1 transaction sans ouverture préalable,
    // mais pour continuer (2ème transaction et +), la journée doit être ouverte.
    const sessionData = await loadData<DaySession>(SESSIONS_KEY);
    const today = todayString();
    const todaySess = sessionData.find((s) => s.agentId === data.agentId && s.date === today);
    const isDayOpen = todaySess && todaySess.isOpen;

    if (!isDayOpen) {
      const stored = await getStoredItem(TX_KEY);
      const all: Transaction[] = stored ? JSON.parse(stored) : [];
      const todayTxs = all.filter((t) => t.agentId === data.agentId && t.createdAt.startsWith(today));
      if (todayTxs.length >= 1) {
        throw new Error("Vous devez ouvrir votre journée pour continuer à enregistrer des transactions.");
      }
    }

    const newTx: Transaction = {
      ...data,
      paid: data.paid === undefined ? true : parsePaid(data.paid),
      id: generateId(),
      syncStatus: "pending", // Always start as pending, mark as synced after successful server response
      createdAt: new Date().toISOString(),
    };
    
    const stored = await offlineAccountStore.updateItem(user.id, TX_KEY, (stored) => {
      const all: Transaction[] = stored ? JSON.parse(stored) : [];
      const todayTxs = all.filter((tx) => tx.agentId === data.agentId && tx.createdAt.startsWith(today));
      if (!isDayOpen && todayTxs.length >= 1) {
        throw new Error("Vous devez ouvrir votre journée pour continuer à enregistrer des transactions.");
      }
      return JSON.stringify([newTx, ...all]);
    });
    const updated: Transaction[] = stored ? JSON.parse(stored) : [newTx];
    if (activeAccountIdRef.current === user.id) setTransactions(updated);
    
    if (newTx.savedClient) {
      await registerClientLocally(newTx.clientName, newTx.clientPhone);
    }

    // Share the sync lock with the retry loop so this transaction cannot be sent twice.
    if (canSyncOnline && isSubscriptionActive(user?.subscriptionExpiry) && user && !authLoading && !isSyncingRef.current) {
      isSyncingRef.current = true;
      try {
        await apiCreateTransaction({
          id: newTx.id,
          type: newTx.type,
          clientName: newTx.clientName,
          clientPhone: newTx.clientPhone,
          amount: newTx.amount,
          operator: newTx.operator,
          note: newTx.note || undefined,
          paid: newTx.paid,
          savedClient: !!newTx.savedClient,
          saleMode: newTx.saleMode || undefined,
          createdAt: newTx.createdAt,
        });

        const latest = await loadData<Transaction>(TX_KEY);
        const syncedTransactions = latest.map((tx) =>
          tx.id === newTx.id ? { ...tx, syncStatus: "synced" as SyncStatus } : tx
        );
        await saveTransactions(syncedTransactions);
        console.log("[TX] Transaction synced successfully:", newTx.id);
      } catch (err: any) {
        // Keep as pending to retry later
        console.warn("[TX] Failed to sync transaction, keeping as pending:", newTx.id, err?.message);
        // Don't throw here - transaction is saved locally and will be retried
      } finally {
        isSyncingRef.current = false;
      }
    } else {
      console.log("[TX] Transaction saved as pending:", newTx.id);
    }
    
    return newTx;
  }, [canSyncOnline, loadedAccountId, loadData, savedClients, user, authLoading]);

  const deleteTransaction = async (id: string) => {
    if (!user || loadedAccountId !== user.id) throw new Error("Le stockage local du compte n’est pas encore prêt.");
    await offlineAccountStore.updateItem(user.id, "@tcha_pending_deletions", (value) => {
      const ids: string[] = value ? JSON.parse(value) : [];
      return JSON.stringify(ids.includes(id) ? ids : [...ids, id]);
    });

    const stored = await offlineAccountStore.updateItem(user.id, TX_KEY, (value) => {
      const all: Transaction[] = value ? JSON.parse(value) : [];
      return JSON.stringify(all.filter((tx) => tx.id !== id));
    });
    const updated: Transaction[] = stored ? JSON.parse(stored) : [];
    if (activeAccountIdRef.current === user.id) setTransactions(updated);

    if (canSyncOnline && isSubscriptionActive(user?.subscriptionExpiry)) {
      let deletionConfirmed = false;
      try {
        await apiDeleteTransaction(id);
        deletionConfirmed = true;
      } catch (error: any) {
        const status = error?.status ?? error?.statusCode;
        deletionConfirmed = status === 404;
        if (!deletionConfirmed) console.warn(`[TX] Delete sync failed; queued for retry: ${id}`, error?.message);
      }
      if (deletionConfirmed) {
        await offlineAccountStore.updateItem(user.id, "@tcha_pending_deletions", (value) => {
          const ids: string[] = value ? JSON.parse(value) : [];
          const remaining = ids.filter((queuedId) => queuedId !== id);
          return remaining.length ? JSON.stringify(remaining) : null;
        });
      }
    }
  };

  const getErrorTransactions = useCallback(() => {
    if (loadedAccountId !== user?.id) return [];
    return transactions.filter((t) => t.syncStatus === "error");
  }, [loadedAccountId, transactions, user?.id]);

  const clearErrorTransaction = async (id: string) => {
    if (!user || loadedAccountId !== user.id) throw new Error("Le stockage local du compte n’est pas encore prêt.");
    const stored = await offlineAccountStore.updateItem(user.id, TX_KEY, (value) => {
      const all: Transaction[] = value ? JSON.parse(value) : [];
      return JSON.stringify(all.filter((tx) => tx.id !== id));
    });
    if (activeAccountIdRef.current === user.id) setTransactions(stored ? JSON.parse(stored) : []);
    console.log(`[TX] Cleared error transaction: ${id}`);
  };

  const updateTransaction = async (id: string, changes: Partial<Omit<Transaction, "id" | "createdAt">>) => {
    if (!user || loadedAccountId !== user.id) throw new Error("Le stockage local du compte n’est pas encore prêt.");
    const stored = await offlineAccountStore.updateItem(user.id, TX_KEY, (value) => {
      const all: Transaction[] = value ? JSON.parse(value) : [];
      const originalTx = all.find((tx) => tx.id === id);
      if (!originalTx) return value;

      const newSyncStatus = originalTx.syncStatus === "pending" ? "pending" : "pending_update";
      const updated = all.map((tx) => (tx.id === id ? { ...tx, ...changes, syncStatus: newSyncStatus as SyncStatus } : tx));
      return JSON.stringify(updated);
    });
    const changedTx: Transaction | null = stored
      ? (JSON.parse(stored) as Transaction[]).find((tx) => tx.id === id) ?? null
      : null;
    if (!changedTx) return null;
    if (activeAccountIdRef.current === user.id && stored) setTransactions(JSON.parse(stored));

    if (canSyncOnline && isSubscriptionActive(user?.subscriptionExpiry)) {
      try {
        if (changedTx.syncStatus === "pending") {
          // Handled by pending create sync loop
        } else {
          await apiUpdateTransaction(id, {
            type: changedTx.type,
            clientName: changedTx.clientName,
            clientPhone: changedTx.clientPhone,
            amount: changedTx.amount,
            operator: changedTx.operator,
            note: changedTx.note || undefined,
            paid: parsePaid(changedTx.paid),
            savedClient: !!changedTx.savedClient,
            saleMode: changedTx.saleMode || undefined,
          });
          const latest = await loadData<Transaction>(TX_KEY);
          const finalTxs = latest.map((t) => t.id === id ? { ...t, syncStatus: "synced" as SyncStatus } : t);
          await saveTransactions(finalTxs);
          await refreshTransactionLogs();
        }
      } catch {
        // Keeps pending_update status
      }
    }

    return changedTx;
  };

  const getTransactionLogs = useCallback((transactionId?: string) => {
    if (loadedAccountId !== user?.id) return [];
    return transactionId
      ? transactionLogs.filter((log) => log.transactionId === transactionId)
      : transactionLogs;
  }, [loadedAccountId, transactionLogs, user?.id]);

  const getTodaySession = useCallback((agentId: string): DaySession | null => {
    if (loadedAccountId !== user?.id) return null;
    const today = todayString();
    return sessions.find((s) => s.agentId === agentId && s.date === today) ?? null;
  }, [loadedAccountId, sessions, user?.id]);

  const getSessionBalances = useCallback((agentId: string) => {
    if (loadedAccountId !== user?.id) {
      return { cash: 0, MTN: 0, Moov: 0, Celtis: 0, total: 0 };
    }
    const session = currentSessions.find((s) => s.agentId === agentId && s.date === todayString());
    if (!session) {
      return { cash: 0, MTN: 0, Moov: 0, Celtis: 0, total: 0 };
    }
    const filtered = currentTransactions.filter((t) => t.agentId === agentId && t.createdAt.startsWith(todayString()));
    return calculateSessionBalances(session, filtered);
  }, [currentSessions, currentTransactions, loadedAccountId, user?.id]);

  const getBalance = useCallback((agentId: string): number => {
    return getSessionBalances(agentId).total;
  }, [getSessionBalances]);

  const getTransactionsByDate = useCallback((date: string, agentId?: string) => {
    if (loadedAccountId !== user?.id) return [];
    return currentTransactions.filter((t) => {
      const txDate = new Date(t.createdAt).toDateString();
      const filterDate = new Date(date).toDateString();
      const matchDate = txDate === filterDate;
      const matchAgent = agentId ? t.agentId === agentId : true;
      return matchDate && matchAgent;
    });
  }, [currentTransactions, loadedAccountId, user?.id]);

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
    if (!user || loadedAccountId !== user.id) throw new Error("Le stockage local du compte n’est pas encore prêt.");
    const stored = await getStoredItem(SESSIONS_KEY);
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
      syncStatus: "pending",
    };
    const remaining = all.filter((s) => s.id !== existing.id);
    await saveSessions([reopenedSession, ...remaining]);

    if (canSyncOnline && isSubscriptionActive(user?.subscriptionExpiry)) {
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
  }, [canSyncOnline, getStoredItem, loadedAccountId, loadData, saveSessions, user?.id, user?.subscriptionExpiry]);

  const openDay = useCallback(async (agentId: string, openingBalances: { cash: number; MTN: number; Moov: number; Celtis: number }): Promise<DaySession> => {
    if (!user || loadedAccountId !== user.id) throw new Error("Le stockage local du compte n’est pas encore prêt.");
    const stored = await getStoredItem(SESSIONS_KEY);
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

    if (canSyncOnline && isSubscriptionActive(user?.subscriptionExpiry)) {
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
  }, [canSyncOnline, getStoredItem, loadedAccountId, loadData, reopenDay, saveSessions, user?.id, user?.subscriptionExpiry]);

  const closeDay = useCallback(async (agentId: string, closingCash: number): Promise<DaySession> => {
    if (!user || loadedAccountId !== user.id) throw new Error("Le stockage local du compte n’est pas encore prêt.");
    const stored = await getStoredItem(SESSIONS_KEY);
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

    if (canSyncOnline && isSubscriptionActive(user?.subscriptionExpiry)) {
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
  }, [canSyncOnline, getStoredItem, loadedAccountId, loadData, saveSessions, transactions, user?.id, user?.subscriptionExpiry]);

  const getYesterdayClosingBalances = useCallback((agentId: string) => {
    if (loadedAccountId !== user?.id) return null;
    const today = todayString();
    const past = sessions
      .filter((s) => s.agentId === agentId && s.date < today && !s.isOpen)
      .sort((a, b) => b.date.localeCompare(a.date));
    const lastSess = past[0];
    if (!lastSess || !lastSess.closingBalances) return null;
    return {
      cash: lastSess.closingBalances.cash ?? 0,
      MTN: lastSess.closingBalances.MTN ?? 0,
      Moov: lastSess.closingBalances.Moov ?? 0,
      Celtis: lastSess.closingBalances.Celtis ?? 0,
      total: lastSess.closingTotal ?? 0,
      date: lastSess.date,
    };
  }, [loadedAccountId, sessions, user?.id]);

  const autoCloseExpiredSessions = useCallback(async (agentId: string) => {
    if (!user || loadedAccountId !== user.id) return;
    const stored = await getStoredItem(SESSIONS_KEY);
    const all: DaySession[] = stored ? JSON.parse(stored) : [];
    const today = todayString();
    let changed = false;
    const updated = all.map((s) => {
      if (s.agentId === agentId && s.isOpen && s.date < today) {
        changed = true;
        const txs = transactions.filter((t) => t.agentId === agentId && t.createdAt.startsWith(s.date));
        const balances = calculateSessionBalances(s, txs);
        return {
          ...s,
          isOpen: false,
          closingBalances: { cash: balances.cash, MTN: balances.MTN, Moov: balances.Moov, Celtis: balances.Celtis },
          closingTotal: balances.total,
          closedAt: `${s.date}T23:59:00.000Z`,
          syncStatus: "pending" as const,
        };
      }
      return s;
    });
    if (changed) await saveSessions(updated);
  }, [getStoredItem, loadedAccountId, saveSessions, sessions, transactions, user?.id]);

  return (
    <TransactionContext.Provider value={{
      transactions: currentTransactions, sessions: currentSessions, transactionLogs: currentTransactionLogs, isOnline, syncStatusGlobal,
      addTransaction, updateTransaction, deleteTransaction, getErrorTransactions, clearErrorTransaction, getBalance,
      getSessionBalances, getTransactionsByDate, getTodayStats, refreshTransactions,
      getTodaySession, getYesterdayClosingBalances, autoCloseExpiredSessions,
      openDay, reopenDay, closeDay,
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

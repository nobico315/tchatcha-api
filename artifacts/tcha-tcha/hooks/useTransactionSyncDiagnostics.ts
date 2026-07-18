/**
 * Diagnostic tool for transaction sync status
 * Use this hook to debug transaction synchronization issues
 */

import { useTransactions } from "@/context/TransactionContext";
import { useCallback } from "react";

export interface SyncDiagnostics {
  totalTransactions: number;
  syncedCount: number;
  pendingCount: number;
  errorCount: number;
  pendingTransactions: Array<{ id: string; clientName: string; amount: number; createdAt: string }>;
  lastSyncAttempt?: Date;
}

export function useTransactionSyncDiagnostics(): SyncDiagnostics {
  const { transactions } = useTransactions();

  const diagnostics = useCallback((): SyncDiagnostics => {
    const synced = transactions.filter((t) => t.syncStatus === "synced");
    const pending = transactions.filter((t) => t.syncStatus === "pending");
    const errors = transactions.filter((t) => t.syncStatus === "error");

    return {
      totalTransactions: transactions.length,
      syncedCount: synced.length,
      pendingCount: pending.length,
      errorCount: errors.length,
      pendingTransactions: pending.map((t) => ({
        id: t.id,
        clientName: t.clientName,
        amount: t.amount,
        createdAt: t.createdAt,
      })),
    };
  }, [transactions]);

  return diagnostics();
}

/**
 * Log diagnostic info to console for debugging
 */
export function logTransactionDiagnostics() {
  // Note: Can only be used inside a component
  if (typeof window !== "undefined" || typeof global !== "undefined") {
    const { useTransactions } = require("@/context/TransactionContext");
    try {
      const { transactions, isOnline } = useTransactions() as any;
      console.log("[TX-DIAG] ==== Transaction Sync Diagnostics ====");
      console.log("[TX-DIAG] Online:", isOnline);
      console.log("[TX-DIAG] Total transactions:", transactions.length);
      console.log(
        "[TX-DIAG] Synced:",
        transactions.filter((t: any) => t.syncStatus === "synced").length
      );
      console.log(
        "[TX-DIAG] Pending:",
        transactions.filter((t: any) => t.syncStatus === "pending").length
      );
      console.log(
        "[TX-DIAG] Errors:",
        transactions.filter((t: any) => t.syncStatus === "error").length
      );
      console.log(
        "[TX-DIAG] Pending details:",
        transactions
          .filter((t: any) => t.syncStatus === "pending")
          .map((t: any) => ({
            id: t.id,
            client: t.clientName,
            amount: t.amount,
            createdAt: t.createdAt,
          }))
      );
      console.log("[TX-DIAG] ====================================");
    } catch (e) {
      console.error("[TX-DIAG] Error logging diagnostics:", e);
    }
  }
}

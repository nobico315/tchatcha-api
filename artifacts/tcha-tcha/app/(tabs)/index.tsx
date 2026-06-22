import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, BarChart2, Bell, RefreshCw } from "lucide-react-native";
import { router } from "expo-router";
import React, { useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BalanceCard } from "@/components/BalanceCard";
import { QuickActionItem } from "@/components/QuickActionItem";
import { SyncStatus } from "@/components/SyncStatus";
import { TransactionItem } from "@/components/TransactionItem";
import { AgentCard } from "@/components/AgentCard";
import { useAuth } from "@/context/AuthContext";
import { useTransactions } from "@/context/TransactionContext";
import { useAlerts } from "@/context/AlertContext";
import { useColors } from "@/hooks/useColors";
import { formatDate } from "@/utils/format";

export default function Dashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { transactions, syncStatusGlobal, getBalance, refreshTransactions } = useTransactions();
  const { unreadCount } = useAlerts();
  const [refreshed, setRefreshed] = useState(new Date().toISOString());
  const isGerant = user?.role === "gerant";

  const recent = transactions.filter((t) => !isGerant || t.agentId === user?.id).slice(0, 5);
  const balance = getBalance(user?.id);
  const today = formatDate(new Date().toISOString());

  const handleRefresh = async () => {
    await refreshTransactions();
    setRefreshed(new Date().toISOString());
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView
      style={[styles.bg, { backgroundColor: colors.surface }]}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}>
        <View style={styles.headerInner}>
          <View>
            <Text style={[styles.greeting, { color: colors.primary }]}>Bonjour {user?.firstName}</Text>
            <Text style={[styles.date, { color: colors.muted }]}>{today}</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/alerts")} style={styles.bellWrap}>
            <Bell size={22} color={colors.primary} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.syncRow}>
          <SyncStatus status={syncStatusGlobal} />
        </View>
      </View>

      <View style={{ paddingTop: 20, gap: 20 }}>
        {/* Balance Card */}
        <BalanceCard balance={balance} updatedAt={refreshed} onRefresh={handleRefresh} />

        {/* Manager extra stats */}
        {isGerant && (
          <View style={styles.statsRow}>
            {[
              { label: "Agents actifs", value: "3" },
              { label: "Tx aujourd'hui", value: `${transactions.length}` },
            ].map((s) => (
              <View key={s.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.statVal, { color: colors.primary }]}>{s.value}</Text>
                <Text style={[styles.statLabel, { color: colors.muted }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Quick actions */}
        <View style={{ paddingHorizontal: 20 }}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Actions rapides</Text>
          <View style={styles.grid}>
            <QuickActionItem label="Dépôt" icon={<ArrowDownCircle size={28} color={colors.successText} />} onPress={() => router.push("/new-transaction")} />
            <QuickActionItem label="Retrait" icon={<ArrowUpCircle size={28} color={colors.dangerText} />} onPress={() => router.push("/new-transaction")} />
            <QuickActionItem label="Rapport" icon={<BarChart2 size={28} color={colors.primary} />} onPress={() => router.push("/(tabs)/rapport")} />
            <QuickActionItem label="Alertes" icon={<AlertTriangle size={28} color={colors.primary} />} onPress={() => router.push("/alerts")} />
          </View>
        </View>

        {/* Recent transactions */}
        <View style={{ paddingHorizontal: 20 }}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>Transactions récentes</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/transactions")}>
              <Text style={[styles.seeAll, { color: colors.accent }]}>Voir tout</Text>
            </TouchableOpacity>
          </View>
          {recent.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.emptyText, { color: colors.muted }]}>Aucune transaction pour le moment.</Text>
            </View>
          ) : (
            recent.map((tx) => <TransactionItem key={tx.id} item={tx} onPress={() => {}} />)
          )}
        </View>

        {/* Agents section for manager */}
        {isGerant && (
          <View style={{ paddingHorizontal: 20 }}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>Mes agents</Text>
            <AgentCard
              agent={{ id: "demo", firstName: "Kouassi", lastName: "Koffi", phone: "+22960000001", pin: "000000", role: "agent", createdAt: "", subscriptionExpiry: "" }}
              txCount={transactions.length}
              balance={balance}
            />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  headerInner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  greeting: { fontSize: 20, fontFamily: "Poppins_700Bold" },
  date: { fontSize: 12, fontFamily: "Poppins_400Regular", marginTop: 2 },
  bellWrap: { position: "relative", padding: 4 },
  badge: {
    position: "absolute", top: 0, right: 0,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: "#b00000", alignItems: "center", justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 9, fontFamily: "Poppins_700Bold" },
  syncRow: { marginTop: 10 },
  sectionTitle: { fontSize: 16, fontFamily: "Poppins_700Bold", marginBottom: 12 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  seeAll: { fontSize: 13, fontFamily: "Poppins_600SemiBold" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statsRow: { flexDirection: "row", gap: 12, paddingHorizontal: 20 },
  statCard: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 16, alignItems: "center" },
  statVal: { fontSize: 22, fontFamily: "Poppins_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Poppins_400Regular", textAlign: "center", marginTop: 2 },
  empty: { padding: 24, borderRadius: 14, borderWidth: 1, alignItems: "center" },
  emptyText: { fontSize: 14, fontFamily: "Poppins_400Regular" },
});

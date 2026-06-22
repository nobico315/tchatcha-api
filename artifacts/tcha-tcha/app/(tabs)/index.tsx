import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, BarChart2, Bell, BookOpen, Lock } from "lucide-react-native";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BalanceCard } from "@/components/BalanceCard";
import { QuickActionItem } from "@/components/QuickActionItem";
import { SyncStatus } from "@/components/SyncStatus";
import { TransactionItem } from "@/components/TransactionItem";
import { useAuth, User } from "@/context/AuthContext";
import { useTransactions } from "@/context/TransactionContext";
import { useAlerts } from "@/context/AlertContext";
import { useColors } from "@/hooks/useColors";
import { formatAmount, formatDate } from "@/utils/format";

export default function Dashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getMyAgents } = useAuth();
  const { transactions, syncStatusGlobal, getBalance, refreshTransactions, getTodaySession, getTodayStats } = useTransactions();
  const { unreadCount } = useAlerts();
  const [refreshed, setRefreshed] = useState(new Date().toISOString());
  const [myAgents, setMyAgents] = useState<User[]>([]);
  const isGerant = user?.role === "gerant";

  useEffect(() => {
    if (isGerant) {
      getMyAgents().then(setMyAgents);
    }
  }, [isGerant, transactions]);

  const todaySession = user ? getTodaySession(user.id) : null;
  const balance = user ? getBalance(user.id) : 0;
  const todayStats = getTodayStats(user?.id);
  const today = formatDate(new Date().toISOString());

  const agentTxToday = isGerant
    ? transactions.filter((t) => myAgents.some((a) => a.id === t.agentId) && t.createdAt.startsWith(new Date().toISOString().split("T")[0]))
    : transactions.filter((t) => t.agentId === user?.id);

  const recent = agentTxToday.slice(0, 5);

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
            <Text style={[styles.greeting, { color: colors.primary }]}>
              Bonjour {user?.firstName} {isGerant ? "👔" : ""}
            </Text>
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

        {/* ── AGENT: Bannière journée ── */}
        {!isGerant && (
          <View style={{ paddingHorizontal: 20 }}>
            {!todaySession ? (
              <TouchableOpacity
                style={[styles.dayBanner, { backgroundColor: colors.primary }]}
                onPress={() => router.push("/ouvrir-journee")}
                activeOpacity={0.85}
              >
                <BookOpen size={22} color="#FFD700" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.dayBannerTitle}>Ouvrir la journée</Text>
                  <Text style={styles.dayBannerSub}>Saisissez votre fond de caisse pour commencer</Text>
                </View>
                <View style={styles.dayBannerBtn}>
                  <Text style={styles.dayBannerBtnText}>Démarrer</Text>
                </View>
              </TouchableOpacity>
            ) : todaySession.isOpen ? (
              <View style={[styles.dayBannerOpen, { backgroundColor: colors.successBg, borderColor: colors.successText }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.dayBannerTitle, { color: colors.successText }]}>Journée ouverte</Text>
                  <Text style={[styles.dayBannerSub, { color: colors.successText }]}>
                    Fond de caisse : {formatAmount(todaySession.openingBalance)} FCFA
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.closeDayBtn, { backgroundColor: colors.dangerText }]}
                  onPress={() => router.push("/fermer-journee")}
                >
                  <Lock size={14} color="#fff" />
                  <Text style={styles.closeDayBtnText}>Clôturer</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={[styles.dayBannerOpen, { backgroundColor: "#f5f5f5", borderColor: colors.border }]}>
                <Text style={[styles.dayBannerTitle, { color: colors.muted }]}>Journée clôturée</Text>
                <Text style={[styles.dayBannerSub, { color: colors.muted }]}>Rapport disponible dans l'onglet Rapport</Text>
              </View>
            )}
          </View>
        )}

        {/* Balance Card (agents only) */}
        {!isGerant && (
          <BalanceCard balance={balance} updatedAt={refreshed} onRefresh={handleRefresh} />
        )}

        {/* Manager dashboard stats */}
        {isGerant && (
          <View style={styles.statsRow}>
            {[
              { label: "Mes agents", value: `${myAgents.length}` },
              { label: "Tx aujourd'hui", value: `${agentTxToday.length}` },
              { label: "Total dépôts", value: formatAmount(agentTxToday.filter(t => t.type === "depot").reduce((s, t) => s + t.amount, 0)) },
              { label: "Total retraits", value: formatAmount(agentTxToday.filter(t => t.type === "retrait").reduce((s, t) => s + t.amount, 0)) },
            ].map((s) => (
              <View key={s.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.statVal, { color: colors.primary }]} numberOfLines={1}>{s.value}</Text>
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
            {!isGerant && (
              <TouchableOpacity onPress={() => router.push("/(tabs)/transactions")}>
                <Text style={[styles.seeAll, { color: colors.accent }]}>Voir tout</Text>
              </TouchableOpacity>
            )}
          </View>
          {recent.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.emptyText, { color: colors.muted }]}>Aucune transaction aujourd'hui.</Text>
            </View>
          ) : (
            recent.map((tx) => <TransactionItem key={tx.id} item={tx} onPress={() => {}} />)
          )}
        </View>
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
  dayBanner: {
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  dayBannerOpen: {
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1.5,
  },
  dayBannerTitle: { color: "#fff", fontSize: 15, fontFamily: "Poppins_700Bold" },
  dayBannerSub: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontFamily: "Poppins_400Regular", marginTop: 2 },
  dayBannerBtn: { backgroundColor: "#FFD700", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  dayBannerBtnText: { color: "#191970", fontSize: 13, fontFamily: "Poppins_700Bold" },
  closeDayBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  closeDayBtnText: { color: "#fff", fontSize: 13, fontFamily: "Poppins_700Bold" },
  sectionTitle: { fontSize: 16, fontFamily: "Poppins_700Bold", marginBottom: 12 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  seeAll: { fontSize: 13, fontFamily: "Poppins_600SemiBold" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statsRow: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 20 },
  statCard: { width: "47%", borderRadius: 14, borderWidth: 1, padding: 16, alignItems: "center" },
  statVal: { fontSize: 18, fontFamily: "Poppins_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Poppins_400Regular", textAlign: "center", marginTop: 2 },
  empty: { padding: 24, borderRadius: 14, borderWidth: 1, alignItems: "center" },
  emptyText: { fontSize: 14, fontFamily: "Poppins_400Regular" },
});

import { 
  ArrowDownCircle, 
  ArrowUpCircle, 
  BarChart2, 
  Bell, 
  BookOpen, 
  Lock, 
  AlertCircle, 
  Smartphone, 
  Coins,
  UserCheck,
  Archive,
} from "lucide-react-native";
import { router } from "expo-router";
import React, { useEffect, useState, useMemo } from "react";
import { 
  Alert,
  Platform, 
  ScrollView, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  useWindowDimensions, 
  View 
} from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { BalanceCard } from "@/components/BalanceCard";
import { ErrorTransactionAlert } from "@/components/ErrorTransactionAlert";
import { SyncStatus } from "@/components/SyncStatus";
import { TransactionItem } from "@/components/TransactionItem";
import { AgentCard } from "@/components/AgentCard";
import { useAuth, User } from "@/context/AuthContext";
import { useTransactions } from "@/context/TransactionContext";
import { useAlerts } from "@/context/AlertContext";
import { useColors } from "@/hooks/useColors";
import { formatAmount, formatDate } from "@/utils/format";
import { 
  calculateCommission, 
  loadCommissionSettings, 
  CommissionSettings, 
  DEFAULT_COMMISSION_SETTINGS, 
  Operator 
} from "@/utils/commission";

export default function Dashboard() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user, getMyAgents } = useAuth();
  const { 
    transactions, 
    syncStatusGlobal, 
    getBalance, 
    refreshTransactions, 
    getTodaySession, 
    getTodayStats, 
    getErrorTransactions, 
    getSessionBalances,
    reopenDay,
  } = useTransactions();
  const { unreadCount, sendReminder } = useAlerts();
  const [refreshed, setRefreshed] = useState(new Date().toISOString());
  const [myAgents, setMyAgents] = useState<User[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [commSettings, setCommSettings] = useState<CommissionSettings>(DEFAULT_COMMISSION_SETTINGS);
  const [reopening, setReopening] = useState(false);
  
  const isGerant = user?.role === "gerant";
  const errorTxs = getErrorTransactions();

  // Load commission settings and agents on mount
  useEffect(() => {
    async function initData() {
      const settings = await loadCommissionSettings();
      setCommSettings(settings);
      
      if (isGerant) {
        getMyAgents().then(setMyAgents);
      }
    }
    initData();
  }, [isGerant, transactions]);

  const todaySession = user ? getTodaySession(user.id) : null;
  const balance = user ? getBalance(user.id) : 0;
  const sessionBalances = user ? getSessionBalances(user.id) : undefined;
  const todayStats = getTodayStats(user?.id);
  const today = formatDate(new Date().toISOString());

  // Filter transactions made today
  const agentTxToday = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    return transactions.filter((t) => {
      const isToday = t.createdAt.startsWith(todayStr);
      const isMatch = isGerant 
        ? myAgents.some((a) => a.id === t.agentId) 
        : t.agentId === user?.id;
      return isToday && isMatch;
    });
  }, [transactions, myAgents, isGerant, user]);

  const isCompactLayout = width < 380;
  const statCardWidth = (width - 40 - 10) / 2;
  const quickActionWidth = isCompactLayout ? (width - 40 - 8) / 2 : (width - 40 - 24) / 4;
  const visibleAgentCount = isCompactLayout ? 2 : 3;
  const visibleRecentCount = isCompactLayout ? 3 : 4;
  const recent = useMemo(() => agentTxToday.slice(0, isGerant ? visibleRecentCount : 5), [agentTxToday, isGerant, visibleRecentCount]);

  // Calculate today's estimated profits (commissions)
  const todayCommission = useMemo(() => {
    return agentTxToday.reduce((sum, tx) => {
      return sum + calculateCommission(tx.type, tx.amount, tx.operator as Operator, commSettings);
    }, 0);
  }, [agentTxToday, commSettings]);

  const handleRefresh = async () => {
    await refreshTransactions();
    setRefreshed(new Date().toISOString());
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const quickActions = [
    {
      label: "Dépôt",
      icon: <ArrowDownCircle size={24} color={colors.successText} />,
      bg: colors.successBg,
      onPress: () => router.push("/new-transaction?type=depot"),
    },
    {
      label: "Retrait",
      icon: <ArrowUpCircle size={24} color={colors.dangerText} />,
      bg: colors.dangerBg,
      onPress: () => router.push("/new-transaction?type=retrait"),
    },
    {
      label: "Crédit",
      icon: <Smartphone size={24} color={colors.primary} />,
      bg: "rgba(25, 25, 112, 0.07)",
      onPress: () => router.push("/new-transaction?type=vente"),
    },
    {
      label: "Stock",
      icon: <Archive size={24} color="#00C3FF" />,
      bg: "rgba(0, 195, 255, 0.08)",
      onPress: () => router.push("/stock"),
    },
  ];

  return (
    <>
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
                Bonjour {user?.firstName}
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
          {/* ── AGENT: Day Session Banner ── */}
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
                      Démarrage : {formatAmount(todaySession.openingTotal ?? todaySession.openingBalance ?? 0)} FCFA
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
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.dayBannerTitle, { color: colors.muted }]}>Journée clôturée</Text>
                    <Text style={[styles.dayBannerSub, { color: colors.muted }]}>Rapport disponible dans l'onglet Rapport</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.closeDayBtn, { backgroundColor: colors.primary }]}
                    onPress={async () => {
                      if (!user || reopening) return;
                      setReopening(true);
                      try {
                        await reopenDay(user.id);
                        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        router.replace("/");
                      } catch (err) {
                        Alert.alert("Erreur", (err as Error)?.message ?? "Impossible de rouvrir la journée.");
                      } finally {
                        setReopening(false);
                      }
                    }}
                    disabled={reopening}
                  >
                    <Lock size={14} color="#fff" />
                    <Text style={styles.closeDayBtnText}>{reopening ? "Rouverte..." : "Rouvrir"}</Text>
                  </TouchableOpacity>
                </View>
              )}

              <View style={styles.balanceCardWrap}>
                <BalanceCard
                  balance={balance}
                  sessionBalances={sessionBalances}
                  updatedAt={refreshed}
                  onRefresh={handleRefresh}
                />
              </View>

              {/* Daily profit badge under the balance card */}
              <View style={styles.profitBadgeContainer}>
                <View style={[styles.profitBadge, { backgroundColor: colors.successBg, borderColor: colors.successText }]}>
                  <View style={styles.profitBadgeLeft}>
                    <Coins size={16} color={colors.successText} />
                    <Text style={[styles.profitBadgeLabel, { color: colors.successText }]}>Bénéfices aujourd'hui</Text>
                  </View>
                  <Text style={[styles.profitBadgeValue, { color: colors.successText }]}>+ {formatAmount(todayCommission)} FCFA</Text>
                </View>
              </View>

              {/* Agent's Manager Info Card */}
              {user?.manager && (
                <View style={styles.managerCardContainer}>
                  <View style={[styles.managerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.managerCardLeft}>
                      <View style={[styles.managerIconBg, { backgroundColor: "rgba(25, 25, 112, 0.06)" }]}>
                        <UserCheck size={16} color={colors.primary} />
                      </View>
                      <View style={{ marginLeft: 8 }}>
                        <Text style={[styles.managerLabel, { color: colors.muted }]}>Mon Gérant</Text>
                        <Text style={[styles.managerName, { color: colors.text }]}>
                          {user.manager.firstName} {user.manager.lastName}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.managerPhone, { color: colors.primary }]}>{user.manager.phone}</Text>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Manager dashboard stats */}
          {isGerant && (
            <View style={{ gap: 12 }}>
              <View style={styles.statsRow}>
                {[
                  { label: "Mes agents", value: `${myAgents.length}` },
                  { label: "Tx aujourd'hui", value: `${agentTxToday.length}` },
                  { label: "Total dépôts", value: formatAmount(agentTxToday.filter(t => t.type === "depot").reduce((s, t) => s + t.amount, 0)) },
                  { label: "Total retraits", value: formatAmount(agentTxToday.filter(t => t.type === "retrait").reduce((s, t) => s + t.amount, 0)) },
                ].map((s) => (
                  <View key={s.label} style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border, width: statCardWidth, minWidth: statCardWidth }]}>
                    <Text style={[styles.statVal, { color: colors.primary }]} numberOfLines={1}>{s.value}</Text>
                    <Text style={[styles.statLabel, { color: colors.muted }]}>{s.label}</Text>
                  </View>
                ))}
              </View>
              
              {/* Consolidated profits banner for manager */}
              <View style={{ paddingHorizontal: 20 }}>
                <LinearGradient colors={["#191970", "#0B0B3F"]} style={styles.managerProfitBanner}>
                  <View style={styles.managerProfitHeader}>
                    <Coins size={18} color="#FFD700" />
                    <Text style={styles.managerProfitLabel}>Bénéfices consolidés (Aujourd'hui)</Text>
                  </View>
                  <Text style={styles.managerProfitValue}>+ {formatAmount(todayCommission)} FCFA</Text>
                </LinearGradient>
              </View>

              {/* Manager's Active Team members on home dashboard */}
              <View style={{ paddingHorizontal: 20, marginTop: 4 }}>
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.primary }]}>Membres de l'équipe ({myAgents.length})</Text>
                  <TouchableOpacity onPress={() => router.push("/equipe")}> 
                    <Text style={[styles.seeAll, { color: colors.accent }]}>Gérer</Text>
                  </TouchableOpacity>
                </View>
                
                {myAgents.length === 0 ? (
                  <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.emptyText, { color: colors.muted }]}>Aucun agent rattaché.</Text>
                  </View>
                ) : (
                  myAgents.slice(0, visibleAgentCount).map((agent) => {
                    const todayStr = new Date().toISOString().split("T")[0];
                    const txCount = transactions.filter((t) => t.agentId === agent.id && t.createdAt.startsWith(todayStr)).length;
                    const balance = getBalance(agent.id);
                    return (
                      <AgentCard
                        key={agent.id}
                        agent={agent}
                        txCount={txCount}
                        balance={balance}
                        onPress={() => router.push("/equipe")}
                      />
                    );
                  })
                )}
              </View>
            </View>
          )}

          {/* Quick actions (Beautiful, accessible, responsive horizontal layout) */}
          <View style={{ paddingHorizontal: 20 }}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>Actions rapides</Text>
            <View style={styles.quickActionsContainer}>
              {quickActions.map((act) => (
                <TouchableOpacity
                  key={act.label}
                  style={[styles.quickActionBtn, { width: quickActionWidth }]}
                  onPress={act.onPress}
                  activeOpacity={0.75}
                >
                  <View style={[styles.quickActionIconWrap, { backgroundColor: act.bg }]}>
                    {act.icon}
                  </View>
                  <Text style={[styles.quickActionLabel, { color: colors.text }]} numberOfLines={1}>
                    {act.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Recent transactions */}
          <View style={{ paddingHorizontal: 20 }}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.primary }]}>Transactions récentes</Text>
              {!isGerant && (
                <TouchableOpacity onPress={() => router.push("/transactions")}>
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

      {/* Error Transaction Alert */}
      {errorTxs.length > 0 && (
        <View style={[styles.errorBanner, { backgroundColor: "#fee2e2" }]}>
          <TouchableOpacity
            style={styles.errorBannerContent}
            onPress={() => setShowErrors(true)}
            activeOpacity={0.7}
          >
            <AlertCircle size={20} color="#ef4444" />
            <Text style={styles.errorBannerText}>
              {errorTxs.length} transaction{errorTxs.length > 1 ? "s" : ""} en erreur
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ErrorTransactionAlert visible={showErrors} onDismiss={() => setShowErrors(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerInner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  greeting: { fontSize: 22, fontFamily: "Poppins_700Bold" },
  date: { fontSize: 14, fontFamily: "Poppins_400Regular", marginTop: 4 },
  bellWrap: { position: "relative", padding: 8, minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center" },
  badge: {
    position: "absolute", top: -2, right: -2,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: "#b00000", alignItems: "center", justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontFamily: "Poppins_700Bold" },
  syncRow: { marginTop: 12 },
  dayBanner: {
    borderRadius: 16,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 80,
    marginBottom: 18,
  },
  dayBannerOpen: {
    borderRadius: 16,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1.5,
    minHeight: 80,
    marginBottom: 18,
  },
  dayBannerTitle: { color: "#fff", fontSize: 17, fontFamily: "Poppins_700Bold" },
  dayBannerSub: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Poppins_400Regular", marginTop: 4 },
  dayBannerBtn: { backgroundColor: "#FFD700", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, minHeight: 44, justifyContent: "center" },
  dayBannerBtnText: { color: "#191970", fontSize: 14, fontFamily: "Poppins_700Bold" },
  closeDayBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, minHeight: 44, justifyContent: "center" },
  closeDayBtnText: { color: "#fff", fontSize: 14, fontFamily: "Poppins_700Bold" },
  sectionTitle: { fontSize: 16, fontFamily: "Poppins_700Bold", marginBottom: 12 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  seeAll: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  
  // Refactored Quick Actions Styles
  quickActionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    paddingBottom: 4,
  },
  quickActionBtn: {
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  quickActionIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionLabel: {
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    textAlign: "center",
  },

  // Balance card spacing
  balanceCardWrap: {
    marginBottom: 18,
  },

  // Agent Daily Profit Badge
  profitBadgeContainer: {
    paddingHorizontal: 0,
    marginBottom: 4,
  },
  profitBadge: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  profitBadgeLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  profitBadgeLabel: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
  },
  profitBadgeValue: {
    fontSize: 13,
    fontFamily: "Poppins_700Bold",
  },

  // Manager Profit Banner
  managerProfitBanner: {
    borderRadius: 14,
    padding: 16,
    gap: 6,
  },
  managerProfitHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  managerProfitLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  managerProfitValue: {
    color: "#FFFFFF",
    fontSize: 20,
    fontFamily: "Poppins_700Bold",
  },

  statsRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 10, paddingHorizontal: 20 },
  statCard: { borderRadius: 14, borderWidth: 1, padding: 14, alignItems: "center", minHeight: 85, marginBottom: 4 },
  statVal: { fontSize: 18, fontFamily: "Poppins_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Poppins_400Regular", textAlign: "center", marginTop: 4 },
  empty: { padding: 24, borderRadius: 14, borderWidth: 1, alignItems: "center" },
  emptyText: { fontSize: 14, fontFamily: "Poppins_400Regular" },
  errorBanner: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 12, borderTopWidth: 1, borderTopColor: "#fecaca" },
  errorBannerContent: { flexDirection: "row", alignItems: "center", gap: 12, justifyContent: "center" },
  errorBannerText: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#991b1b" },

  // Manager Card styles for Agents
  managerCardContainer: {
    paddingHorizontal: 20,
    marginTop: 4,
  },
  managerCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  managerCardLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  managerIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  managerLabel: {
    fontSize: 9,
    fontFamily: "Poppins_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  managerName: {
    fontSize: 13,
    fontFamily: "Poppins_700Bold",
    marginTop: 1,
  },
  managerPhone: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
  },
});
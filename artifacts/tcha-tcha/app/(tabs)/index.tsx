import { 
  ArrowDownCircle, 
  ArrowUpCircle, 
  Bell, 
  CloudOff,
  RefreshCw, 
  Lock, 
  AlertCircle, 
  Smartphone, 
  X,
  Coins,
  ChevronRight,
  TrendingUp,
  UserCheck,
} from "lucide-react-native";
import { router } from "expo-router";
import React, { useEffect, useState, useMemo, useRef } from "react";
import { 
  Alert,
  Animated,
  Easing,
  Modal,
  Platform, 
  RefreshControl,
  ScrollView, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  useWindowDimensions, 
  View 
} from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ErrorTransactionAlert } from "@/components/ErrorTransactionAlert";
import { TransactionItem } from "@/components/TransactionItem";
import { AgentCard } from "@/components/AgentCard";
import { isSubscriptionActive, useAuth, User } from "@/context/AuthContext";
import { useTransactions } from "@/context/TransactionContext";
import { useAlerts } from "@/context/AlertContext";
import { formatAmount, formatDate, formatTime } from "@/utils/format";
import { 
  calculateCommission, 
  loadCommissionSettings, 
  CommissionSettings, 
  DEFAULT_COMMISSION_SETTINGS, 
  Operator 
} from "@/utils/commission";

export default function Dashboard() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user, getMyAgents } = useAuth();
  const { 
    transactions, 
    isOnline,
    getBalance, 
    refreshTransactions, 
    getTodaySession, 
    getErrorTransactions, 
    getSessionBalances,
    reopenDay,
  } = useTransactions();
  const { unreadCount } = useAlerts();
  const [refreshed, setRefreshed] = useState(new Date().toISOString());
  const [myAgents, setMyAgents] = useState<User[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [commSettings, setCommSettings] = useState<CommissionSettings>(DEFAULT_COMMISSION_SETTINGS);
  const [reopening, setReopening] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const isGerant = user?.role === "gerant";
  const isSubscriptionActiveNow = isSubscriptionActive(user?.subscriptionExpiry);
  const syncStyle = !isSubscriptionActiveNow
    ? { bg: "#FEF2F2", border: "#FECACA", iconColor: "#DC2626" }
    : isOnline
      ? { bg: "#F0FDF4", border: "#BBF7D0", iconColor: "#15803D" }
      : { bg: "#FFFBEB", border: "#FDE68A", iconColor: "#B45309" };

  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isRefreshing) {
      spinValue.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 850,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [isRefreshing, spinValue]);

  const spinInterpolate = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });
  const syncAccessibilityLabel = !isSubscriptionActiveNow
    ? "Synchronisation désactivée, abonnement expiré"
    : isOnline
      ? "Synchronisation en ligne active"
      : "Synchronisation en attente, hors ligne";
  const errorTxs = getErrorTransactions();

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
  const today = formatDate(new Date().toISOString());
  const lastUpdateTime = formatTime(refreshed);

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

  const recent = useMemo(() => agentTxToday.slice(0, 5), [agentTxToday]);

  const todayCommission = useMemo(() => {
    return agentTxToday.reduce((sum, tx) => {
      return sum + calculateCommission(tx.type, tx.amount, tx.operator as Operator, commSettings);
    }, 0);
  }, [agentTxToday, commSettings]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshTransactions();
      setRefreshed(new Date().toISOString());
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } finally {
      setIsRefreshing(false);
    }
  };

  const topPad = Platform.OS === "web" ? 34 : insets.top;

  const isDayOpen = !!(todaySession && todaySession.isOpen);

  const handleQuickAction = (targetType: string) => {
    if (!isDayOpen && agentTxToday.length >= 1) {
      Alert.alert(
        "Ouverture de journée requise",
        "Vous avez déjà enregistré une opération sans ouverture de caisse.\n\nPour continuer vos opérations, vous devez ouvrir votre journée et saisir votre fond de caisse.",
        [
          { text: "Annuler", style: "cancel" },
          { text: "Ouvrir la journée", onPress: () => router.push("/ouvrir-journee") },
        ]
      );
      return;
    }
    router.push(`/new-transaction?type=${targetType}` as any);
  };

  const quickActions = [
    {
      label: "Dépôt",
      icon: <ArrowDownCircle size={28} color="#16A34A" strokeWidth={2.2} />,
      bg: "#D8F8E6",
      onPress: () => handleQuickAction("depot"),
    },
    {
      label: "Retrait",
      icon: <ArrowUpCircle size={28} color="#EF4444" strokeWidth={2.2} />,
      bg: "#FDE2E4",
      onPress: () => handleQuickAction("retrait"),
    },
    {
      label: "Crédit",
      icon: <Smartphone size={28} color="#6366F1" strokeWidth={2.2} />,
      bg: "#ECE8FF",
      onPress: () => handleQuickAction("vente"),
    },
  ];

  const agentDisplayName = user?.lastName || user?.firstName || "Medessi";

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#191970"
            colors={["#191970"]}
          />
        }
      >
        {/* ── 1. Header (White background, black & 8E9AB4) ── */}
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <View style={styles.headerLeft}>
            <Text style={styles.greetingText}>Bonjour Agent {agentDisplayName}</Text>
            <Text style={styles.dateText}>{today}</Text>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              onPress={handleRefresh}
              disabled={isRefreshing}
              style={[
                styles.syncBtn,
                { backgroundColor: syncStyle.bg, borderColor: syncStyle.border },
              ]}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={syncAccessibilityLabel}
            >
              {!isOnline && isSubscriptionActiveNow ? (
                <CloudOff size={18} color={syncStyle.iconColor} strokeWidth={2.2} />
              ) : (
                <Animated.View style={{ transform: [{ rotate: spinInterpolate }] }}>
                  <RefreshCw size={18} color={syncStyle.iconColor} strokeWidth={2.3} />
                </Animated.View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/alerts")}
              style={styles.bellBtn}
              activeOpacity={0.75}
            >
              <Bell size={19} color="#0F172A" strokeWidth={2.1} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── 2. Banner "Ouvrir la journée" (Deep #191970) ── */}
        <View style={styles.sectionPad}>
          {!isDayOpen ? (
            <View style={styles.dayBanner}>
              <View style={styles.dayBannerLeft}>
                <Text style={styles.dayBannerTitle}>
                  {agentTxToday.length >= 1 ? "Ouverture requise" : "Ouvrir la journée"}
                </Text>
                <Text style={styles.dayBannerSub}>
                  {agentTxToday.length >= 1
                    ? "1 opération enregistrée • Saisissez votre fond"
                    : "Saisissez votre fond de caisse"}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.dayBannerBtn}
                onPress={() => router.push("/ouvrir-journee")}
                activeOpacity={0.85}
              >
                <Text style={styles.dayBannerBtnText}>
                  {agentTxToday.length >= 1 ? "Ouvrir" : "Démarrer"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.dayBanner}>
              <View style={styles.dayBannerLeft}>
                <Text style={styles.dayBannerTitle}>Journée ouverte</Text>
                <Text style={styles.dayBannerSub}>
                  Fond : {formatAmount(todaySession?.openingTotal ?? todaySession?.openingBalance ?? 0)} FCFA
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.dayBannerBtn, { backgroundColor: "#FFFFFF" }]}
                onPress={() => router.push("/fermer-journee")}
                activeOpacity={0.85}
              >
                <Text style={styles.dayBannerBtnText}>Clôturer</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── 3. Solde flottant total (Direct on white) ── */}
        <View style={styles.floatingBalanceSection}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={styles.balanceLabel}>Solde flottant total</Text>
            {/* Freemium counter pill */}
            {!isGerant && (
              <TouchableOpacity
                onPress={() => router.push("/abonnement")}
                activeOpacity={0.7}
                style={[
                  styles.quotaBadge,
                  agentTxToday.length >= 50 && styles.quotaBadgeFull,
                ]}
              >
                <Text style={[
                  styles.quotaBadgeText,
                  agentTxToday.length >= 50 && { color: "#EF4444" },
                ]}>
                  {agentTxToday.length}/50 tx aujourd'hui
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.balanceContentRow}>
            <View style={styles.balanceLeftCol}>
              <Text style={styles.balanceAmountText}>{formatAmount(balance)}</Text>
              <Text style={styles.balanceUpdateText}>Mis à jour à {lastUpdateTime}</Text>
            </View>

            <View style={styles.balanceRightCol}>
              <Text style={styles.balanceCurrencyText}>FCFA</Text>
              <TouchableOpacity onPress={() => setShowDetails(true)} activeOpacity={0.7}>
                <Text style={styles.balanceDetailsBtnText}>Détails</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── 4. Actions rapides (Dépôt, Retrait, Crédit) ── */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionHeading}>Actions rapides</Text>

          <View style={styles.quickActionsRow}>
            {quickActions.map((act) => (
              <TouchableOpacity
                key={act.label}
                style={styles.actionBtnWrap}
                onPress={act.onPress}
                activeOpacity={0.8}
              >
                <View style={[styles.actionIconBox, { backgroundColor: act.bg }]}>
                  {act.icon}
                </View>
                <Text style={styles.actionLabel}>{act.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── 5. Transactions récentes ── */}
        <View style={styles.recentSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeading}>Transactions récentes</Text>
            <TouchableOpacity onPress={() => router.push("/transactions")} activeOpacity={0.7}>
              <Text style={styles.seeAllText}>Voir tout</Text>
            </TouchableOpacity>
          </View>

          {recent.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>Aucune transaction enregistrée aujourd'hui.</Text>
            </View>
          ) : (
            recent.map((tx) => <TransactionItem key={tx.id} item={tx} onPress={() => {}} commissionSettings={commSettings} />)
          )}
        </View>
      </ScrollView>

      {/* ── Modal Détails du Solde ── */}
      <Modal visible={showDetails} transparent animationType="fade" onRequestClose={() => setShowDetails(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowDetails(false)}>
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Détails des soldes</Text>
              <TouchableOpacity onPress={() => setShowDetails(false)}>
                <X size={20} color="#000000" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalTotalBox}>
              <Text style={styles.modalTotalLabel}>Solde total disponible</Text>
              <Text style={styles.modalTotalAmount}>{formatAmount(balance)} FCFA</Text>
            </View>

            <View style={styles.simList}>
              {[
                { name: "Espèces (Caisse)", amount: sessionBalances?.cash ?? balance, color: "#16A34A" },
                { name: "MTN Mobile Money", amount: sessionBalances?.MTN ?? 0, color: "#EAB308" },
                { name: "Moov Money", amount: sessionBalances?.Moov ?? 0, color: "#0EA5E9" },
                { name: "Celtis Cash", amount: sessionBalances?.Celtis ?? 0, color: "#8B5CF6" },
              ].map((sim) => (
                <View key={sim.name} style={styles.simRow}>
                  <View style={styles.simLeft}>
                    <View style={[styles.simDot, { backgroundColor: sim.color }]} />
                    <Text style={styles.simName}>{sim.name}</Text>
                  </View>
                  <Text style={styles.simAmount}>{formatAmount(sim.amount)} F</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity 
              style={styles.modalCloseBtn}
              onPress={() => setShowDetails(false)}
            >
              <Text style={styles.modalCloseBtnText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Error Banner */}
      {errorTxs.length > 0 && (
        <View style={styles.errorBanner}>
          <TouchableOpacity
            style={styles.errorBannerContent}
            onPress={() => setShowErrors(true)}
            activeOpacity={0.7}
          >
            <AlertCircle size={18} color="#EF4444" />
            <Text style={styles.errorBannerText}>
              {errorTxs.length} transaction{errorTxs.length > 1 ? "s" : ""} en erreur
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <ErrorTransactionAlert visible={showErrors} onDismiss={() => setShowErrors(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  // ── Header ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
  },
  headerLeft: {
    flex: 1,
  },
  greetingText: {
    fontSize: 22,
    fontFamily: "Poppins_700Bold",
    color: "#000000",
    letterSpacing: -0.3,
  },
  dateText: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: "#8E9AB4",
    marginTop: 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  syncBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  bellBtn: {
    position: "relative",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontFamily: "Poppins_700Bold",
  },

  // ── Day Banner ──
  sectionPad: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  dayBanner: {
    backgroundColor: "#191970",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dayBannerLeft: {
    flex: 1,
    paddingRight: 12,
  },
  dayBannerTitle: {
    fontSize: 17,
    fontFamily: "Poppins_700Bold",
    color: "#FFFFFF",
  },
  dayBannerSub: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 3,
  },
  dayBannerBtn: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  dayBannerBtnText: {
    fontSize: 14,
    fontFamily: "Poppins_700Bold",
    color: "#000000",
  },

  // ── Floating Balance Section ──
  floatingBalanceSection: {
    paddingHorizontal: 24,
    marginTop: 28,
  },
  balanceLabel: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: "#8E9AB4",
  },
  balanceContentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 4,
  },
  balanceLeftCol: {
    flex: 1,
  },
  balanceAmountText: {
    fontSize: 54,
    fontFamily: "Poppins_700Bold",
    color: "#191970",
    lineHeight: 62,
  },
  balanceUpdateText: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: "#8E9AB4",
    marginTop: 4,
  },
  balanceRightCol: {
    alignItems: "flex-end",
    paddingTop: 8,
  },
  balanceCurrencyText: {
    fontSize: 20,
    fontFamily: "Poppins_700Bold",
    color: "#000000",
    textAlign: "right",
  },
  balanceDetailsBtnText: {
    fontSize: 14,
    fontFamily: "Poppins_700Bold",
    color: "#000000",
    marginTop: 22,
    textAlign: "right",
  },

  // ── Actions rapides ──
  actionsSection: {
    paddingHorizontal: 24,
    marginTop: 32,
  },
  sectionHeading: {
    fontSize: 19,
    fontFamily: "Poppins_700Bold",
    color: "#191970",
  },
  quickActionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
  },
  actionBtnWrap: {
    alignItems: "center",
    width: "30%",
  },
  actionIconBox: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  actionLabel: {
    fontSize: 13,
    fontFamily: "Poppins_700Bold",
    color: "#000000",
    marginTop: 10,
    textAlign: "center",
  },

  // ── Transactions récentes ──
  recentSection: {
    paddingHorizontal: 24,
    marginTop: 36,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  seeAllText: {
    fontSize: 14,
    fontFamily: "Poppins_700Bold",
    color: "#000000",
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: "#8E9AB4",
    textAlign: "center",
  },

  // ── Modal Détails ──
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Poppins_700Bold",
    color: "#191970",
  },
  modalTotalBox: {
    backgroundColor: "#F8FAFC",
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  modalTotalLabel: {
    fontSize: 12,
    fontFamily: "Poppins_400Regular",
    color: "#8E9AB4",
  },
  modalTotalAmount: {
    fontSize: 22,
    fontFamily: "Poppins_700Bold",
    color: "#191970",
    marginTop: 4,
  },
  simList: {
    gap: 12,
    marginBottom: 20,
  },
  simRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  simLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  simDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  simName: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: "#000000",
  },
  simAmount: {
    fontSize: 14,
    fontFamily: "Poppins_700Bold",
    color: "#191970",
  },
  modalCloseBtn: {
    backgroundColor: "#191970",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  modalCloseBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Poppins_700Bold",
  },

  // ── Error Banner ──
  errorBanner: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "#fef2f2",
    borderTopWidth: 1,
    borderTopColor: "#fecaca",
  },
  errorBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    justifyContent: "center",
  },
  errorBannerText: {
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
    color: "#991b1b",
  },
  quotaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F0F3FA",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D6DFEE",
  },
  quotaBadgeFull: {
    backgroundColor: "#FEE2E2",
    borderColor: "#FCA5A5",
  },
  quotaBadgeText: {
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    color: "#191970",
  },
});

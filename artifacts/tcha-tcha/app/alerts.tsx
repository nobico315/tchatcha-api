import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCheck,
  Clock,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react-native";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertType, AppAlert, useAlerts } from "@/context/AlertContext";
import { useColors } from "@/hooks/useColors";
import { formatTime } from "@/utils/format";

type FilterKey = "all" | "unread" | AlertType;

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "Toutes" },
  { key: "unread", label: "Non lues" },
  { key: "balance", label: "Soldes" },
  { key: "reminder", label: "Prévention" },
];

const alertConfig: Record<AlertType, { Icon: any; color: string; bg: string }> = {
  balance: { Icon: AlertTriangle, color: "#D97706", bg: "#FEF3C7" },
  subscription: { Icon: Clock, color: "#DC2626", bg: "#FEE2E2" },
  sync: { Icon: RefreshCw, color: "#0F766E", bg: "#CCFBF1" },
  reminder: { Icon: Bell, color: "#191970", bg: "#EEF2FF" },
};

function formatAlertDate(iso: string): string {
  const date = new Date(iso);
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const todayStr = new Date().toISOString().slice(0, 10);
  if (iso.slice(0, 10) === todayStr) return `Aujourd'hui · ${formatTime(iso)}`;
  return `${date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} · ${formatTime(iso)}`;
}

export default function Alerts() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { alerts, unreadCount, markAsRead, markAllRead, dismissAlert, refreshAlerts } = useAlerts();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [refreshing, setRefreshing] = useState(false);

  const topPad = Platform.OS === "web" ? 24 : insets.top;

  const filteredAlerts = useMemo(() => {
    if (filter === "all") return alerts;
    if (filter === "unread") return alerts.filter((a) => !a.read);
    return alerts.filter((a) => a.type === filter);
  }, [alerts, filter]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshAlerts();
    } finally {
      setRefreshing(false);
    }
  };

  const handlePressAlert = (alert: AppAlert) => {
    if (!alert.read) markAsRead(alert.id);
    if (alert.actionRoute) {
      router.replace(alert.actionRoute as any);
    }
  };

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14 }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.closeBtn}
            activeOpacity={0.75}
            accessibilityLabel="Fermer"
          >
            <X size={20} color="#475569" />
          </TouchableOpacity>
          <View>
            <Text style={[styles.heading, { color: colors.text }]}>Notifications</Text>
            <Text style={styles.subheading}>
              {unreadCount > 0 ? `${unreadCount} non lue(s)` : "Tout est à jour"}
            </Text>
          </View>
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={markAllRead}
            style={[styles.markAllBtn, { backgroundColor: "#EEF2FF" }]}
            activeOpacity={0.75}
          >
            <CheckCheck size={15} color={colors.primary} />
            <Text style={[styles.markAllText, { color: colors.primary }]}>Tout lire</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filtres */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[
                  styles.filterPill,
                  active && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
                activeOpacity={0.75}
              >
                <Text style={[styles.filterText, active && { color: "#FFFFFF" }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Liste */}
      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {filteredAlerts.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyIconWrap}>
              <Bell size={26} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTitle}>Aucune notification</Text>
            <Text style={styles.emptyDesc}>
              Les alertes de solde bas, rappels de caisse et synchronisations apparaîtront ici.
            </Text>
          </View>
        ) : (
          filteredAlerts.map((alert) => {
            const { Icon, color, bg } = alertConfig[alert.type];
            return (
              <TouchableOpacity
                key={alert.id}
                style={[
                  styles.card,
                  !alert.read && styles.cardUnread,
                  alert.read && { opacity: 0.72 },
                ]}
                onPress={() => handlePressAlert(alert)}
                activeOpacity={0.8}
              >
                <View style={[styles.iconWrap, { backgroundColor: bg }]}>
                  <Icon size={20} color={color} />
                </View>

                <View style={styles.content}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                      {alert.title}
                    </Text>
                    {!alert.read && (
                      <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
                    )}
                  </View>

                  <Text style={styles.desc}>{alert.description}</Text>

                  <View style={styles.footerRow}>
                    <Text style={styles.time}>{formatAlertDate(alert.createdAt)}</Text>

                    <View style={styles.footerActions}>
                      {alert.actionLabel && alert.actionRoute && (
                        <TouchableOpacity
                          onPress={() => handlePressAlert(alert)}
                          style={styles.actionPill}
                          activeOpacity={0.75}
                        >
                          <Text style={[styles.actionPillText, { color: colors.primary }]}>
                            {alert.actionLabel}
                          </Text>
                          <ArrowRight size={12} color={colors.primary} />
                        </TouchableOpacity>
                      )}

                      {alert.source === "local" && (
                        <TouchableOpacity
                          onPress={() => dismissAlert(alert.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityLabel="Supprimer"
                        >
                          <Trash2 size={15} color="#94A3B8" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  heading: { fontSize: 19, fontFamily: "Poppins_700Bold" },
  subheading: { fontSize: 12, fontFamily: "Poppins_400Regular", color: "#64748B" },
  markAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  markAllText: { fontSize: 12, fontFamily: "Poppins_600SemiBold" },

  filterBar: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  filterScroll: { paddingHorizontal: 20, paddingVertical: 10, gap: 8 },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterText: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: "#475569" },

  list: { padding: 16, gap: 12 },
  card: {
    flexDirection: "row",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 14,
    gap: 12,
    alignItems: "flex-start",
  },
  cardUnread: {
    borderColor: "#CBD5E1",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { flex: 1, gap: 5 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { flex: 1, fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  desc: { fontSize: 12, fontFamily: "Poppins_400Regular", lineHeight: 18, color: "#475569" },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  time: { fontSize: 11, fontFamily: "Poppins_400Regular", color: "#94A3B8" },
  footerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  actionPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#EEF2FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  actionPillText: { fontSize: 11, fontFamily: "Poppins_600SemiBold" },

  emptyBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 64,
    paddingHorizontal: 24,
    gap: 8,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, fontFamily: "Poppins_700Bold", color: "#0F172A" },
  emptyDesc: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
  },
});

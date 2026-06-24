import { ChevronLeft, ChevronRight, Download } from "lucide-react-native";
import React, { useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CustomBarChart } from "@/components/CustomBarChart";
import { MetricCard } from "@/components/MetricCard";
import { TransactionItem } from "@/components/TransactionItem";
import { useAuth } from "@/context/AuthContext";
import { useTransactions } from "@/context/TransactionContext";
import { useColors } from "@/hooks/useColors";
import { exportReportToPDF } from "@/utils/pdf";
import { formatDate, formatShortDate, toISODate } from "@/utils/format";

export default function Rapport() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { getTransactionsByDate, getTodayStats } = useTransactions();
  const [date, setDate] = useState(new Date());

  const addDay = (d: number) => {
    const nd = new Date(date);
    nd.setDate(nd.getDate() + d);
    if (nd <= new Date()) setDate(nd);
  };

  const dayTx = getTransactionsByDate(date.toISOString(), user?.id);
  
  const stats = React.useMemo(() => {
    const depots = dayTx.filter((t) => t.type === "depot").reduce((s, t) => s + t.amount, 0);
    const retraits = dayTx.filter((t) => t.type === "retrait").reduce((s, t) => s + t.amount, 0);
    const vente = dayTx.filter((t) => t.type === "vente").reduce((s, t) => s + t.amount, 0);
    return { depots, retraits, vente, soldeNet: depots - retraits, count: dayTx.length };
  }, [dayTx]);

  // Build hourly chart data
  const hours = Array.from({ length: 12 }, (_, i) => {
    const h = i * 2;
    const count = dayTx.filter((t) => new Date(t.createdAt).getHours() >= h && new Date(t.createdAt).getHours() < h + 2).length;
    return { label: `${h}h`, value: count };
  });

  const handleExportPDF = async () => {
    if (!user) {
      Alert.alert("Erreur", "Utilisateur non identifié");
      return;
    }

    await exportReportToPDF({
      agentName: `${user.firstName} ${user.lastName}`,
      date: date.toISOString(),
      stats,
      transactions: dayTx.map((tx) => ({
        id: tx.id,
        type: tx.type,
        clientName: tx.clientName,
        clientPhone: tx.clientPhone,
        amount: tx.amount,
        operator: tx.operator,
        note: tx.note,
        createdAt: tx.createdAt,
      })),
    });
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView style={[{ flex: 1, backgroundColor: colors.surface }]} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}>
        <Text style={[styles.heading, { color: colors.primary }]}>Rapport journalier</Text>
        <View style={styles.dateNav}>
          <TouchableOpacity onPress={() => addDay(-1)} style={[styles.navBtn, { borderColor: colors.border }]}>
            <ChevronLeft size={18} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.dateLabel, { color: colors.text }]}>
            {toISODate(date) === toISODate(new Date()) ? "Aujourd'hui" : formatShortDate(date.toISOString())}
          </Text>
          <TouchableOpacity
            onPress={() => addDay(1)}
            style={[styles.navBtn, { borderColor: colors.border, opacity: toISODate(date) === toISODate(new Date()) ? 0.3 : 1 }]}
            disabled={toISODate(date) === toISODate(new Date())}
          >
            <ChevronRight size={18} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.body}>
        {/* Metric cards */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricsRow}>
            <MetricCard label="Total dépôts" value={stats.depots} isCurrency bg={colors.successBg} textColor={colors.successText} />
            <MetricCard label="Total retraits" value={stats.retraits} isCurrency bg={colors.dangerBg} textColor={colors.dangerText} />
          </View>
          <View style={styles.metricsRow}>
            <MetricCard label="Solde net" value={stats.soldeNet} isCurrency bg="#eef0ff" textColor={colors.primary} />
            <MetricCard label="Nb transactions" value={stats.count} bg={colors.surface} textColor={colors.text} />
          </View>
        </View>

        {/* Chart */}
        <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.chartTitle, { color: colors.primary }]}>Transactions par heure</Text>
          <CustomBarChart data={hours} height={160} />
        </View>

        {/* Day transactions */}
        <View>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>
            {dayTx.length} transaction{dayTx.length !== 1 ? "s" : ""}
          </Text>
          {dayTx.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.emptyText, { color: colors.muted }]}>Aucune transaction ce jour.</Text>
            </View>
          ) : (
            dayTx.map((tx) => <TransactionItem key={tx.id} item={tx} />)
          )}
        </View>

        {/* Export */}
        <TouchableOpacity
          style={[styles.exportBtn, { borderColor: colors.primary }]}
          onPress={handleExportPDF}
        >
          <Download size={18} color={colors.primary} />
          <Text style={[styles.exportLabel, { color: colors.primary }]}>Exporter en PDF</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, gap: 14 },
  heading: { fontSize: 22, fontFamily: "Poppins_700Bold" },
  dateNav: { flexDirection: "row", alignItems: "center", gap: 16 },
  navBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  dateLabel: { fontSize: 15, fontFamily: "Poppins_600SemiBold", flex: 1, textAlign: "center" },
  body: { padding: 20, gap: 20 },
  metricsGrid: { gap: 12 },
  metricsRow: { flexDirection: "row", gap: 12 },
  chartCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  chartTitle: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  sectionTitle: { fontSize: 15, fontFamily: "Poppins_700Bold", marginBottom: 12 },
  empty: { padding: 24, borderRadius: 14, borderWidth: 1, alignItems: "center" },
  emptyText: { fontSize: 14, fontFamily: "Poppins_400Regular" },
  exportBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderWidth: 1.5, borderRadius: 12, height: 52 },
  exportLabel: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
});

import { RefreshCw } from "lucide-react-native";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { formatAmount, formatTime } from "@/utils/format";

interface SimBalances {
  cash: number;
  MTN: number;
  Moov: number;
  Celtis: number;
}

interface BalanceCardProps {
  balance: number;
  sessionBalances?: SimBalances;
  updatedAt?: string;
  onRefresh?: () => void;
}

const SIM_COLORS = {
  cash:   { bg: "rgba(255,255,255,0.15)", dot: "#FFD700", label: "Cash" },
  MTN:    { bg: "rgba(255,215,0,0.18)",   dot: "#FFD700", label: "MTN" },
  Moov:   { bg: "rgba(0,195,255,0.15)",   dot: "#00C3FF", label: "Moov" },
  Celtis: { bg: "rgba(100,255,150,0.15)", dot: "#64FF96", label: "Celtis" },
};

export function BalanceCard({ balance, sessionBalances, updatedAt, onRefresh }: BalanceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasBreakdown = sessionBalances !== undefined;

  return (
    <View style={styles.card}>
      {/* Header row */}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Solde flottant total</Text>
          <View style={styles.amountRow}>
            <Text style={styles.amount}>{formatAmount(balance)}</Text>
            <Text style={styles.currency}> FCFA</Text>
          </View>
          <Text style={styles.updated}>
            Mis à jour à {updatedAt ? formatTime(updatedAt) : formatTime(new Date().toISOString())}
          </Text>
        </View>
        <View style={{ gap: 8, alignItems: "flex-end" }}>
          <TouchableOpacity onPress={onRefresh} style={styles.iconBtn}>
            <RefreshCw color="rgba(255,255,255,0.6)" size={18} />
          </TouchableOpacity>
          {hasBreakdown && (
            <TouchableOpacity
              onPress={() => setExpanded((v) => !v)}
              style={styles.expandBtn}
            >
              <Text style={styles.expandText}>{expanded ? "Masquer" : "Détails"}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* SIM breakdown */}
      {expanded && hasBreakdown && (
        <View style={styles.breakdown}>
          <View style={styles.divider} />
          <Text style={styles.breakdownTitle}>Répartition par support</Text>
          <View style={styles.simGrid}>
            {(["cash", "MTN", "Moov", "Celtis"] as const).map((key) => {
              const conf = SIM_COLORS[key];
              const val = sessionBalances![key];
              return (
                <View key={key} style={[styles.simCard, { backgroundColor: conf.bg }]}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <View style={[styles.dot, { backgroundColor: conf.dot }]} />
                    <Text style={styles.simLabel}>{conf.label}</Text>
                  </View>
                  <Text style={styles.simAmount}>{formatAmount(val)}</Text>
                  <Text style={styles.simCurrency}>FCFA</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#191970",
    borderRadius: 20,
    padding: 24,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  label: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Poppins_400Regular", marginBottom: 6 },
  amountRow: { flexDirection: "row", alignItems: "baseline" },
  amount: { color: "#FFFFFF", fontSize: 28, fontFamily: "Poppins_700Bold" },
  currency: { color: "#FFD700", fontSize: 16, fontFamily: "Poppins_700Bold" },
  updated: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "Poppins_400Regular", marginTop: 4 },
  iconBtn: { padding: 4 },
  expandBtn: {
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  expandText: { color: "#FFD700", fontSize: 11, fontFamily: "Poppins_600SemiBold" },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.12)", marginVertical: 16 },
  breakdownTitle: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontFamily: "Poppins_600SemiBold", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  breakdown: {},
  simGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  simCard: {
    flex: 1,
    minWidth: "44%",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  simLabel: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: "Poppins_600SemiBold" },
  simAmount: { color: "#FFFFFF", fontSize: 16, fontFamily: "Poppins_700Bold", marginTop: 2 },
  simCurrency: { color: "rgba(255,255,255,0.5)", fontSize: 10, fontFamily: "Poppins_400Regular" },
});

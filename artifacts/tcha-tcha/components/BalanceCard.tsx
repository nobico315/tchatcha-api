import { RefreshCw } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { formatAmount, formatTime } from "@/utils/format";

interface BalanceCardProps {
  balance: number;
  updatedAt?: string;
  onRefresh?: () => void;
}

export function BalanceCard({ balance, updatedAt, onRefresh }: BalanceCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View>
          <Text style={styles.label}>Solde flottant</Text>
          <View style={styles.amountRow}>
            <Text style={styles.amount}>{formatAmount(balance)}</Text>
            <Text style={styles.currency}> FCFA</Text>
          </View>
          <Text style={styles.updated}>
            Mis à jour à {updatedAt ? formatTime(updatedAt) : formatTime(new Date().toISOString())}
          </Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refresh}>
          <RefreshCw color="rgba(255,255,255,0.6)" size={20} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#191970",
    borderRadius: 20,
    padding: 24,
    marginHorizontal: 20,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  label: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Poppins_400Regular", marginBottom: 6 },
  amountRow: { flexDirection: "row", alignItems: "baseline" },
  amount: { color: "#FFFFFF", fontSize: 28, fontFamily: "Poppins_700Bold" },
  currency: { color: "#FFD700", fontSize: 16, fontFamily: "Poppins_700Bold" },
  updated: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "Poppins_400Regular", marginTop: 4 },
  refresh: { padding: 4 },
});

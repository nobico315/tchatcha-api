import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { formatAmount } from "@/utils/format";
import { useColors } from "@/hooks/useColors";

interface MetricCardProps {
  label: string;
  value: number | string;
  isCurrency?: boolean;
  bg: string;
  textColor: string;
}

export function MetricCard({ label, value, isCurrency, bg, textColor }: MetricCardProps) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: bg, borderColor: colors.border }]}>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: textColor }]}>
          {isCurrency ? formatAmount(typeof value === "number" ? value : 0) : value}
        </Text>
        {isCurrency && <Text style={[styles.fcfa, { color: "#FFD700" }]}> FCFA</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 90,
    justifyContent: "space-between",
  },
  label: { fontSize: 11, fontFamily: "Poppins_600SemiBold", textTransform: "uppercase", letterSpacing: 0.4 },
  valueRow: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap" },
  value: { fontSize: 20, fontFamily: "Poppins_700Bold" },
  fcfa: { fontSize: 12, fontFamily: "Poppins_700Bold" },
});

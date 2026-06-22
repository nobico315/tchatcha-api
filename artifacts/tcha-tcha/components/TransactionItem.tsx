import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Transaction } from "@/context/TransactionContext";
import { useColors } from "@/hooks/useColors";
import { formatAmount, formatTime } from "@/utils/format";

interface TransactionItemProps {
  item: Transaction;
  onPress?: () => void;
}

export function TransactionItem({ item, onPress }: TransactionItemProps) {
  const colors = useColors();
  const isDepot = item.type === "depot";

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.dot, { backgroundColor: isDepot ? colors.successText : colors.dangerText }]} />
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.text, fontFamily: "Poppins_600SemiBold" }]} numberOfLines={1}>
          {item.clientName}
        </Text>
        <Text style={[styles.sub, { color: colors.muted, fontFamily: "Poppins_400Regular" }]}>
          {item.operator} · {formatTime(item.createdAt)}
        </Text>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, { color: isDepot ? colors.successText : colors.dangerText, fontFamily: "Poppins_700Bold" }]}>
          {isDepot ? "+" : "-"}{formatAmount(item.amount)}
        </Text>
        <Text style={[styles.fcfa, { color: colors.accent, fontFamily: "Poppins_600SemiBold" }]}>FCFA</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  info: { flex: 1 },
  name: { fontSize: 14 },
  sub: { fontSize: 12, marginTop: 2 },
  right: { alignItems: "flex-end" },
  amount: { fontSize: 15 },
  fcfa: { fontSize: 11, marginTop: 1 },
});

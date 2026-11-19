import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { User } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { formatAmount } from "@/utils/format";

interface AgentCardProps {
  agent: User;
  txCount: number;
  balance: number;
  onPress?: () => void;
}

export function AgentCard({ agent, txCount, balance, onPress }: AgentCardProps) {
  const colors = useColors();
  const initials = `${agent.firstName[0] || ""}${agent.lastName[0] || ""}`.toUpperCase();

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <LinearGradient colors={["#191970", "#0B0B3F"]} style={styles.avatar}>
        <Text style={styles.initials}>{initials}</Text>
      </LinearGradient>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.text }]}>
            {agent.firstName} {agent.lastName}
          </Text>
          <View style={styles.onlineDot} />
        </View>
        <Text style={[styles.phone, { color: colors.muted }]}>{agent.phone}</Text>
        <View style={styles.txBadge}>
          <Text style={[styles.stats, { color: colors.primary }]}>{txCount} tx aujourd'hui</Text>
        </View>
      </View>
      <View style={styles.right}>
        <Text style={[styles.balance, { color: colors.primary }]}>{formatAmount(balance)}</Text>
        <Text style={[styles.fcfa, { color: colors.accent }]}>FCFA</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    marginBottom: 10,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { color: "#FFD700", fontSize: 16, fontFamily: "Poppins_700Bold" },
  info: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontSize: 15, fontFamily: "Poppins_600SemiBold" },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22c55e" },
  phone: { fontSize: 12, fontFamily: "Poppins_400Regular", marginTop: 2 },
  txBadge: { marginTop: 4 },
  stats: { fontSize: 11, fontFamily: "Poppins_600SemiBold" },
  right: { alignItems: "flex-end" },
  balance: { fontSize: 16, fontFamily: "Poppins_700Bold" },
  fcfa: { fontSize: 10, fontFamily: "Poppins_600SemiBold", textTransform: "uppercase", letterSpacing: 0.4 },
});

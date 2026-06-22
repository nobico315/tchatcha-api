import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
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
  const initials = `${agent.firstName[0]}${agent.lastName[0]}`.toUpperCase();

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.avatar}>
        <Text style={styles.initials}>{initials}</Text>
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.text }]}>{agent.firstName} {agent.lastName}</Text>
        <Text style={[styles.phone, { color: colors.muted }]}>{agent.phone}</Text>
        <Text style={[styles.stats, { color: colors.muted }]}>{txCount} tx aujourd'hui</Text>
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
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#191970",
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { color: "#FFD700", fontSize: 16, fontFamily: "Poppins_700Bold" },
  info: { flex: 1 },
  name: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  phone: { fontSize: 12, fontFamily: "Poppins_400Regular", marginTop: 1 },
  stats: { fontSize: 11, fontFamily: "Poppins_400Regular", marginTop: 1 },
  right: { alignItems: "flex-end" },
  balance: { fontSize: 15, fontFamily: "Poppins_700Bold" },
  fcfa: { fontSize: 11, fontFamily: "Poppins_600SemiBold" },
});

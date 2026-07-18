import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { TransactionType } from "@/context/TransactionContext";

const typeConfig = {
  depot: { bg: "#FFF8DC", text: "#7a5c00", label: "Dépôt" },
  retrait: { bg: "eef0ff", text: "#191970", label: "Retrait" },
  recharge: { bg: "#eef4ff", text: "#1d4ed8", label: "Recharge" },
  vente: { bg: "#fff4f0", text: "#9a3b00", label: "Vente" },
};

const statusConfig = {
  actif: { bg: "#eafaf0", text: "#1a7a4a", label: "Actif" },
  inactif: { bg: "#fdecea", text: "#b00000", label: "Inactif" },
};

interface BadgeProps {
  type?: TransactionType;
  status?: "actif" | "inactif";
  custom?: { bg: string; text: string; label: string };
}

export function Badge({ type, status, custom }: BadgeProps) {
  const cfg = custom ?? (type ? typeConfig[type] : status ? statusConfig[status] : null);
  if (!cfg) return null;
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.label, { color: cfg.text }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: "flex-start" },
  label: { fontSize: 12, fontFamily: "Poppins_600SemiBold" },
});

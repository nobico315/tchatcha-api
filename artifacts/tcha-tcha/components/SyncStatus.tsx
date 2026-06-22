import { CheckCircle, Clock, WifiOff } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SyncStatus as SyncStatusType } from "@/context/TransactionContext";

interface SyncStatusProps {
  status: SyncStatusType;
}

const config = {
  synced: { bg: "#eafaf0", text: "#1a7a4a", label: "Synchronisé", Icon: CheckCircle },
  pending: { bg: "#FFF8DC", text: "#7a5c00", label: "Sync en attente...", Icon: Clock },
  error: { bg: "#fdecea", text: "#b00000", label: "Hors ligne", Icon: WifiOff },
};

export function SyncStatus({ status }: SyncStatusProps) {
  const { bg, text, label, Icon } = config[status];
  return (
    <View style={[styles.bar, { backgroundColor: bg }]}>
      <Icon size={12} color={text} />
      <Text style={[styles.label, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  label: { fontSize: 11, fontFamily: "Poppins_600SemiBold" },
});

import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface QuickActionItemProps {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}

export function QuickActionItem({ label, icon, onPress }: QuickActionItemProps) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.iconWrap}>{icon}</View>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    minHeight: 90,
  },
  iconWrap: {},
  label: { fontSize: 13, fontFamily: "Poppins_600SemiBold", textAlign: "center" },
});

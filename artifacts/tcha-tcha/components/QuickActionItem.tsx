import React from "react";
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface QuickActionItemProps {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}

export function QuickActionItem({ label, icon, onPress }: QuickActionItemProps) {
  const colors = useColors();
  const { width } = useWindowDimensions();

  // Responsive: calculate card width based on screen
  // 2 columns, account for parent paddingHorizontal (20*2=40) and gap (10)
  const cardWidth = (width - 40 - 10) / 2;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          width: cardWidth,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.iconWrap}>{icon}</View>
      <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
    minHeight: 80,
  },
  iconWrap: {},
  label: { fontSize: 12, fontFamily: "Poppins_600SemiBold", textAlign: "center" },
});

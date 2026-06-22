import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface BarData {
  label: string;
  value: number;
}

interface CustomBarChartProps {
  data: BarData[];
  height?: number;
}

export function CustomBarChart({ data, height = 160 }: CustomBarChartProps) {
  const colors = useColors();
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <View style={[styles.container, { height }]}>
      <View style={styles.chart}>
        {data.map((item, i) => {
          const barH = Math.max((item.value / maxValue) * (height - 36), 4);
          return (
            <View key={i} style={styles.barWrapper}>
              <View style={[styles.bar, { height: barH, backgroundColor: colors.primary }]} />
              <Text style={[styles.label, { color: colors.muted }]}>{item.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%" },
  chart: { flex: 1, flexDirection: "row", alignItems: "flex-end", gap: 4, paddingBottom: 24 },
  barWrapper: { flex: 1, alignItems: "center", gap: 6 },
  bar: { width: "80%", borderRadius: 4 },
  label: { fontSize: 9, fontFamily: "Poppins_400Regular", textAlign: "center" },
});

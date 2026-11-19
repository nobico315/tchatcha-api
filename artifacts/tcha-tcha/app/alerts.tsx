import { AlertTriangle, CheckCircle, Clock, Bell } from "lucide-react-native";
import { router } from "expo-router";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppAlert, useAlerts } from "@/context/AlertContext";
import { useColors } from "@/hooks/useColors";
import { formatTime } from "@/utils/format";

const alertConfig = {
  balance: { Icon: AlertTriangle, color: "#D97706", bg: "#FEF3C7" },
  subscription: { Icon: Clock, color: "#EF4444", bg: "#FEE2E2" },
  sync: { Icon: CheckCircle, color: "#10B981", bg: "#D1FAE5" },
  reminder: { Icon: Bell, color: "#191970", bg: "#ECE8FF" },
};

export default function Alerts() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { alerts, markAsRead, markAllRead } = useAlerts();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: "#FFFFFF" }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.back, { color: "#8E9AB4" }]}>← Retour</Text>
        </TouchableOpacity>
        <Text style={[styles.heading, { color: "#000000" }]}>Alertes</Text>
        <TouchableOpacity onPress={markAllRead}>
          <Text style={[styles.markAll, { color: "#191970" }]}>Tout lire</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {alerts.map((alert) => {
          const { Icon, color, bg } = alertConfig[alert.type];
          return (
            <TouchableOpacity
              key={alert.id}
              style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: alert.read ? 0.5 : 1 }]}
              onPress={() => markAsRead(alert.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconWrap, { backgroundColor: bg }]}>
                <Icon size={20} color={color} />
              </View>
              <View style={styles.content}>
                <Text style={[styles.title, { color: colors.text }]}>{alert.title}</Text>
                <Text style={[styles.desc, { color: colors.muted }]} numberOfLines={2}>{alert.description}</Text>
                <Text style={[styles.time, { color: colors.muted }]}>{formatTime(alert.createdAt)}</Text>
              </View>
              {!alert.read && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#E8E8F5" },
  back: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  heading: { fontSize: 20, fontFamily: "Poppins_700Bold" },
  markAll: { fontSize: 13, fontFamily: "Poppins_600SemiBold" },
  list: { padding: 20, gap: 12, paddingBottom: 40 },
  card: { flexDirection: "row", borderRadius: 16, borderWidth: 1, borderColor: "#E8E8F5", padding: 14, gap: 12, alignItems: "flex-start", backgroundColor: "#FFFFFF" },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  content: { flex: 1, gap: 3 },
  title: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#000000" },
  desc: { fontSize: 12, fontFamily: "Poppins_400Regular", lineHeight: 18, color: "#8E9AB4" },
  time: { fontSize: 11, fontFamily: "Poppins_400Regular", color: "#8E9AB4" },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginTop: 4, backgroundColor: "#191970" },
});

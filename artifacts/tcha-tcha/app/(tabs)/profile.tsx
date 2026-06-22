import { Bell, ChevronRight, Info, LogOut, Pencil, Shield } from "lucide-react-native";
import { router } from "expo-router";
import React from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { formatDate } from "@/utils/format";

export default function Profile() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  if (!user) return null;

  const initials = `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  const subExpiry = new Date(user.subscriptionExpiry);
  const isSubActive = subExpiry > new Date();
  const daysLeft = Math.ceil((subExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const sections = [
    { icon: Pencil, label: "Modifier le profil", onPress: () => Alert.alert("Info", "Fonctionnalité à venir.") },
    { icon: Shield, label: "Changer le code PIN", onPress: () => router.push("/(auth)/forgot-pin") },
    { icon: Bell, label: "Notifications", onPress: () => Alert.alert("Info", "Fonctionnalité à venir.") },
    { icon: Info, label: "À propos de Tcha-Tcha", onPress: () => Alert.alert("Tcha-Tcha v1.0", "Une solution MIDEESSI pour les agents Mobile Money.") },
  ];

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}>
        <Text style={[styles.heading, { color: colors.primary }]}>Profil</Text>
      </View>

      <View style={styles.body}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.initials}>{initials}</Text>
          </View>
          <Text style={[styles.name, { color: colors.text }]}>{user.firstName} {user.lastName}</Text>
          <Text style={[styles.phone, { color: colors.muted }]}>{user.phone}</Text>
          <View style={[styles.roleBadge, { backgroundColor: "#eef0ff" }]}>
            <Text style={[styles.roleText, { color: colors.primary }]}>
              {user.role === "gerant" ? "Gérant" : "Agent"}
            </Text>
          </View>
        </View>

        {/* Subscription */}
        <View style={[styles.subCard, { backgroundColor: isSubActive ? colors.successBg : colors.dangerBg, borderColor: isSubActive ? colors.successText : colors.dangerText }]}>
          <View>
            <Text style={[styles.subTitle, { color: isSubActive ? colors.successText : colors.dangerText }]}>
              Abonnement {isSubActive ? "actif" : "expiré"}
            </Text>
            <Text style={[styles.subDate, { color: isSubActive ? colors.successText : colors.dangerText }]}>
              {isSubActive ? `Expire dans ${daysLeft} jours` : `Expiré le ${formatDate(user.subscriptionExpiry)}`}
            </Text>
          </View>
          <TouchableOpacity style={[styles.renewBtn, { backgroundColor: colors.primary }]} onPress={() => router.push("/abonnement")}>
            <Text style={[styles.renewText, { color: colors.accent }]}>Renouveler</Text>
          </TouchableOpacity>
        </View>

        {/* Sections */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {sections.map((s, i) => (
            <TouchableOpacity
              key={s.label}
              style={[styles.row, i < sections.length - 1 && { borderBottomWidth: 1, borderColor: colors.border }]}
              onPress={s.onPress}
              activeOpacity={0.7}
            >
              <s.icon size={20} color={colors.primary} />
              <Text style={[styles.rowLabel, { color: colors.text }]}>{s.label}</Text>
              <ChevronRight size={16} color={colors.muted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={[styles.logoutBtn, { borderColor: colors.dangerText }]}
          onPress={() => Alert.alert("Déconnexion", "Voulez-vous vous déconnecter ?", [
            { text: "Annuler", style: "cancel" },
            { text: "Déconnexion", style: "destructive", onPress: async () => { await logout(); router.replace("/(auth)/login"); } },
          ])}
        >
          <LogOut size={18} color={colors.dangerText} />
          <Text style={[styles.logoutText, { color: colors.dangerText }]}>Se déconnecter</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  heading: { fontSize: 22, fontFamily: "Poppins_700Bold" },
  body: { padding: 20, gap: 20 },
  avatarSection: { alignItems: "center", gap: 8 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#191970", alignItems: "center", justifyContent: "center" },
  initials: { color: "#FFD700", fontSize: 26, fontFamily: "Poppins_700Bold" },
  name: { fontSize: 18, fontFamily: "Poppins_700Bold" },
  phone: { fontSize: 13, fontFamily: "Poppins_400Regular" },
  roleBadge: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 10 },
  roleText: { fontSize: 12, fontFamily: "Poppins_600SemiBold" },
  subCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderRadius: 14, padding: 16 },
  subTitle: { fontSize: 14, fontFamily: "Poppins_700Bold" },
  subDate: { fontSize: 12, fontFamily: "Poppins_400Regular", marginTop: 2 },
  renewBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  renewText: { fontSize: 13, fontFamily: "Poppins_700Bold" },
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
  rowLabel: { flex: 1, fontSize: 14, fontFamily: "Poppins_400Regular" },
  logoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, borderWidth: 1.5, borderRadius: 12, height: 52 },
  logoutText: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
});

import { BookOpen, X } from "lucide-react-native";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useTransactions } from "@/context/TransactionContext";
import { useColors } from "@/hooks/useColors";
import { formatAmount } from "@/utils/format";
import * as Haptics from "expo-haptics";

export default function OuvrirJournee() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { openDay } = useTransactions();

  const [fondCaisse, setFondCaisse] = useState("");
  const [loading, setLoading] = useState(false);

  const numeric = parseInt(fondCaisse.replace(/\s/g, ""), 10) || 0;

  const handleOpen = async () => {
    if (numeric < 0) {
      Alert.alert("Erreur", "Le fond de caisse ne peut pas être négatif.");
      return;
    }
    if (!user) return;

    setLoading(true);
    await openDay(user.id, numeric);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLoading(false);
    router.back();
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={[{ flex: 1, backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: topPad + 16 }]}>
          <BookOpen size={26} color={colors.primary} />
          <Text style={[styles.heading, { color: colors.primary }]}>Ouverture de journée</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <X size={24} color={colors.muted} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {/* Date */}
          <View style={[styles.dateCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.dateLabel, { color: colors.muted }]}>Date</Text>
            <Text style={[styles.dateValue, { color: colors.text }]}>{today}</Text>
          </View>

          {/* Explanation */}
          <View style={[styles.infoBox, { backgroundColor: "#eef0ff", borderColor: colors.primary + "33" }]}>
            <Text style={[styles.infoText, { color: colors.primary }]}>
              Le <Text style={{ fontFamily: "Poppins_700Bold" }}>fond de caisse</Text> est le montant d'espèces disponible dans votre tiroir au début de la journée. Il sert de base pour calculer votre solde en temps réel.
            </Text>
          </View>

          {/* Amount input */}
          <View>
            <Text style={[styles.label, { color: colors.muted }]}>FOND DE CAISSE (FCFA)</Text>
            <TextInput
              style={[styles.amountInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.primary }]}
              value={fondCaisse}
              onChangeText={(t) => {
                const raw = t.replace(/[^0-9]/g, "");
                const num = parseInt(raw, 10);
                setFondCaisse(isNaN(num) ? "" : num.toLocaleString("fr-FR").replace(/,/g, " "));
              }}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.muted}
            />
            {numeric > 0 && (
              <Text style={[styles.amountPreview, { color: colors.muted }]}>
                {formatAmount(numeric)} FCFA
              </Text>
            )}
          </View>

          {/* Summary row */}
          <View style={[styles.summaryCard, { backgroundColor: colors.primary }]}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Agent</Text>
              <Text style={styles.summaryValue}>{user?.firstName} {user?.lastName}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: "rgba(255,255,255,0.15)" }]} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Fond de caisse</Text>
              <Text style={[styles.summaryValue, { color: "#FFD700" }]}>
                {numeric > 0 ? `${formatAmount(numeric)} FCFA` : "—"}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
            onPress={handleOpen}
            disabled={loading}
          >
            <BookOpen size={20} color="#FFD700" />
            <Text style={[styles.btnText, { color: "#FFD700" }]}>
              {loading ? "Ouverture en cours..." : "Ouvrir la journée"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn}>
            <Text style={[styles.cancelText, { color: colors.muted }]}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingBottom: 16,
  },
  heading: { flex: 1, fontSize: 18, fontFamily: "Poppins_700Bold" },
  body: { paddingHorizontal: 20, gap: 20 },
  dateCard: { borderRadius: 12, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dateLabel: { fontSize: 12, fontFamily: "Poppins_400Regular" },
  dateValue: { fontSize: 14, fontFamily: "Poppins_600SemiBold", textTransform: "capitalize" },
  infoBox: { borderRadius: 12, borderWidth: 1, padding: 14 },
  infoText: { fontSize: 13, fontFamily: "Poppins_400Regular", lineHeight: 20 },
  label: { fontSize: 12, fontFamily: "Poppins_600SemiBold", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10 },
  amountInput: {
    height: 64, borderRadius: 14, borderWidth: 1.5,
    paddingHorizontal: 20, fontSize: 28, fontFamily: "Poppins_700Bold",
    textAlign: "center",
  },
  amountPreview: { fontSize: 13, fontFamily: "Poppins_400Regular", textAlign: "center", marginTop: 8 },
  summaryCard: { borderRadius: 16, padding: 20, gap: 14 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryLabel: { color: "rgba(255,255,255,0.65)", fontSize: 13, fontFamily: "Poppins_400Regular" },
  summaryValue: { color: "#fff", fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  divider: { height: 1 },
  btn: {
    height: 56, borderRadius: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
  },
  btnText: { fontSize: 16, fontFamily: "Poppins_700Bold" },
  cancelBtn: { alignItems: "center", paddingVertical: 8 },
  cancelText: { fontSize: 14, fontFamily: "Poppins_400Regular" },
});

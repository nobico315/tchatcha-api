import { CheckCircle, Lock, X } from "lucide-react-native";
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

export default function FermerJournee() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { closeDay, getTodaySession, getTodayStats, getBalance } = useTransactions();

  const [soldePhysique, setSoldePhysique] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const todaySession = user ? getTodaySession(user.id) : null;
  const stats = getTodayStats(user?.id);
  const balanceCalcule = user ? getBalance(user.id) : 0;
  const numeric = parseInt(soldePhysique.replace(/\s/g, ""), 10) || 0;
  const ecart = numeric - balanceCalcule;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const handleClose = async () => {
    if (!user || !todaySession) return;
    if (numeric < 0) {
      Alert.alert("Erreur", "Le solde physique ne peut pas être négatif.");
      return;
    }

    Alert.alert(
      "Confirmer la clôture",
      `Vous allez clôturer la journée du ${new Date().toLocaleDateString("fr-FR")}. Cette action est définitive.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Clôturer",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            await closeDay(user.id, numeric);
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setLoading(false);
            setDone(true);
          },
        },
      ]
    );
  };

  if (done) {
    return (
      <View style={[styles.success, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20, paddingTop: topPad + 40 }]}>
        <CheckCircle size={72} color={colors.successText} />
        <Text style={[styles.successTitle, { color: colors.successText }]}>Journée clôturée !</Text>
        <Text style={[styles.successSub, { color: colors.muted }]}>
          Le rapport est disponible dans l'onglet Rapport.
        </Text>

        <View style={[styles.summaryCard, { backgroundColor: colors.primary, width: "100%" }]}>
          {[
            ["Dépôts encaissés", `${formatAmount(stats.depots)} FCFA`],
            ["Retraits décaissés", `${formatAmount(stats.retraits)} FCFA`],
            ["Solde net journée", `${formatAmount(stats.soldeNet)} FCFA`],
            ["Transactions", `${stats.count}`],
          ].map(([k, v]) => (
            <View key={k} style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{k}</Text>
              <Text style={[styles.summaryValue, { color: "#FFD700" }]}>{v}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={() => { router.replace("/rapport"); }}
        >
          <Text style={[styles.btnText, { color: "#FFD700" }]}>Voir le rapport</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn}>
          <Text style={[styles.cancelText, { color: colors.muted }]}>Retour à l'accueil</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={[{ flex: 1, backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: topPad + 16 }]}>
          <Lock size={26} color={colors.primary} />
          <Text style={[styles.heading, { color: colors.primary }]}>Clôture de journée</Text>
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

          {/* Compte-fait */}
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Bilan de la journée</Text>

          <View style={[styles.bilanCard, { backgroundColor: colors.primary }]}>
            <View style={styles.bilanRow}>
              <Text style={styles.bilanLabel}>Montant de démarrage</Text>
              <Text style={styles.bilanValue}>{formatAmount(todaySession?.openingTotal ?? 0)} FCFA</Text>
            </View>
            <View style={[styles.sep, { backgroundColor: "rgba(255,255,255,0.15)" }]} />
            <View style={styles.bilanRow}>
              <Text style={styles.bilanLabel}>Total dépôts reçus</Text>
              <Text style={[styles.bilanValue, { color: "#4ade80" }]}>+ {formatAmount(stats.depots)} FCFA</Text>
            </View>
            <View style={styles.bilanRow}>
              <Text style={styles.bilanLabel}>Total retraits remis</Text>
              <Text style={[styles.bilanValue, { color: "#f87171" }]}>− {formatAmount(stats.retraits)} FCFA</Text>
            </View>
            <View style={[styles.sep, { backgroundColor: "rgba(255,255,255,0.15)" }]} />
            <View style={styles.bilanRow}>
              <Text style={[styles.bilanLabel, { fontFamily: "Poppins_700Bold", color: "#FFD700" }]}>Solde théorique caisse</Text>
              <Text style={[styles.bilanValue, { color: "#FFD700", fontFamily: "Poppins_700Bold" }]}>{formatAmount(balanceCalcule)} FCFA</Text>
            </View>
            <View style={styles.bilanRow}>
              <Text style={styles.bilanLabel}>Nombre de transactions</Text>
              <Text style={styles.bilanValue}>{stats.count}</Text>
            </View>
          </View>

          {/* Physical balance input */}
          <View>
            <Text style={[styles.label, { color: colors.muted }]}>SOLDE PHYSIQUE RÉEL (FCFA)</Text>
            <TextInput
              style={[styles.amountInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.primary }]}
              value={soldePhysique}
              onChangeText={(t) => {
                const raw = t.replace(/[^0-9]/g, "");
                const num = parseInt(raw, 10);
                setSoldePhysique(isNaN(num) ? "" : num.toLocaleString("fr-FR").replace(/,/g, " "));
              }}
              keyboardType="number-pad"
              placeholder="Comptez votre caisse..."
              placeholderTextColor={colors.muted}
            />
          </View>

          {/* Écart */}
          {numeric > 0 && (
            <View style={[
              styles.ecartCard,
              { backgroundColor: ecart === 0 ? colors.successBg : ecart > 0 ? "#FFF7E6" : colors.dangerBg,
                borderColor: ecart === 0 ? colors.successText : ecart > 0 ? "#F59E0B" : colors.dangerText }
            ]}>
              <Text style={[styles.ecartTitle, { color: ecart === 0 ? colors.successText : ecart > 0 ? "#92400E" : colors.dangerText }]}>
                {ecart === 0 ? "✓ Caisse équilibrée" : ecart > 0 ? "Surplus de caisse" : "Déficit de caisse"}
              </Text>
              <Text style={[styles.ecartValue, { color: ecart === 0 ? colors.successText : ecart > 0 ? "#92400E" : colors.dangerText }]}>
                {ecart > 0 ? "+" : ""}{formatAmount(Math.abs(ecart))} FCFA
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.dangerText, opacity: loading ? 0.7 : 1 }]}
            onPress={handleClose}
            disabled={loading}
          >
            <Lock size={20} color="#fff" />
            <Text style={[styles.btnText, { color: "#fff" }]}>
              {loading ? "Clôture en cours..." : "Clôturer la journée"}
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
  sectionTitle: { fontSize: 16, fontFamily: "Poppins_700Bold" },
  bilanCard: { borderRadius: 16, padding: 20, gap: 12 },
  bilanRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bilanLabel: { color: "rgba(255,255,255,0.65)", fontSize: 13, fontFamily: "Poppins_400Regular" },
  bilanValue: { color: "#fff", fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  sep: { height: 1 },
  label: { fontSize: 12, fontFamily: "Poppins_600SemiBold", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10 },
  amountInput: {
    height: 60, borderRadius: 14, borderWidth: 1.5,
    paddingHorizontal: 20, fontSize: 24, fontFamily: "Poppins_700Bold",
    textAlign: "center",
  },
  ecartCard: { borderRadius: 14, borderWidth: 1.5, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ecartTitle: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  ecartValue: { fontSize: 16, fontFamily: "Poppins_700Bold" },
  btn: {
    height: 56, borderRadius: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
  },
  btnText: { fontSize: 16, fontFamily: "Poppins_700Bold" },
  cancelBtn: { alignItems: "center", paddingVertical: 8 },
  cancelText: { fontSize: 14, fontFamily: "Poppins_400Regular" },
  success: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 24 },
  successTitle: { fontSize: 24, fontFamily: "Poppins_700Bold" },
  successSub: { fontSize: 14, fontFamily: "Poppins_400Regular", textAlign: "center" },
  summaryCard: { borderRadius: 16, padding: 20, gap: 12 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryLabel: { color: "rgba(255,255,255,0.65)", fontSize: 13, fontFamily: "Poppins_400Regular" },
  summaryValue: { color: "#fff", fontSize: 14, fontFamily: "Poppins_600SemiBold" },
});

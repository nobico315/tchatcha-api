import { CheckCircle, Lock, X } from "lucide-react-native";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/context/AuthContext";
import { useTransactions } from "@/context/TransactionContext";
import { useColors } from "@/hooks/useColors";
import { formatAmount } from "@/utils/format";
import { emitAppEvent } from "@/utils/appEvents";
import * as Haptics from "expo-haptics";

export default function FermerJournee() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { closeDay, getTodaySession, getTodayStats, getSessionBalances } = useTransactions();

  const [soldePhysique, setSoldePhysique] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const todaySession = user ? getTodaySession(user.id) : null;
  const stats = getTodayStats(user?.id);
  const balanceCalcule = user ? getSessionBalances(user.id).cash : 0;
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
            emitAppEvent("day:closed", { agentId: user.id }, "success");
            setLoading(false);
            setDone(true);
          },
        },
      ]
    );
  };

  if (done) {
    return (
      <View style={[styles.success, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 20, paddingTop: topPad + 40 }]}>
        <CheckCircle size={72} color="#16a34a" />
        <Text style={[styles.successTitle, { color: colors.text }]}>Journée clôturée !</Text>
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
              <Text style={[styles.summaryValue, { color: "#FFFFFF" }]}>{v}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary }]}
          onPress={() => { router.replace("/rapport"); }}
          activeOpacity={0.85}
        >
          <Text style={[styles.btnText, { color: "#FFFFFF" }]}>Voir le rapport</Text>
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
        style={{ flex: 1, backgroundColor: colors.surface }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header White */}
        <View style={[styles.whiteHeader, { paddingTop: topPad + 12 }]}>
          <View style={styles.headerRow}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconCircle}>
                <Lock size={20} color="#191970" />
              </View>
              <View>
                <Text style={styles.headingTitle}>Clôture de journée</Text>
                <Text style={styles.headingSub}>Vérification & bilan de caisse</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => router.back()} style={styles.closeBtnHeader} activeOpacity={0.7}>
              <X size={20} color="#000000" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.body}>
          {/* Date */}
          <View style={[styles.dateCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.dateLabel, { color: colors.muted }]}>Date</Text>
            <Text style={[styles.dateValue, { color: colors.text }]}>{today}</Text>
          </View>

          {/* Compte-fait */}
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Bilan de la journée</Text>

          <LinearGradient colors={["#191970", "#0d0d5c"]} style={styles.bilanCard}>
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
              <Text style={[styles.bilanLabel, { fontFamily: "Poppins_700Bold", color: "#FFFFFF" }]}>Solde théorique caisse</Text>
              <Text style={[styles.bilanValue, { color: "#FFFFFF", fontFamily: "Poppins_700Bold", fontSize: 16 }]}>{formatAmount(balanceCalcule)} FCFA</Text>
            </View>
            <View style={styles.bilanRow}>
              <Text style={styles.bilanLabel}>Nombre de transactions</Text>
              <Text style={styles.bilanValue}>{stats.count}</Text>
            </View>
          </LinearGradient>

          {/* Physical balance input */}
          <View>
            <Text style={[styles.label, { color: colors.muted }]}>SOLDE PHYSIQUE RÉEL (FCFA)</Text>
            <TextInput
              style={[styles.amountInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.primary }]}
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
              { backgroundColor: ecart === 0 ? "rgba(22,163,74,0.06)" : ecart > 0 ? "#FFF7E6" : "rgba(220,38,38,0.06)",
                borderColor: ecart === 0 ? "#16a34a" : ecart > 0 ? "#F59E0B" : "#dc2626" }
            ]}>
              <Text style={[styles.ecartTitle, { color: ecart === 0 ? "#16a34a" : ecart > 0 ? "#92400E" : "#dc2626" }]}>
                {ecart === 0 ? "✓ Caisse équilibrée" : ecart > 0 ? "Surplus de caisse" : "Déficit de caisse"}
              </Text>
              <Text style={[styles.ecartValue, { color: ecart === 0 ? "#16a34a" : ecart > 0 ? "#92400E" : "#dc2626" }]}>
                {ecart > 0 ? "+" : ""}{formatAmount(Math.abs(ecart))} FCFA
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: "#dc2626", opacity: loading ? 0.7 : 1 }]}
            onPress={handleClose}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? <ActivityIndicator size="small" color="#fff" /> : <Lock size={20} color="#fff" />}
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
  whiteHeader: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E8E8F5",
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconCircle: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#ECE8FF", alignItems: "center", justifyContent: "center" },
  headingTitle: { fontSize: 20, fontFamily: "Poppins_700Bold", color: "#000000", letterSpacing: -0.3 },
  headingSub: { fontSize: 12, fontFamily: "Poppins_400Regular", color: "#8E9AB4", marginTop: 1 },
  closeBtnHeader: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E8E8F5", alignItems: "center", justifyContent: "center" },

  body: { padding: 20, gap: 16 },
  dateCard: { borderRadius: 16, borderWidth: 1, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  dateLabel: { fontSize: 12, fontFamily: "Poppins_400Regular" },
  dateValue: { fontSize: 14, fontFamily: "Poppins_600SemiBold", textTransform: "capitalize" },
  sectionTitle: { fontSize: 17, fontFamily: "Poppins_700Bold" },
  bilanCard: { borderRadius: 18, padding: 20, gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 4 },
  bilanRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bilanLabel: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Poppins_400Regular" },
  bilanValue: { color: "#fff", fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  sep: { height: 1 },
  label: { fontSize: 11, fontFamily: "Poppins_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6, opacity: 0.6 },
  amountInput: {
    height: 60, borderRadius: 16, borderWidth: 1.5,
    paddingHorizontal: 20, fontSize: 24, fontFamily: "Poppins_700Bold",
    textAlign: "center",
  },
  ecartCard: { borderRadius: 16, borderWidth: 1.5, padding: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ecartTitle: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  ecartValue: { fontSize: 16, fontFamily: "Poppins_700Bold" },
  btn: {
    height: 58, borderRadius: 18,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    marginTop: 6,
  },
  btnText: { fontSize: 16, fontFamily: "Poppins_700Bold" },
  cancelBtn: { alignItems: "center", paddingVertical: 10 },
  cancelText: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  success: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 24 },
  successTitle: { fontSize: 24, fontFamily: "Poppins_700Bold" },
  successSub: { fontSize: 14, fontFamily: "Poppins_400Regular", textAlign: "center" },
  summaryCard: { borderRadius: 18, padding: 20, gap: 12 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryLabel: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Poppins_400Regular" },
  summaryValue: { color: "#fff", fontSize: 14, fontFamily: "Poppins_600SemiBold" },
});

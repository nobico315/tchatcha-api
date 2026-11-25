import { ArrowRight, CheckCircle2, Lock, X } from "lucide-react-native";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/context/AuthContext";
import { useTransactions } from "@/context/TransactionContext";
import { useColors } from "@/hooks/useColors";
import { formatAmount } from "@/utils/format";
import { emitAppEvent } from "@/utils/appEvents";

export default function FermerJournee() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { closeDay, getTodaySession, getTodayStats, getSessionBalances } = useTransactions();

  const [soldePhysique, setSoldePhysique] = useState("");
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const todaySession = user ? getTodaySession(user.id) : null;
  const stats = getTodayStats(user?.id);
  const sessionBalances = user
    ? getSessionBalances(user.id)
    : { cash: 0, MTN: 0, Moov: 0, Celtis: 0, total: 0 };

  const expectedCash = sessionBalances.cash;
  const hasInput = soldePhysique.trim().length > 0;
  const numeric = parseInt(soldePhysique.replace(/\s/g, ""), 10) || 0;
  const ecart = numeric - expectedCash;

  const topPad = Platform.OS === "web" ? 24 : insets.top;
  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const handleAmountChange = (t: string) => {
    const raw = t.replace(/[^0-9]/g, "");
    const num = parseInt(raw, 10);
    setSoldePhysique(isNaN(num) ? "" : num.toLocaleString("fr-FR").replace(/,/g, " "));
  };

  const handleUseExpected = () => {
    if (expectedCash < 0) return;
    setSoldePhysique(expectedCash.toLocaleString("fr-FR").replace(/,/g, " "));
  };

  const handleClose = async () => {
    if (!user || !todaySession) return;
    if (!hasInput) {
      Alert.alert("Montant requis", "Saisissez le montant des espèces comptées en caisse.");
      return;
    }
    if (numeric < 0) {
      Alert.alert("Erreur", "Le solde physique ne peut pas être négatif.");
      return;
    }

    Alert.alert(
      "Confirmer la clôture",
      `Clôturer la journée avec ${formatAmount(numeric)} FCFA en espèces ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Clôturer",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              await closeDay(user.id, numeric);
              emitAppEvent("day:closed", { agentId: user.id }, "success");
              setDone(true);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  if (done) {
    return (
      <View
        style={[
          styles.success,
          { paddingBottom: insets.bottom + 24, paddingTop: topPad + 40 },
        ]}
      >
        <View style={styles.successIconWrap}>
          <CheckCircle2 size={44} color="#15803D" />
        </View>
        <Text style={[styles.successTitle, { color: colors.text }]}>Journée clôturée</Text>
        <Text style={styles.successSub}>Le bilan a été enregistré et synchronisé.</Text>

        <View style={styles.summaryCard}>
          {[
            ["Espèces comptées", `${formatAmount(numeric)} FCFA`],
            ["Dépôts encaissés", `${formatAmount(stats.depots)} FCFA`],
            ["Retraits décaissés", `${formatAmount(stats.retraits)} FCFA`],
            ["Opérations", `${stats.count}`],
          ].map(([k, v], i, arr) => (
            <View
              key={k}
              style={[styles.summaryRow, i < arr.length - 1 && styles.summaryRowDivider]}
            >
              <Text style={styles.summaryLabel}>{k}</Text>
              <Text style={styles.summaryValue}>{v}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary, width: "100%" }]}
          onPress={() => router.replace("/(tabs)/rapport")}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>Voir le rapport</Text>
          <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.4} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Retour à l'accueil</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14 }]}>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.title, { color: colors.text }]}>Clôturer la journée</Text>
          <Text style={styles.dateText}>{today}</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeBtn}
          activeOpacity={0.75}
          accessibilityLabel="Fermer"
        >
          <X size={20} color="#475569" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 28 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Bilan attendu */}
        <LinearGradient colors={["#191970", "#0F172A"]} style={styles.bilanCard}>
          <View style={styles.bilanTop}>
            <View>
              <Text style={styles.bilanTopLabel}>Espèces attendues en caisse</Text>
              <Text style={styles.bilanTopAmount}>{formatAmount(expectedCash)} FCFA</Text>
            </View>
            <Text style={styles.bilanTxCount}>{stats.count} tx</Text>
          </View>

          <View style={styles.bilanStatsRow}>
            <View style={styles.bilanStatCol}>
              <Text style={styles.bilanStatLabel}>Dépôts</Text>
              <Text style={[styles.bilanStatVal, { color: "#4ADE80" }]}>
                +{formatAmount(stats.depots)}
              </Text>
            </View>
            <View style={styles.bilanStatCol}>
              <Text style={styles.bilanStatLabel}>Retraits</Text>
              <Text style={[styles.bilanStatVal, { color: "#FCA5A5" }]}>
                -{formatAmount(stats.retraits)}
              </Text>
            </View>
            <View style={styles.bilanStatCol}>
              <Text style={styles.bilanStatLabel}>Ouverture</Text>
              <Text style={styles.bilanStatVal}>
                {formatAmount(todaySession?.openingBalances?.cash ?? 0)}
              </Text>
            </View>
          </View>

          <View style={styles.simRow}>
            <Text style={styles.simItem}>MTN {formatAmount(sessionBalances.MTN)}</Text>
            <Text style={styles.simItem}>Moov {formatAmount(sessionBalances.Moov)}</Text>
            <Text style={styles.simItem}>Celtis {formatAmount(sessionBalances.Celtis)}</Text>
          </View>
        </LinearGradient>

        {/* Saisie espèces physiques */}
        <View style={styles.inputSection}>
          <View style={styles.inputHeaderRow}>
            <Text style={styles.inputSectionLabel}>ESPÈCES COMPTÉES EN CAISSE</Text>
            {expectedCash >= 0 && (
              <TouchableOpacity onPress={handleUseExpected} activeOpacity={0.7}>
                <Text style={[styles.prefillText, { color: colors.primary }]}>
                  Montant attendu
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View
            style={[
              styles.amountCard,
              focused && { borderColor: colors.primary, backgroundColor: "#F8FAFF" },
            ]}
          >
            <View style={styles.amountLeft}>
              <View style={styles.dotGreen} />
              <Text style={[styles.amountLabel, { color: colors.text }]}>Espèces</Text>
            </View>
            <View style={styles.amountRight}>
              <TextInput
                style={[styles.amountInput, { color: colors.primary }]}
                value={soldePhysique}
                onChangeText={handleAmountChange}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor="#CBD5E1"
              />
              <Text style={styles.currencySuffix}>FCFA</Text>
            </View>
          </View>
        </View>

        {/* Écart */}
        {hasInput && (
          <View
            style={[
              styles.ecartCard,
              {
                backgroundColor:
                  ecart === 0 ? "#F0FDF4" : ecart > 0 ? "#FFFBEB" : "#FEF2F2",
                borderColor:
                  ecart === 0 ? "#BBF7D0" : ecart > 0 ? "#FDE68A" : "#FECACA",
              },
            ]}
          >
            <Text
              style={[
                styles.ecartTitle,
                {
                  color:
                    ecart === 0 ? "#15803D" : ecart > 0 ? "#B45309" : "#DC2626",
                },
              ]}
            >
              {ecart === 0
                ? "Caisse équilibrée"
                : ecart > 0
                  ? "Surplus de caisse"
                  : "Déficit de caisse"}
            </Text>
            <Text
              style={[
                styles.ecartValue,
                {
                  color:
                    ecart === 0 ? "#15803D" : ecart > 0 ? "#B45309" : "#DC2626",
                },
              ]}
            >
              {ecart > 0 ? "+" : ecart < 0 ? "-" : ""}
              {formatAmount(Math.abs(ecart))} FCFA
            </Text>
          </View>
        )}

        {/* Action */}
        <TouchableOpacity
          style={[
            styles.closeActionBtn,
            { opacity: loading || !hasInput ? 0.65 : 1 },
          ]}
          onPress={handleClose}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Lock size={18} color="#FFFFFF" />
          )}
          <Text style={styles.primaryBtnText}>
            {loading ? "Clôture en cours..." : "Clôturer la journée"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  headerTextWrap: { gap: 2 },
  title: { fontSize: 20, fontFamily: "Poppins_700Bold", letterSpacing: -0.3 },
  dateText: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: "#64748B",
    textTransform: "capitalize",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  scroll: { flex: 1 },
  body: { padding: 20, gap: 16 },

  bilanCard: {
    borderRadius: 22,
    padding: 18,
    gap: 14,
    shadowColor: "#191970",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 6,
  },
  bilanTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  bilanTopLabel: {
    fontSize: 12,
    fontFamily: "Poppins_500Medium",
    color: "rgba(255,255,255,0.75)",
  },
  bilanTopAmount: {
    fontSize: 24,
    fontFamily: "Poppins_700Bold",
    color: "#FFFFFF",
    marginTop: 2,
  },
  bilanTxCount: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: "rgba(255,255,255,0.85)",
  },
  bilanStatsRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.14)",
    paddingTop: 12,
    gap: 8,
  },
  bilanStatCol: { flex: 1, gap: 2 },
  bilanStatLabel: {
    fontSize: 11,
    fontFamily: "Poppins_400Regular",
    color: "rgba(255,255,255,0.7)",
  },
  bilanStatVal: { fontSize: 13, fontFamily: "Poppins_700Bold", color: "#FFFFFF" },
  simRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
    paddingTop: 10,
  },
  simItem: {
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    color: "rgba(255,255,255,0.78)",
  },

  inputSection: { gap: 8 },
  inputHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 2,
  },
  inputSectionLabel: {
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    color: "#64748B",
    letterSpacing: 0.6,
  },
  prefillText: { fontSize: 12, fontFamily: "Poppins_600SemiBold" },
  amountCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    paddingHorizontal: 18,
    height: 68,
  },
  amountLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#16A34A" },
  amountLabel: { fontSize: 15, fontFamily: "Poppins_600SemiBold" },
  amountRight: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, justifyContent: "flex-end" },
  amountInput: {
    minWidth: 100,
    textAlign: "right",
    fontSize: 22,
    fontFamily: "Poppins_700Bold",
    paddingVertical: 6,
  },
  currencySuffix: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: "#94A3B8" },

  ecartCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ecartTitle: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  ecartValue: { fontSize: 16, fontFamily: "Poppins_700Bold" },

  closeActionBtn: {
    height: 56,
    borderRadius: 16,
    backgroundColor: "#DC2626",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  primaryBtn: {
    height: 54,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: { fontSize: 15, fontFamily: "Poppins_700Bold", color: "#FFFFFF" },

  success: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingHorizontal: 24,
  },
  successIconWrap: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#DCFCE7",
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: { fontSize: 22, fontFamily: "Poppins_700Bold" },
  successSub: { fontSize: 13, fontFamily: "Poppins_400Regular", color: "#64748B", textAlign: "center" },
  summaryCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    marginVertical: 6,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  summaryRowDivider: { borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  summaryLabel: { fontSize: 13, fontFamily: "Poppins_400Regular", color: "#64748B" },
  summaryValue: { fontSize: 14, fontFamily: "Poppins_700Bold", color: "#0F172A" },
  cancelBtn: { alignItems: "center", paddingVertical: 10 },
  cancelText: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#64748B" },
});

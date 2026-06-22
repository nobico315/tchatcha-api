import { CheckCircle, CreditCard } from "lucide-react-native";
import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { formatAmount } from "@/utils/format";

export default function Abonnement() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const [agents] = useState(1);
  const total = agents * 1000;
  const [paid, setPaid] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handlePay = () => {
    Alert.alert(
      "Paiement FedaPay",
      `Vous allez payer ${formatAmount(total)} FCFA via FedaPay. Continuer ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Payer",
          onPress: async () => {
            const newExpiry = new Date();
            newExpiry.setDate(newExpiry.getDate() + 30);
            await updateUser({ subscriptionExpiry: newExpiry.toISOString() });
            setPaid(true);
          },
        },
      ]
    );
  };

  if (paid) {
    return (
      <View style={[styles.success, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20, paddingTop: topPad + 40 }]}>
        <CheckCircle size={72} color={colors.successText} />
        <Text style={[styles.successTitle, { color: colors.successText }]}>Paiement réussi !</Text>
        <Text style={[styles.successDesc, { color: colors.muted }]}>Votre abonnement a été renouvelé pour 30 jours.</Text>
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary, width: "100%" }]} onPress={() => { router.back(); }}>
          <Text style={[styles.primaryBtnText, { color: colors.accent }]}>Retour au profil</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.back, { color: colors.primary }]}>← Retour</Text>
        </TouchableOpacity>
        <Text style={[styles.heading, { color: colors.primary }]}>Abonnement</Text>
      </View>

      <View style={styles.body}>
        {/* Plan card */}
        <View style={[styles.planCard, { backgroundColor: colors.primary }]}>
          <Text style={styles.planName}>Plan Agent Mobile Money</Text>
          <View style={styles.planPriceRow}>
            <Text style={styles.planPrice}>1 000</Text>
            <Text style={styles.planCurrency}> FCFA</Text>
          </View>
          <Text style={styles.planPer}>par agent / mois</Text>
          {["Transactions illimitées", "Synchronisation automatique", "Rapports journaliers", "Support prioritaire"].map((f) => (
            <View key={f} style={styles.featureRow}>
              <CheckCircle size={16} color="#FFD700" />
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.summaryTitle, { color: colors.primary }]}>Récapitulatif</Text>
          <View style={[styles.summaryRow, { borderColor: colors.border }]}>
            <Text style={[styles.summaryKey, { color: colors.muted }]}>Nb agents</Text>
            <Text style={[styles.summaryVal, { color: colors.text }]}>{agents}</Text>
          </View>
          <View style={[styles.summaryRow, { borderColor: colors.border }]}>
            <Text style={[styles.summaryKey, { color: colors.muted }]}>Prix unitaire</Text>
            <Text style={[styles.summaryVal, { color: colors.text }]}>1 000 FCFA</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={[styles.summaryKey, { color: colors.primary, fontFamily: "Poppins_700Bold" }]}>Total</Text>
            <View style={{ flexDirection: "row", alignItems: "baseline" }}>
              <Text style={[styles.totalVal, { color: colors.primary }]}>{formatAmount(total)}</Text>
              <Text style={[{ color: colors.accent, fontFamily: "Poppins_700Bold", fontSize: 14 }]}> FCFA</Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={[styles.payBtn, { backgroundColor: colors.primary }]} onPress={handlePay}>
          <CreditCard size={20} color={colors.accent} />
          <Text style={[styles.payBtnText, { color: colors.accent }]}>Payer maintenant via FedaPay</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, gap: 8 },
  back: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  heading: { fontSize: 22, fontFamily: "Poppins_700Bold" },
  body: { padding: 20, gap: 20 },
  planCard: { borderRadius: 20, padding: 24, gap: 10 },
  planName: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontFamily: "Poppins_600SemiBold" },
  planPriceRow: { flexDirection: "row", alignItems: "baseline" },
  planPrice: { color: "#FFD700", fontSize: 36, fontFamily: "Poppins_700Bold" },
  planCurrency: { color: "#FFD700", fontSize: 20, fontFamily: "Poppins_700Bold" },
  planPer: { color: "rgba(255,255,255,0.6)", fontSize: 12, fontFamily: "Poppins_400Regular", marginBottom: 8 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureText: { color: "#FFFFFF", fontSize: 13, fontFamily: "Poppins_400Regular" },
  summaryCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 4 },
  summaryTitle: { fontSize: 15, fontFamily: "Poppins_700Bold", marginBottom: 8 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1 },
  summaryKey: { fontSize: 13, fontFamily: "Poppins_400Regular" },
  summaryVal: { fontSize: 13, fontFamily: "Poppins_600SemiBold" },
  totalVal: { fontSize: 20, fontFamily: "Poppins_700Bold" },
  payBtn: { height: 56, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  payBtnText: { fontSize: 15, fontFamily: "Poppins_700Bold" },
  success: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 40 },
  successTitle: { fontSize: 24, fontFamily: "Poppins_700Bold" },
  successDesc: { fontSize: 14, fontFamily: "Poppins_400Regular", textAlign: "center" },
  primaryBtn: { height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { fontSize: 15, fontFamily: "Poppins_700Bold" },
});

import { CheckCircle, CreditCard } from "lucide-react-native";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { formatAmount } from "@/utils/format";
import { getApiBaseUrl } from "@/utils/apiConfig";

export default function Abonnement() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getMyAgents, confirmFeexPaySubscription } = useAuth();
  const [agentCount, setAgentCount] = useState(1);
  const total = agentCount * 1000;
  const [paid, setPaid] = useState(false);
  const [paying, setPaying] = useState(false);
  const [PaymentComponent, setPaymentComponent] = useState<React.ComponentType<any> | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const isWeb = Platform.OS === "web";

  const feexpayToken = process.env.EXPO_PUBLIC_FEEXPAY_TOKEN ?? "";
  const feexpayShopId = process.env.EXPO_PUBLIC_FEEXPAY_ID ?? "";
  const feexpayMode = (process.env.EXPO_PUBLIC_FEEXPAY_MODE === "LIVE" ? "LIVE" : "SANDBOX") as "LIVE" | "SANDBOX";
  const missingFeexpayConfig = !feexpayToken || !feexpayShopId;

  useEffect(() => {
    if (!isWeb || missingFeexpayConfig) return;

    import("react-sdk-feexpay")
      .then((module) => {
        const Component = module.FeexPayButton ?? module.default;
        if (!Component) {
          throw new Error("FeexPayButton introuvable dans le module FeexPay");
        }
        setPaymentComponent(() => Component as React.ComponentType<any>);
      })
      .catch((err) => {
        console.warn("FeexPay load error:", err);
        setPaymentError("Impossible de charger le bouton de paiement FeexPay.");
      });
  }, [missingFeexpayConfig]);

  const paymentReference = useMemo(
    () => `ABON-${user?.id ?? "unknown"}-${Date.now()}`,
    [user?.id]
  );

  const handlePaymentCallback = useCallback(
    async (result: any) => {
      console.log("FeexPay callback result", result);
      const status = result?.status;

      if (status === "SUCCESSFUL" || status === "SUCCESS") {
        const res = await confirmFeexPaySubscription(result?.reference || paymentReference);
        if (res.success) {
          setPaid(true);
        } else {
          Alert.alert("Vérification en attente", res.error || "Le paiement n'a pas encore pu être confirmé.");
        }
        return;
      }

      if (status) {
        Alert.alert("Paiement échoué", "Le paiement n'a pas été confirmé. Veuillez réessayer.");
      }
    },
    [confirmFeexPaySubscription, paymentReference]
  );

  useEffect(() => {
    if (user?.role === "gerant") {
      getMyAgents().then((agents) => setAgentCount(Math.max(1, agents.length)));
    }
  }, [user?.role]);

  const handlePay = async () => {
    if (missingFeexpayConfig) {
      Alert.alert(
        "Configuration manquante",
        "Veuillez définir EXPO_PUBLIC_FEEXPAY_TOKEN et EXPO_PUBLIC_FEEXPAY_ID dans votre environnement Expo."
      );
      return;
    }

    const apiBaseUrl = getApiBaseUrl();
    const appDeepLink = "tcha-tcha://feexpay-callback";
    const callbackUrl = isWeb
      ? `${apiBaseUrl}/api/feexpay/verify`
      : appDeepLink;
    const errorCallbackUrl = isWeb
      ? `${apiBaseUrl}/api/feexpay/verify?error=1`
      : appDeepLink;

    const checkoutUrl = `${apiBaseUrl}/api/feexpay/checkout?reference=${encodeURIComponent(
      paymentReference
    )}&amount=${total}&mode=${feexpayMode}&callback_url=${encodeURIComponent(callbackUrl)}&error_callback_url=${encodeURIComponent(errorCallbackUrl)}&callback_info=${encodeURIComponent(
      JSON.stringify({ userId: user?.id, email: user?.phone ?? "" })
    )}`;

    if (isWeb) {
      window.location.href = checkoutUrl;
      return;
    }

    setPaying(true);
    try {
      const result = await WebBrowser.openBrowserAsync(checkoutUrl);
      if (result.type !== "opened") {
        Alert.alert("Erreur de paiement", "Impossible d'ouvrir le flux de paiement FeexPay.");
      }
    } finally {
      setPaying(false);
    }
  };

  if (paid) {
    return (
      <View style={[styles.success, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20, paddingTop: topPad + 40 }]}>
        <CheckCircle size={72} color={colors.successText} />
        <Text style={[styles.successTitle, { color: colors.successText }]}>Paiement réussi !</Text>
        <Text style={[styles.successDesc, { color: colors.muted }]}>Votre abonnement a été renouvelé pour 30 jours.</Text>
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: "#191970", width: "100%" }]} onPress={() => { router.back(); }}>
          <Text style={[styles.primaryBtnText, { color: "#FFFFFF" }]}>Retour au profil</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#FFFFFF" }} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: "#FFFFFF" }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.back, { color: "#8E9AB4" }]}>← Retour</Text>
        </TouchableOpacity>
        <Text style={[styles.heading, { color: "#000000" }]}>Abonnement</Text>
      </View>

      <View style={styles.body}>
        {/* Plan card */}
        <View style={[styles.planCard, { backgroundColor: "#191970" }]}>
          <Text style={styles.planName}>Plan Agent Mobile Money</Text>
          <View style={styles.planPriceRow}>
            <Text style={styles.planPrice}>1 000</Text>
            <Text style={styles.planCurrency}> FCFA</Text>
          </View>
          <Text style={styles.planPer}>par agent / mois</Text>
          {["Synchronisation automatique en ligne", "Données synchronisées entre appareils", "Support prioritaire"].map((f) => (
            <View key={f} style={styles.featureRow}>
              <CheckCircle size={16} color="#4ade80" />
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        {/* Summary */}
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.summaryTitle, { color: colors.primary }]}>Récapitulatif</Text>
          <View style={[styles.summaryRow, { borderColor: colors.border }]}>
            <Text style={[styles.summaryKey, { color: colors.muted }]}>Nb agents</Text>
            <Text style={[styles.summaryVal, { color: colors.text }]}>{agentCount}</Text>
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

        {paymentError ? (
          <Text style={[styles.errorText, { color: "#DC2626" }]}>{paymentError}</Text>
        ) : null}

        <TouchableOpacity
          style={[styles.payBtn, { backgroundColor: "#191970", opacity: paying ? 0.7 : 1 }]}
          onPress={handlePay}
          disabled={paying}
        >
          {paying ? <ActivityIndicator size="small" color="#FFFFFF" /> : <CreditCard size={20} color="#FFFFFF" />}
          <Text style={[styles.payBtnText, { color: "#FFFFFF" }]}>
            {paying ? "Ouverture de FeexPay..." : "Payer maintenant via FeexPay"}
          </Text>
        </TouchableOpacity>

        {isWeb && missingFeexpayConfig ? (
          <View style={[styles.warningBox, { borderColor: colors.border, backgroundColor: colors.surface }]}> 
            <Text style={[styles.warningText, { color: colors.muted }]}>Veuillez configurer les variables Expo :</Text>
            <Text style={[styles.warningText, { color: colors.text }]}>EXPO_PUBLIC_FEEXPAY_TOKEN et EXPO_PUBLIC_FEEXPAY_ID</Text>
          </View>
        ) : null}
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
  planPrice: { color: "#FFFFFF", fontSize: 36, fontFamily: "Poppins_700Bold" },
  planCurrency: { color: "#FFFFFF", fontSize: 20, fontFamily: "Poppins_700Bold" },
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
  errorText: { fontSize: 14, fontFamily: "Poppins_600SemiBold", marginTop: 8, textAlign: "center" },
  warningBox: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 12 },
  warningText: { fontSize: 13, fontFamily: "Poppins_400Regular", lineHeight: 20 },
});

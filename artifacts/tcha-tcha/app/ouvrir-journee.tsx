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

  const [cash, setCash] = useState("");
  const [mtn, setMtn] = useState("");
  const [moov, setMoov] = useState("");
  const [celtis, setCeltis] = useState("");
  const [loading, setLoading] = useState(false);

  const parseAmount = (value: string) => parseInt(value.replace(/\s/g, ""), 10) || 0;
  const cashAmount = parseAmount(cash);
  const mtnAmount = parseAmount(mtn);
  const moovAmount = parseAmount(moov);
  const celtisAmount = parseAmount(celtis);
  const openingTotal = cashAmount + mtnAmount + moovAmount + celtisAmount;

  const handleOpen = async () => {
    if (cashAmount < 0 || mtnAmount < 0 || moovAmount < 0 || celtisAmount < 0) {
      Alert.alert("Erreur", "Les soldes ne peuvent pas être négatifs.");
      return;
    }
    if (!user) return;

    setLoading(true);
    await openDay(user.id, {
      cash: cashAmount,
      MTN: mtnAmount,
      Moov: moovAmount,
      Celtis: celtisAmount,
    });
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
        <View style={[styles.header, { paddingTop: topPad + 16 }]}> 
          <BookOpen size={26} color={colors.primary} />
          <Text style={[styles.heading, { color: colors.primary }]}>Ouverture de journée</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <X size={24} color={colors.muted} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          <View style={[styles.dateCard, { backgroundColor: colors.surface }]}> 
            <Text style={[styles.dateLabel, { color: colors.muted }]}>Date</Text>
            <Text style={[styles.dateValue, { color: colors.text }]}>{today}</Text>
          </View>

          <View style={[styles.infoBox, { backgroundColor: "#eef0ff", borderColor: colors.primary + "33" }]}> 
            <Text style={[styles.infoText, { color: colors.primary }]}> 
              Saisissez la trésorerie initiale : la caisse en espèces et le solde disponible sur chaque SIM. La somme totale représente le montant de démarrage de la journée.
            </Text>
          </View>

          <View>
            <Text style={[styles.label, { color: colors.muted }]}>CAISSE EN ESPÈCES (FCFA)</Text>
            <TextInput
              style={[styles.amountInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.primary }]}
              value={cash}
              onChangeText={(t) => {
                const raw = t.replace(/[^0-9]/g, "");
                const num = parseInt(raw, 10);
                setCash(isNaN(num) ? "" : num.toLocaleString("fr-FR").replace(/,/g, " "));
              }}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.muted}
            />
          </View>

          <View>
            <Text style={[styles.label, { color: colors.muted }]}>MTN SIM (FCFA)</Text>
            <TextInput
              style={[styles.amountInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.primary }]}
              value={mtn}
              onChangeText={(t) => {
                const raw = t.replace(/[^0-9]/g, "");
                const num = parseInt(raw, 10);
                setMtn(isNaN(num) ? "" : num.toLocaleString("fr-FR").replace(/,/g, " "));
              }}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.muted}
            />
          </View>

          <View>
            <Text style={[styles.label, { color: colors.muted }]}>MOOV SIM (FCFA)</Text>
            <TextInput
              style={[styles.amountInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.primary }]}
              value={moov}
              onChangeText={(t) => {
                const raw = t.replace(/[^0-9]/g, "");
                const num = parseInt(raw, 10);
                setMoov(isNaN(num) ? "" : num.toLocaleString("fr-FR").replace(/,/g, " "));
              }}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.muted}
            />
          </View>

          <View>
            <Text style={[styles.label, { color: colors.muted }]}>CELTIS SIM (FCFA)</Text>
            <TextInput
              style={[styles.amountInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.primary }]}
              value={celtis}
              onChangeText={(t) => {
                const raw = t.replace(/[^0-9]/g, "");
                const num = parseInt(raw, 10);
                setCeltis(isNaN(num) ? "" : num.toLocaleString("fr-FR").replace(/,/g, " "));
              }}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.muted}
            />
          </View>

          {openingTotal > 0 && (
            <Text style={[styles.amountPreview, { color: colors.muted }]}>Total de démarrage : {formatAmount(openingTotal)} FCFA</Text>
          )}

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
  btn: {
    height: 56, borderRadius: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
  },
  btnText: { fontSize: 16, fontFamily: "Poppins_700Bold" },
  cancelBtn: { alignItems: "center", paddingVertical: 8 },
  cancelText: { fontSize: 14, fontFamily: "Poppins_400Regular" },
});

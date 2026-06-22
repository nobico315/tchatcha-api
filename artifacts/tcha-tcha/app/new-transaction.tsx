import { CheckCircle, X } from "lucide-react-native";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Badge } from "@/components/Badge";
import { useAuth } from "@/context/AuthContext";
import { Operator, TransactionType, useTransactions } from "@/context/TransactionContext";
import { useColors } from "@/hooks/useColors";
import { formatAmount } from "@/utils/format";
import * as Haptics from "expo-haptics";

const operators: Operator[] = ["MTN", "Moov", "Celtis"];

export default function NewTransaction() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { addTransaction } = useTransactions();

  const [type, setType] = useState<TransactionType>("depot");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [operator, setOperator] = useState<Operator>("MTN");
  const [note, setNote] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const numericAmount = parseInt(amount.replace(/\s/g, ""), 10) || 0;

  const validate = () => {
    if (!clientName) { Alert.alert("Erreur", "Saisissez le nom du client."); return false; }
    if (!clientPhone) { Alert.alert("Erreur", "Saisissez le téléphone du client."); return false; }
    if (numericAmount < 100) { Alert.alert("Erreur", "Montant minimum : 100 FCFA."); return false; }
    return true;
  };

  const handleConfirm = async () => {
    setLoading(true);
    await addTransaction({
      type,
      clientName,
      clientPhone: `+229${clientPhone}`,
      amount: numericAmount,
      operator,
      note,
      agentId: user?.id ?? "",
    });
    setShowConfirm(false);
    setLoading(false);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowSuccess(true);
  };

  const reset = () => {
    setClientName(""); setClientPhone(""); setAmount(""); setNote(""); setOperator("MTN");
    setShowSuccess(false); setType("depot");
  };

  if (showSuccess) {
    return (
      <View style={[styles.success, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20, paddingTop: insets.top + 40 }]}>
        <CheckCircle size={72} color={colors.successText} />
        <Text style={[styles.successTitle, { color: colors.successText }]}>Transaction validée !</Text>
        <View style={styles.successAmountRow}>
          <Text style={[styles.successAmount, { color: colors.primary }]}>{formatAmount(numericAmount)}</Text>
          <Text style={[styles.successFcfa, { color: colors.accent }]}> FCFA</Text>
        </View>
        <Text style={[styles.successClient, { color: colors.muted }]}>{clientName}</Text>
        <View style={styles.successBtns}>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={reset}>
            <Text style={[styles.primaryBtnText, { color: colors.accent }]}>Nouvelle transaction</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { reset(); router.replace("/(tabs)/transactions"); }}>
            <Text style={[styles.ghostBtn, { color: colors.primary }]}>Voir l'historique</Text>
          </TouchableOpacity>
        </View>
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
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={[styles.heading, { color: colors.primary }]}>Nouvelle transaction</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <X size={24} color={colors.muted} />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {/* Type toggle */}
          <View style={[styles.toggle, { backgroundColor: colors.surface }]}>
            {([["depot", "Dépôt"], ["retrait", "Retrait"]] as [TransactionType, string][]).map(([t, lbl]) => (
              <TouchableOpacity
                key={t}
                style={[styles.pill, type === t && { backgroundColor: colors.primary }]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.pillLabel, { color: type === t ? "#FFFFFF" : colors.muted }]}>{lbl}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Fields */}
          {[
            { label: "NOM DU CLIENT", value: clientName, onChange: setClientName, placeholder: "Ex: Kofi Atta" },
          ].map((f) => (
            <View key={f.label}>
              <Text style={[styles.label, { color: colors.muted }]}>{f.label}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text, fontFamily: "Poppins_400Regular" }]}
                value={f.value} onChangeText={f.onChange} placeholder={f.placeholder} placeholderTextColor={colors.muted}
              />
            </View>
          ))}

          <View>
            <Text style={[styles.label, { color: colors.muted }]}>NUMÉRO DE TÉLÉPHONE</Text>
            <View style={[styles.phoneRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <Text style={[styles.prefix, { color: colors.primary }]}>+229</Text>
              <TextInput
                style={[styles.phoneInput, { color: colors.text, fontFamily: "Poppins_400Regular" }]}
                value={clientPhone}
                onChangeText={(t) => setClientPhone(t.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                placeholder="XX XX XX XX"
                placeholderTextColor={colors.muted}
              />
            </View>
          </View>

          <View>
            <Text style={[styles.label, { color: colors.muted }]}>MONTANT FCFA</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.primary, fontSize: 20, fontFamily: "Poppins_700Bold" }]}
              value={amount}
              onChangeText={(t) => {
                const raw = t.replace(/[^0-9]/g, "");
                const num = parseInt(raw, 10);
                setAmount(isNaN(num) ? "" : num.toLocaleString("fr-FR").replace(/,/g, " "));
              }}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.muted}
            />
          </View>

          <View>
            <Text style={[styles.label, { color: colors.muted }]}>OPÉRATEUR</Text>
            <View style={styles.operatorRow}>
              {operators.map((op) => (
                <TouchableOpacity
                  key={op}
                  style={[styles.opPill, { borderColor: operator === op ? colors.primary : colors.border, backgroundColor: operator === op ? "#eef0ff" : colors.card }]}
                  onPress={() => setOperator(op)}
                >
                  <Text style={[styles.opLabel, { color: operator === op ? colors.primary : colors.muted }]}>{op}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View>
            <Text style={[styles.label, { color: colors.muted }]}>NOTE (OPTIONNEL)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text, fontFamily: "Poppins_400Regular" }]}
              value={note}
              onChangeText={setNote}
              placeholder="Ajouter une note..."
              placeholderTextColor={colors.muted}
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
            onPress={() => { if (validate()) setShowConfirm(true); }}
          >
            <Text style={[styles.primaryBtnText, { color: colors.accent }]}>Valider la transaction</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Confirm Modal */}
      <Modal visible={showConfirm} transparent animationType="slide" onRequestClose={() => setShowConfirm(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowConfirm(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}>
          <View style={[{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 }]} />
          <Text style={[styles.confirmTitle, { color: colors.primary }]}>Confirmer la transaction</Text>
          <Badge type={type} />
          <View style={styles.confirmAmountRow}>
            <Text style={[styles.confirmAmount, { color: colors.primary }]}>{formatAmount(numericAmount)}</Text>
            <Text style={[styles.confirmFcfa, { color: colors.accent }]}> FCFA</Text>
          </View>
          {[
            ["Client", clientName],
            ["Téléphone", `+229${clientPhone}`],
            ["Opérateur", operator],
            ...(note ? [["Note", note]] : []),
          ].map(([k, v]) => (
            <View key={k} style={[styles.detailRow, { borderColor: colors.border }]}>
              <Text style={[styles.detailKey, { color: colors.muted }]}>{k}</Text>
              <Text style={[styles.detailVal, { color: colors.text }]}>{v}</Text>
            </View>
          ))}
          <View style={styles.confirmBtns}>
            <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.primary }]} onPress={() => setShowConfirm(false)}>
              <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>Modifier</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary, flex: 1, opacity: loading ? 0.7 : 1 }]} onPress={handleConfirm} disabled={loading}>
              <Text style={[styles.primaryBtnText, { color: colors.accent }]}>{loading ? "..." : "Confirmer"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 16 },
  heading: { fontSize: 20, fontFamily: "Poppins_700Bold" },
  body: { paddingHorizontal: 20, gap: 18 },
  toggle: { flexDirection: "row", borderRadius: 12, padding: 4, gap: 4 },
  pill: { flex: 1, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  pillLabel: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  label: { fontSize: 12, fontFamily: "Poppins_600SemiBold", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 },
  input: { height: 52, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, fontSize: 14 },
  phoneRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, height: 52, paddingHorizontal: 16, gap: 8 },
  prefix: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  phoneInput: { flex: 1, fontSize: 14, height: "100%" },
  operatorRow: { flexDirection: "row", gap: 10 },
  opPill: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  opLabel: { fontSize: 13, fontFamily: "Poppins_700Bold" },
  primaryBtn: { height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { fontSize: 15, fontFamily: "Poppins_700Bold" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 14 },
  confirmTitle: { fontSize: 18, fontFamily: "Poppins_700Bold" },
  confirmAmountRow: { flexDirection: "row", alignItems: "baseline" },
  confirmAmount: { fontSize: 32, fontFamily: "Poppins_700Bold" },
  confirmFcfa: { fontSize: 18, fontFamily: "Poppins_700Bold" },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1 },
  detailKey: { fontSize: 13, fontFamily: "Poppins_400Regular" },
  detailVal: { fontSize: 13, fontFamily: "Poppins_600SemiBold" },
  confirmBtns: { flexDirection: "row", gap: 12, marginTop: 4 },
  secondaryBtn: { height: 52, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  success: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 40 },
  successTitle: { fontSize: 22, fontFamily: "Poppins_700Bold" },
  successAmountRow: { flexDirection: "row", alignItems: "baseline" },
  successAmount: { fontSize: 32, fontFamily: "Poppins_700Bold" },
  successFcfa: { fontSize: 18, fontFamily: "Poppins_700Bold" },
  successClient: { fontSize: 15, fontFamily: "Poppins_400Regular" },
  successBtns: { width: "100%", gap: 12, marginTop: 8 },
  ghostBtn: { textAlign: "center", fontSize: 14, fontFamily: "Poppins_600SemiBold", textDecorationLine: "underline" },
});

import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PinInput } from "@/components/PinInput";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { normalizeBeninPhone } from "@/utils/beninPhone";

type Step = "phone" | "otp" | "newpin";

export default function ForgotPin() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, requestPinReset, resetPinWithOtp } = useAuth();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState(user?.phone ? normalizeBeninPhone(user.phone) : "");
  const [otp, setOtp] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const stepTitles = { phone: "Numéro de téléphone", otp: "Code de vérification", newpin: "Nouveau code PIN" };

  const fullPhone = `+22901${normalizeBeninPhone(phone)}`;

  const handleNext = async () => {
    if (submitting) return;
    if (step === "phone") {
      const digits = normalizeBeninPhone(phone);
      if (digits.length !== 8) { Alert.alert("Erreur", "Saisissez un numéro béninois valide (8 chiffres après 01)."); return; }
      setSubmitting(true);
      const res = await requestPinReset(`+22901${digits}`);
      setSubmitting(false);
      if (!res.success) {
        Alert.alert("Erreur", res.error || "Impossible d'envoyer le code.");
        return;
      }
      if (res.devOtp) {
        Alert.alert("Code de vérification (Dev)", `Votre code OTP est : ${res.devOtp}`);
      }
      setStep("otp");
    } else if (step === "otp") {
      if (otp.length < 6) { Alert.alert("Erreur", "Saisissez le code à 6 chiffres."); return; }
      setStep("newpin");
    } else {
      if (newPin.length < 6) { Alert.alert("Erreur", "Le code PIN doit être de 6 chiffres."); return; }
      if (newPin !== confirmPin) { Alert.alert("Erreur", "Les codes PIN ne correspondent pas."); return; }
      setSubmitting(true);
      const res = await resetPinWithOtp(fullPhone, otp, newPin);
      setSubmitting(false);
      if (!res.success) {
        Alert.alert("Erreur", res.error || "Impossible de modifier le code PIN.");
        return;
      }
      Alert.alert("Succès", "Votre code PIN a été modifié.", [{ text: "OK", onPress: () => router.replace(user ? "/(tabs)/profile" : "/(auth)/login") }]);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => (step === "phone" ? router.back() : setStep(step === "otp" ? "phone" : "otp"))} style={{ marginBottom: 24 }}>
          <Text style={[styles.back, { color: colors.primary }]}>← Retour</Text>
        </TouchableOpacity>

        <Text style={[styles.heading, { color: colors.primary }]}>{stepTitles[step]}</Text>

        {step === "phone" && (
          <View style={styles.form}>
            <Text style={[styles.hint, { color: colors.muted }]}>Entrez le numéro associé à votre compte.</Text>
            <View style={[styles.phoneRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <Text style={[styles.prefix, { color: colors.primary }]}>BJ +229 01</Text>
              <TextInput
                style={[styles.phoneInput, { color: colors.text, fontFamily: "Poppins_400Regular" }]}
                value={phone}
                onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                placeholder="XX XX XX XX"
                placeholderTextColor={colors.muted}
                maxLength={10}
              />
            </View>
          </View>
        )}

        {step === "otp" && (
          <View style={styles.form}>
            <Text style={[styles.hint, { color: colors.muted }]}>Entrez le code à 6 chiffres reçu par SMS.</Text>
            <PinInput value={otp} onChange={setOtp} />
          </View>
        )}

        {step === "newpin" && (
          <View style={[styles.form, { gap: 24 }]}>
            <View style={{ gap: 12 }}>
              <Text style={[styles.label, { color: colors.muted }]}>NOUVEAU CODE PIN</Text>
              <PinInput value={newPin} onChange={setNewPin} />
            </View>
            <View style={{ gap: 12 }}>
              <Text style={[styles.label, { color: colors.muted }]}>CONFIRMER LE CODE PIN</Text>
              <PinInput value={confirmPin} onChange={setConfirmPin} />
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary, opacity: submitting ? 0.7 : 1, flexDirection: "row", gap: 8 }]}
          onPress={handleNext}
          disabled={submitting}
        >
          {submitting && <ActivityIndicator size="small" color="#FFFFFF" />}
          <Text style={[styles.btnText, { color: "#FFFFFF" }]}>
            {submitting ? "Chargement..." : "Continuer"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 20 },
  heading: { fontSize: 22, fontFamily: "Poppins_700Bold", marginBottom: 4 },
  hint: { fontSize: 14, fontFamily: "Poppins_400Regular" },
  form: { gap: 12 },
  label: { fontSize: 12, fontFamily: "Poppins_600SemiBold", textTransform: "uppercase", letterSpacing: 0.4 },
  phoneRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, height: 52, paddingHorizontal: 16, gap: 8 },
  prefix: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  phoneInput: { flex: 1, fontSize: 14, height: "100%" },
  btn: { height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 8 },
  btnText: { fontSize: 15, fontFamily: "Poppins_700Bold" },
  back: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
});

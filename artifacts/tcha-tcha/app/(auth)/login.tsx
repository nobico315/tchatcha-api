import { ArrowRight, CheckCircle2, Eye, EyeOff, Lock, Phone, Wallet, X } from "lucide-react-native";
import { router } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
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

import { PinInput } from "@/components/PinInput";
import { ProgressModal, type ProgressStep } from "@/components/ProgressModal";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { detectOperatorFromDigits, formatPhonePairs } from "@/utils/beninPhone";

const OPERATOR_STYLES: Record<string, { bg: string; text: string }> = {
  MTN: { bg: "#FEF3C7", text: "#92400E" },
  Moov: { bg: "#E0F2FE", text: "#075985" },
  Celtis: { bg: "#DCFCE7", text: "#166534" },
};

export default function Login() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [pinFocusKey, setPinFocusKey] = useState(0);
  const [loading, setLoading] = useState(false);

  const [showProgress, setShowProgress] = useState(false);
  const [steps, setSteps] = useState<ProgressStep[]>([
    { id: "validate", label: "Validation des données", status: "pending" },
    { id: "auth", label: "Vérification des identifiants", status: "pending" },
    { id: "session", label: "Création de session", status: "pending" },
  ]);
  const [progressError, setProgressError] = useState<string>("");
  const timeoutRef = useRef<any>(null);

  const isPhoneValid = phone.length === 10 && phone.startsWith("01");
  const isFormReady = isPhoneValid && pin.length === 6 && !loading;

  const detectedOperator = useMemo(() => {
    if (!phone.startsWith("01") || phone.length < 4) return null;
    return detectOperatorFromDigits(phone.slice(2));
  }, [phone]);

  const formattedPhone = useMemo(() => formatPhonePairs(phone), [phone]);

  const handlePhoneChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, "").slice(0, 10);
    setPhone(digits);
    if (digits.length === 10 && digits.startsWith("01")) {
      setPinFocusKey((k) => k + 1);
    }
  };

  const updateStep = (stepId: string, status: "pending" | "loading" | "success" | "error") => {
    setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, status } : s)));
  };

  const handleLogin = async () => {
    if (!phone || pin.length < 6) {
      Alert.alert("Champs requis", "Veuillez saisir votre numéro et votre code PIN à 6 chiffres.");
      return;
    }

    if (!isPhoneValid) {
      Alert.alert("Numéro invalide", "Veuillez saisir un numéro béninois à 10 chiffres commençant par 01.");
      return;
    }

    setSteps([
      { id: "validate", label: "Validation des données", status: "pending" },
      { id: "auth", label: "Vérification des identifiants", status: "pending" },
      { id: "session", label: "Création de session", status: "pending" },
    ]);
    setProgressError("");
    setShowProgress(true);
    setLoading(true);

    try {
      updateStep("validate", "loading");
      await new Promise((resolve) => setTimeout(resolve, 250));
      updateStep("validate", "success");

      updateStep("auth", "loading");
      const loginPromise = login(`+229${phone}`, pin);

      const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) => {
        timeoutRef.current = setTimeout(() => {
          resolve({
            success: false,
            error: "La demande a dépassé le délai d'attente (30s). Vérifiez votre connexion internet.",
          });
        }, 30000);
      });

      const result = await Promise.race([loginPromise, timeoutPromise]);

      if (!result.success) {
        updateStep("auth", "error");
        setProgressError(result.error || "Identifiants invalides");
        setLoading(false);
        return;
      }

      updateStep("auth", "success");
      updateStep("session", "loading");
      await new Promise((resolve) => setTimeout(resolve, 400));
      updateStep("session", "success");

      setTimeout(() => {
        setLoading(false);
        setShowProgress(false);
        router.replace("/(tabs)");
      }, 700);
    } catch (error) {
      updateStep("auth", "error");
      setProgressError(error instanceof Error ? error.message : "Erreur lors de la connexion");
      setLoading(false);
    } finally {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  };

  const handleRetry = () => handleLogin();

  const handleCancel = () => {
    setShowProgress(false);
    setLoading(false);
    setPin("");
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View style={styles.brandContainer}>
          <View style={[styles.logoIconBg, { backgroundColor: colors.primary }]}>
            <Wallet size={30} color="#FFFFFF" strokeWidth={2.2} />
          </View>
          <Text style={[styles.logoText, { color: colors.text }]}>Tcha-Tcha</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Espace Agent & Gérant Mobile Money
          </Text>
        </View>

        {/* Auth Card */}
        <View style={[styles.cardForm, { backgroundColor: colors.card, borderColor: "#E2E8F0" }]}>
          <Text style={[styles.formHeading, { color: colors.text, marginBottom: 20 }]}>Connexion</Text>

          <View style={styles.formFields}>
            {/* Phone Input */}
            <View>
              <View style={styles.labelHeader}>
                <View style={styles.labelRow}>
                  <Phone size={13} color={colors.muted} />
                  <Text style={[styles.label, { color: colors.muted }]}>NUMÉRO DE TÉLÉPHONE</Text>
                </View>
                {detectedOperator && (
                  <View
                    style={[
                      styles.opBadge,
                      { backgroundColor: OPERATOR_STYLES[detectedOperator]?.bg ?? "#EEF2FF" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.opBadgeText,
                        { color: OPERATOR_STYLES[detectedOperator]?.text ?? colors.primary },
                      ]}
                    >
                      {detectedOperator}
                    </Text>
                  </View>
                )}
              </View>

              <View
                style={[
                  styles.phoneRow,
                  {
                    backgroundColor: phoneFocused ? "#FFFFFF" : "#F8FAFC",
                    borderColor: phoneFocused
                      ? colors.primary
                      : isPhoneValid
                      ? "#16A34A"
                      : "#E2E8F0",
                  },
                ]}
              >
                <View style={styles.countryPill}>
                  <Text style={styles.countryCode}>BJ</Text>
                  <View style={styles.countrySep} />
                  <Text style={[styles.prefix, { color: colors.primary }]}>+229</Text>
                </View>

                <TextInput
                  style={[styles.phoneInput, { color: colors.text }]}
                  value={formattedPhone}
                  onChangeText={handlePhoneChange}
                  onFocus={() => setPhoneFocused(true)}
                  onBlur={() => setPhoneFocused(false)}
                  keyboardType="number-pad"
                  placeholder="01 97 00 00 00"
                  placeholderTextColor="#94A3B8"
                  maxLength={14}
                  returnKeyType="next"
                  onSubmitEditing={() => setPinFocusKey((k) => k + 1)}
                />

                {isPhoneValid ? (
                  <CheckCircle2 size={18} color="#16A34A" />
                ) : phone.length > 0 ? (
                  <TouchableOpacity
                    onPress={() => setPhone("")}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Effacer le numéro"
                  >
                    <X size={16} color="#94A3B8" />
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.helperRow}>
                <Text style={styles.helperText}>10 chiffres commençant par 01</Text>
                <Text style={[styles.counterText, isPhoneValid && { color: "#16A34A" }]}>
                  {phone.length}/10
                </Text>
              </View>
            </View>

            {/* PIN Input */}
            <View style={styles.pinSection}>
              <View style={styles.labelHeader}>
                <View style={styles.labelRow}>
                  <Lock size={13} color={colors.muted} />
                  <Text style={[styles.label, { color: colors.muted }]}>CODE PIN (6 CHIFFRES)</Text>
                </View>

                <TouchableOpacity
                  onPress={() => setShowPin((v) => !v)}
                  style={styles.eyeToggle}
                  activeOpacity={0.7}
                >
                  {showPin ? (
                    <EyeOff size={14} color={colors.primary} />
                  ) : (
                    <Eye size={14} color={colors.muted} />
                  )}
                  <Text style={[styles.eyeToggleText, { color: showPin ? colors.primary : colors.muted }]}>
                    {showPin ? "Masquer" : "Afficher"}
                  </Text>
                </TouchableOpacity>
              </View>

              <PinInput value={pin} onChange={setPin} masked={!showPin} focusKey={pinFocusKey} />

              <View style={styles.pinFooterRow}>
                <TouchableOpacity onPress={() => router.push("/(auth)/forgot-pin")} style={styles.forgotLink}>
                  <Text style={[styles.forgotText, { color: colors.primary }]}>Code PIN oublié ?</Text>
                </TouchableOpacity>
                <Text style={[styles.counterText, pin.length === 6 && { color: "#16A34A" }]}>
                  {pin.length}/6
                </Text>
              </View>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={[
                styles.btn,
                {
                  backgroundColor: isFormReady ? colors.primary : "#94A3B8",
                },
              ]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.btnText}>Se connecter</Text>
                  <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.4} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Register Footer */}
        <View style={styles.linksContainer}>
          <TouchableOpacity onPress={() => router.push("/(auth)/register")} style={styles.registerBtn} activeOpacity={0.75}>
            <Text style={[styles.registerLinkText, { color: colors.muted }]}>
              Nouveau sur Tcha-Tcha ?{" "}
              <Text style={{ color: colors.primary, fontFamily: "Poppins_700Bold" }}>
                Créer un compte
              </Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ProgressModal
        visible={showProgress}
        title="Connexion en cours"
        steps={steps}
        errorMessage={progressError}
        onCancel={handleCancel}
        onRetry={handleRetry}
        backgroundColor={colors.card}
        primaryColor={colors.primary}
        textColor={colors.text}
        mutedColor={colors.muted}
        accentColor={colors.accent}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8FAFC" },
  container: { paddingHorizontal: 20, gap: 20, flexGrow: 1, justifyContent: "center" },
  brandContainer: { alignItems: "center", gap: 6 },
  logoIconBg: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
    shadowColor: "#191970",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 6,
  },
  logoText: { fontSize: 26, fontFamily: "Poppins_700Bold", letterSpacing: -0.4 },
  subtitle: { textAlign: "center", fontSize: 13, fontFamily: "Poppins_400Regular" },

  cardForm: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 3,
  },
  formHeading: { fontSize: 20, fontFamily: "Poppins_700Bold" },

  formFields: { gap: 20 },
  labelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  label: { fontSize: 11, fontFamily: "Poppins_600SemiBold", letterSpacing: 0.6 },

  opBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  opBadgeText: { fontSize: 11, fontFamily: "Poppins_700Bold" },

  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1.5,
    height: 56,
    paddingHorizontal: 12,
    gap: 10,
  },
  countryPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF2FF",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  countryCode: { fontSize: 11, fontFamily: "Poppins_700Bold", color: "#1E293B", letterSpacing: 0.5 },
  countrySep: { width: 1, height: 12, backgroundColor: "#CBD5E1" },
  prefix: { fontSize: 13, fontFamily: "Poppins_700Bold" },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    height: "100%",
    fontFamily: "Poppins_600SemiBold",
    letterSpacing: 0.5,
  },
  helperRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
    paddingHorizontal: 2,
  },
  helperText: { fontSize: 11, fontFamily: "Poppins_400Regular", color: "#64748B" },
  counterText: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: "#94A3B8" },

  pinSection: { width: "100%", gap: 4 },
  eyeToggle: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 2 },
  eyeToggleText: { fontSize: 12, fontFamily: "Poppins_600SemiBold" },
  pinFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingHorizontal: 2,
  },
  forgotLink: { paddingVertical: 2 },
  forgotText: { fontSize: 12, fontFamily: "Poppins_600SemiBold" },

  btn: {
    height: 56,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
    shadowColor: "#191970",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 4,
  },
  btnText: { fontSize: 15, fontFamily: "Poppins_700Bold", color: "#FFFFFF" },

  linksContainer: { alignItems: "center", marginTop: 4 },
  registerBtn: { paddingVertical: 10, paddingHorizontal: 16 },
  registerLinkText: { fontSize: 13, fontFamily: "Poppins_400Regular" },
});

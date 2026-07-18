import { Wallet, Phone, Lock } from "lucide-react-native";
import { router } from "expo-router";
import React, { useState, useRef } from "react";
import {
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

export default function Login() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  // State for progress modal
  const [showProgress, setShowProgress] = useState(false);
  const [steps, setSteps] = useState<ProgressStep[]>([
    { id: "validate", label: "Validation des données", status: "pending" },
    { id: "auth", label: "Vérification des identifiants", status: "pending" },
    { id: "session", label: "Création de session", status: "pending" },
  ]);
  const [progressError, setProgressError] = useState<string>("");
  const timeoutRef = useRef<any>(null);

  const updateStep = (stepId: string, status: "pending" | "loading" | "success" | "error") => {
    setSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, status } : s))
    );
  };

  const handleLogin = async () => {
    // Basic validation
    if (!phone || pin.length < 6) {
      Alert.alert("Erreur", "Veuillez saisir votre numéro et votre code PIN.");
      return;
    }

    // Benin 10-digit phone number check
    if (phone.length !== 10 || !phone.startsWith("01")) {
      Alert.alert("Erreur", "Veuillez saisir un numéro béninois valide à 10 chiffres (commençant par 01).");
      return;
    }

    // Reset steps
    setSteps([
      { id: "validate", label: "Validation des données", status: "pending" },
      { id: "auth", label: "Vérification des identifiants", status: "pending" },
      { id: "session", label: "Création de session", status: "pending" },
    ]);
    setProgressError("");
    setShowProgress(true);
    setLoading(true);

    try {
      // Step 1: Validation
      updateStep("validate", "loading");
      await new Promise((resolve) => setTimeout(resolve, 300));
      updateStep("validate", "success");

      // Step 2: Authentication with timeout
      updateStep("auth", "loading");
      const loginPromise = login(`+229${phone}`, pin);

      const timeoutPromise = new Promise<{ success: false; error: string }>(
        (resolve) => {
          timeoutRef.current = setTimeout(() => {
            resolve({
              success: false,
              error: "La demande a dépassé le délai d'attente (30s). Vérifiez votre connexion internet.",
            });
          }, 30000);
        }
      );

      const result = await Promise.race([loginPromise, timeoutPromise]);

      if (!result.success) {
        updateStep("auth", "error");
        setProgressError(result.error || "Identifiants invalides");
        setLoading(false);
        return;
      }

      updateStep("auth", "success");

      // Step 3: Session
      updateStep("session", "loading");
      await new Promise((resolve) => setTimeout(resolve, 500));
      updateStep("session", "success");

      // Success! Redirect after 1 second
      setTimeout(() => {
        setLoading(false);
        setShowProgress(false);
        router.replace("/(tabs)");
      }, 1000);
    } catch (error) {
      updateStep("auth", "error");
      setProgressError(
        error instanceof Error ? error.message : "Erreur lors de la connexion"
      );
      setLoading(false);
    } finally {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  };

  const handleRetry = () => {
    handleLogin();
  };

  const handleCancel = () => {
    setShowProgress(false);
    setLoading(false);
    setPin("");
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 50, paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo/Branding section */}
        <View style={styles.brandContainer}>
          <View style={[styles.logoIconBg, { backgroundColor: "rgba(25, 25, 112, 0.08)" }]}>
            <Wallet size={36} color={colors.primary} />
          </View>
          <Text style={[styles.logoText, { color: colors.primary }]}>Tcha-Tcha</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Gérez votre activité Mobile Money en toute simplicité
          </Text>
        </View>

        {/* Card Form */}
        <View style={[styles.cardForm, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.formHeading, { color: colors.text }]}>Connexion</Text>
          
          <View style={styles.formFields}>
            {/* Phone Input */}
            <View>
              <View style={styles.labelRow}>
                <Phone size={14} color={colors.muted} />
                <Text style={[styles.label, { color: colors.muted }]}>NUMÉRO DE TÉLÉPHONE</Text>
              </View>
              <View style={[styles.phoneRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
                <Text style={[styles.prefix, { color: colors.primary }]}>🇧🇯 +229</Text>
                <TextInput
                  style={[styles.phoneInput, { color: colors.text, fontFamily: "Poppins_400Regular" }]}
                  value={phone}
                  onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, ""))}
                  keyboardType="number-pad"
                  placeholder="01 XX XX XX XX"
                  placeholderTextColor={colors.muted}
                  maxLength={10}
                />
              </View>
              <Text style={styles.helperText}>Format : 10 chiffres (ex: 01 97 97 97 97)</Text>
            </View>

            {/* PIN Input */}
            <View style={styles.pinSection}>
              <View style={styles.labelRow}>
                <Lock size={14} color={colors.muted} />
                <Text style={[styles.label, { color: colors.muted }]}>CODE PIN (6 CHIFFRES)</Text>
              </View>
              <PinInput value={pin} onChange={setPin} />
            </View>

            {/* Login button */}
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={[styles.btnText, { color: colors.accent }]}>
                {loading ? "Connexion..." : "Se connecter"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Action Links */}
        <View style={styles.linksContainer}>
          <TouchableOpacity onPress={() => router.push("/(auth)/forgot-pin")} style={styles.linkTouch}>
            <Text style={[styles.linkText, { color: colors.muted }]}>Code PIN oublié ?</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push("/(auth)/register")} style={styles.linkTouch}>
            <Text style={[styles.registerLinkText, { color: colors.primary }]}>
              Pas encore de compte ? <Text style={{ fontFamily: "Poppins_700Bold", textDecorationLine: "underline" }}>Créer un compte</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Progress Modal */}
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
  container: { paddingHorizontal: 24, gap: 16, flexGrow: 1, justifyContent: "center" },
  brandContainer: { alignItems: "center", marginBottom: 12, gap: 8 },
  logoIconBg: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  logoText: { fontSize: 26, fontFamily: "Poppins_800ExtraBold", letterSpacing: 0.5 },
  subtitle: { textAlign: "center", fontSize: 13, fontFamily: "Poppins_400Regular", paddingHorizontal: 12, lineHeight: 18 },
  
  // Form Card
  cardForm: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  formHeading: { fontSize: 18, fontFamily: "Poppins_700Bold", marginBottom: 20 },
  formFields: { gap: 20 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  label: { fontSize: 10, fontFamily: "Poppins_700Bold", textTransform: "uppercase", letterSpacing: 0.5 },
  
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1.5,
    height: 52,
    paddingHorizontal: 16,
    gap: 8,
  },
  prefix: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  phoneInput: { flex: 1, fontSize: 15, height: "100%", fontFamily: "Poppins_600SemiBold" },
  helperText: { fontSize: 10, fontFamily: "Poppins_400Regular", color: "#999", marginTop: 4, marginLeft: 2 },

  pinSection: { alignItems: "center", gap: 6, width: "100%" },
  
  btn: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 8 },
  btnText: { fontSize: 15, fontFamily: "Poppins_700Bold" },

  linksContainer: { alignItems: "center", gap: 12, marginTop: 8 },
  linkTouch: { padding: 4 },
  linkText: { fontSize: 13, fontFamily: "Poppins_500Medium" },
  registerLinkText: { fontSize: 13, fontFamily: "Poppins_500Medium" },
});

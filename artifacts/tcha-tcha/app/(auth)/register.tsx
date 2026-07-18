import { User as UserIcon, Users, Wallet, Phone, Lock, UserCheck } from "lucide-react-native";
import { router } from "expo-router";
import React, { useState, useRef } from "react";
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PinInput } from "@/components/PinInput";
import { ProgressModal, type ProgressStep } from "@/components/ProgressModal";
import { useAuth, Role } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const InputField = ({ label, value, onChange, keyboardType = "default", placeholder = "" }: {
  label: string; value: string; onChange: (v: string) => void;
  keyboardType?: any; placeholder?: string;
}) => {
  const colors = useColors();
  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.fieldLabel, { color: colors.muted }]}>{label}</Text>
      <TextInput
        style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text, fontFamily: "Poppins_400Regular" }]}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
      />
    </View>
  );
};

export default function Register() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [role, setRole] = useState<Role>("agent");
  const [loading, setLoading] = useState(false);
  
  // State for progress modal
  const [showProgress, setShowProgress] = useState(false);
  const [steps, setSteps] = useState<ProgressStep[]>([
    { id: "validate", label: "Validation des données", status: "pending" },
    { id: "register", label: "Création du compte", status: "pending" },
    { id: "session", label: "Création de la session", status: "pending" },
  ]);
  const [progressError, setProgressError] = useState<string>("");
  const timeoutRef = useRef<any>(null);

  const updateStep = (stepId: string, status: "pending" | "loading" | "success" | "error") => {
    setSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, status } : s))
    );
  };

  const handleRegister = async () => {
    // Input validation
    if (!firstName || !lastName || !phone) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs.");
      return;
    }

    // Benin 10-digit phone number check
    if (phone.length !== 10 || !phone.startsWith("01")) {
      Alert.alert("Erreur", "Veuillez saisir un numéro béninois valide à 10 chiffres (commençant par 01).");
      return;
    }

    if (pin.length < 6) {
      Alert.alert("Erreur", "Le code PIN doit contenir 6 chiffres.");
      return;
    }
    if (pin !== confirmPin) {
      Alert.alert("Erreur", "Les codes PIN ne correspondent pas.");
      return;
    }

    // Reset steps
    setSteps([
      { id: "validate", label: "Validation des données", status: "pending" },
      { id: "register", label: "Création du compte", status: "pending" },
      { id: "session", label: "Création de la session", status: "pending" },
    ]);
    setProgressError("");
    setShowProgress(true);
    setLoading(true);

    try {
      // Step 1: Validation
      updateStep("validate", "loading");
      await new Promise((resolve) => setTimeout(resolve, 300));
      updateStep("validate", "success");

      // Step 2: Inscription with timeout
      updateStep("register", "loading");
      const registerPromise = register({
        firstName,
        lastName,
        phone: `+229${phone}`,
        pin,
        role,
      });

      // 30 seconds timeout
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

      const result = await Promise.race([registerPromise, timeoutPromise]);

      if (!result.success) {
        updateStep("register", "error");
        setProgressError(result.error || "Erreur lors de la création du compte");
        setLoading(false);
        return;
      }

      updateStep("register", "success");

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
      updateStep("register", "error");
      setProgressError(
        error instanceof Error ? error.message : "Erreur lors de l'inscription"
      );
      setLoading(false);
    } finally {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  };

  const handleRetry = () => {
    handleRegister();
  };

  const handleCancel = () => {
    setShowProgress(false);
    setLoading(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView 
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 30, paddingBottom: insets.bottom + 40 }]} 
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo/Branding section */}
        <View style={styles.brandContainer}>
          <View style={styles.logoRow}>
            <Wallet size={24} color={colors.primary} />
            <Text style={[styles.logoText, { color: colors.primary }]}>Tcha-Tcha</Text>
          </View>
          <Text style={[styles.heading, { color: colors.primary }]}>Créer un compte</Text>
        </View>

        {/* Card Form */}
        <View style={[styles.cardForm, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.formFields}>
            
            {/* Name Fields (Row) */}
            <View style={styles.nameRow}>
              <InputField label="PRÉNOM" value={firstName} onChange={setFirstName} placeholder="Kouassi" />
              <InputField label="NOM" value={lastName} onChange={setLastName} placeholder="Koffi" />
            </View>

            {/* Phone Field */}
            <View>
              <View style={styles.labelRow}>
                <Phone size={14} color={colors.muted} />
                <Text style={[styles.fieldLabel, { color: colors.muted }]}>NUMÉRO DE TÉLÉPHONE</Text>
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

            {/* Role Field (Redesigned with Premium Dual Cards) */}
            <View>
              <View style={styles.labelRow}>
                <UserCheck size={14} color={colors.muted} />
                <Text style={[styles.fieldLabel, { color: colors.muted }]}>CHOISISSEZ VOTRE RÔLE</Text>
              </View>
              <View style={styles.roleRow}>
                {([
                  ["agent", "Agent", UserIcon, "Gère les transactions en kiosque"],
                  ["gerant", "Gérant", Users, "Supervise les agents et statistiques"]
                ] as [Role, string, any, string][]).map(([r, lbl, Icon, desc]) => {
                  const isSelected = role === r;
                  const borderCol = isSelected ? colors.primary : colors.border;
                  const bgCol = isSelected ? "rgba(25, 25, 112, 0.04)" : colors.card;
                  const iconCol = isSelected ? colors.primary : colors.muted;

                  return (
                    <TouchableOpacity
                      key={r}
                      style={[styles.roleCard, { borderColor: borderCol, backgroundColor: bgCol }]}
                      onPress={() => setRole(r)}
                      activeOpacity={0.8}
                    >
                      <Icon size={24} color={iconCol} />
                      <Text style={[styles.roleLabel, { color: isSelected ? colors.primary : colors.text }]}>{lbl}</Text>
                      <Text style={[styles.roleDesc, { color: colors.muted }]} numberOfLines={2}>{desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* PIN Fields */}
            <View style={styles.pinSection}>
              <View style={styles.labelRow}>
                <Lock size={14} color={colors.muted} />
                <Text style={[styles.fieldLabel, { color: colors.muted }]}>CRÉER UN CODE PIN (6 CHIFFRES)</Text>
              </View>
              <PinInput value={pin} onChange={setPin} />
            </View>

            <View style={styles.pinSection}>
              <View style={styles.labelRow}>
                <Lock size={14} color={colors.muted} />
                <Text style={[styles.fieldLabel, { color: colors.muted }]}>CONFIRMER LE CODE PIN</Text>
              </View>
              <PinInput value={confirmPin} onChange={setConfirmPin} />
            </View>

            {/* Register button */}
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
              onPress={handleRegister}
              disabled={loading}
            >
              <Text style={[styles.btnText, { color: colors.accent }]}>
                {loading ? "Création..." : "Créer mon compte"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Action Link */}
        <TouchableOpacity onPress={() => router.back()} style={styles.linkTouch}>
          <Text style={[styles.linkText, { color: colors.muted }]}>
            Déjà un compte ? <Text style={{ color: colors.primary, fontFamily: "Poppins_700Bold", textDecorationLine: "underline" }}>Se connecter</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Progress Modal */}
      <ProgressModal
        visible={showProgress}
        title="Création du compte"
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
  brandContainer: { alignItems: "center", marginBottom: 8, gap: 4 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center" },
  logoText: { fontSize: 20, fontFamily: "Poppins_700Bold" },
  heading: { fontSize: 22, fontFamily: "Poppins_800ExtraBold", marginTop: 4 },
  
  // Card Form
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
  formFields: { gap: 18 },
  nameRow: { flexDirection: "row", gap: 12 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  fieldLabel: { fontSize: 10, fontFamily: "Poppins_700Bold", textTransform: "uppercase", letterSpacing: 0.5 },
  input: { height: 50, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 16, fontSize: 14 },
  
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1.5,
    height: 50,
    paddingHorizontal: 16,
    gap: 8,
  },
  prefix: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  phoneInput: { flex: 1, fontSize: 15, height: "100%", fontFamily: "Poppins_600SemiBold" },
  helperText: { fontSize: 10, fontFamily: "Poppins_400Regular", color: "#999", marginTop: 4, marginLeft: 2 },

  // Role section
  roleRow: { flexDirection: "row", gap: 12 },
  roleCard: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    gap: 4,
    minHeight: 120,
    justifyContent: "center",
  },
  roleLabel: { fontSize: 14, fontFamily: "Poppins_700Bold" },
  roleDesc: { fontSize: 9, fontFamily: "Poppins_400Regular", textAlign: "center", lineHeight: 12, marginTop: 2 },

  pinSection: { alignItems: "center", gap: 6, width: "100%" },
  
  btn: { height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 8 },
  btnText: { fontSize: 15, fontFamily: "Poppins_700Bold" },

  linkTouch: { padding: 4, alignItems: "center", marginTop: 8 },
  linkText: { fontSize: 13, fontFamily: "Poppins_500Medium" },
});

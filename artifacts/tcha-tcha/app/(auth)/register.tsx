import { ArrowLeft } from "lucide-react-native";
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
import * as Haptics from "expo-haptics";

import { PinInput } from "@/components/PinInput";
import { ProgressModal, type ProgressStep } from "@/components/ProgressModal";
import { useAuth, Role } from "@/context/AuthContext";

export default function Register() {
  const insets = useSafeAreaInsets();
  const { register } = useAuth();

  // Étape courante : 1, 2 ou 3
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form states
  const [role, setRole] = useState<Role>("agent");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  const [loading, setLoading] = useState(false);

  // Progress Modal
  const [showProgress, setShowProgress] = useState(false);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([
    { id: "validate", label: "Validation des données", status: "pending" },
    { id: "register", label: "Création du compte", status: "pending" },
    { id: "session", label: "Ouverture de session", status: "pending" },
  ]);
  const [progressError, setProgressError] = useState<string>("");
  const timeoutRef = useRef<any>(null);

  const updateProgressStep = (stepId: string, status: "pending" | "loading" | "success" | "error") => {
    setProgressSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, status } : s))
    );
  };

  const handleNextStep1 = () => {
    if (!fullName.trim()) {
      Alert.alert("Champ requis", "Veuillez renseigner votre nom complet.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(2);
  };

  const handleNextStep2 = () => {
    const cleanDigits = phone.replace(/[^0-9]/g, "");
    if (cleanDigits.length !== 8) {
      Alert.alert("Numéro invalide", "Veuillez saisir les 8 chiffres après 01.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep(3);
  };

  const handleFinalRegister = async () => {
    if (pin.length !== 6) {
      Alert.alert("Code PIN incomplet", "Le code PIN doit comporter 6 chiffres.");
      return;
    }
    if (confirmPin.length !== 6) {
      Alert.alert("Confirmation requise", "Veuillez confirmer votre code PIN.");
      return;
    }
    if (pin !== confirmPin) {
      Alert.alert("Erreur", "Les deux codes PIN ne correspondent pas.");
      return;
    }

    setProgressSteps([
      { id: "validate", label: "Validation des données", status: "pending" },
      { id: "register", label: "Création du compte", status: "pending" },
      { id: "session", label: "Ouverture de session", status: "pending" },
    ]);
    setProgressError("");
    setShowProgress(true);
    setLoading(true);

    try {
      updateProgressStep("validate", "loading");
      await new Promise((r) => setTimeout(r, 200));
      updateProgressStep("validate", "success");

      updateProgressStep("register", "loading");
      const fullPhone = `+22901${phone.replace(/[^0-9]/g, "")}`;
      const result = await register({
        fullName: fullName.trim(),
        phone: fullPhone,
        pin,
        role,
        inviteCode: inviteCode.trim() || undefined,
      });

      if (!result.success) {
        updateProgressStep("register", "error");
        setProgressError(result.error || "Erreur lors de la création du compte.");
        setLoading(false);
        return;
      }

      updateProgressStep("register", "success");
      updateProgressStep("session", "loading");
      await new Promise((r) => setTimeout(r, 400));
      updateProgressStep("session", "success");

      setTimeout(() => {
        setLoading(false);
        setShowProgress(false);
        router.replace("/(tabs)");
      }, 800);
    } catch (err: any) {
      updateProgressStep("register", "error");
      setProgressError(err?.message || "Erreur réseau.");
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Navigation & Header */}
        <View style={styles.topBar}>
          {step > 1 ? (
            <TouchableOpacity
              onPress={() => setStep((s) => (s - 1) as any)}
              style={styles.backBtn}
              activeOpacity={0.7}
            >
              <ArrowLeft size={20} color="#000000" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
              <ArrowLeft size={20} color="#000000" />
            </TouchableOpacity>
          )}

          {/* Stepper Pill Indicator */}
          <View style={styles.stepperContainer}>
            <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]} />
            <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]} />
            <View style={[styles.stepDot, step >= 3 && styles.stepDotActive]} />
          </View>

          <Text style={styles.stepCounterText}>Étape {step}/3</Text>
        </View>

        {/* ─── ÉTAPE 1 : Rôle & Identité ─── */}
        {step === 1 && (
          <View style={styles.stepBody}>
            <View style={styles.headerBlock}>
              <Text style={styles.pageTitle}>Créer un compte</Text>
              <Text style={styles.pageSub}>Sélectionnez votre activité et vos coordonnées</Text>
            </View>

            {/* Sélecteur de rôle 2026 : Segmented pill épuré */}
            <View style={styles.roleSegment}>
              <TouchableOpacity
                style={[styles.roleTab, role === "agent" && styles.roleTabActive]}
                onPress={() => setRole("agent")}
                activeOpacity={0.85}
              >
                <Text style={[styles.roleTabText, role === "agent" && styles.roleTabTextActive]}>Agent</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.roleTab, role === "gerant" && styles.roleTabActive]}
                onPress={() => setRole("gerant")}
                activeOpacity={0.85}
              >
                <Text style={[styles.roleTabText, role === "gerant" && styles.roleTabTextActive]}>Gérant</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NOM COMPLET</Text>
              <TextInput
                style={styles.textInput}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Ex: Jean Michel Aklassou"
                placeholderTextColor="#8E9AB4"
                selectionColor="#191970"
                cursorColor="#191970"
                autoCapitalize="words"
              />
            </View>

            <TouchableOpacity style={styles.primaryBtn} onPress={handleNextStep1} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Continuer</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.back()} style={styles.loginLink} activeOpacity={0.7}>
              <Text style={styles.loginLinkText}>
                Déjà un compte ? <Text style={styles.loginLinkBold}>Se connecter</Text>
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── ÉTAPE 2 : Numéro & Code Gérant ─── */}
        {step === 2 && (
          <View style={styles.stepBody}>
            <View style={styles.headerBlock}>
              <Text style={styles.pageTitle}>Votre numéro</Text>
              <Text style={styles.pageSub}>Numéro utilisé pour vos opérations au kiosque</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>NUMÉRO DE TÉLÉPHONE</Text>
              <View style={styles.phoneInputRow}>
                <View style={styles.countryCodeBadge}>
                  <Text style={styles.countryCodeText}>+229 01</Text>
                </View>
                <TextInput
                  style={styles.phoneField}
                  value={phone}
                  onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, "").slice(0, 8))}
                  placeholder="XX XX XX XX"
                  placeholderTextColor="#8E9AB4"
                  keyboardType="number-pad"
                  selectionColor="#191970"
                  cursorColor="#191970"
                  autoFocus
                />
              </View>
            </View>

            {role === "agent" && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>CODE D'INVITATION GÉRANT (OPTIONNEL)</Text>
                <TextInput
                  style={[styles.textInput, styles.codeField]}
                  value={inviteCode}
                  onChangeText={(t) => setInviteCode(t.toUpperCase().trim())}
                  placeholder="EX: JEAN-1032"
                  placeholderTextColor="#8E9AB4"
                  autoCapitalize="characters"
                  selectionColor="#191970"
                  cursorColor="#191970"
                />
              </View>
            )}

            <TouchableOpacity style={styles.primaryBtn} onPress={handleNextStep2} activeOpacity={0.85}>
              <Text style={styles.primaryBtnText}>Continuer</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ─── ÉTAPE 3 : Code PIN 6 Chiffres ─── */}
        {step === 3 && (
          <View style={styles.stepBody}>
            <View style={styles.headerBlock}>
              <Text style={styles.pageTitle}>Code secret</Text>
              <Text style={styles.pageSub}>Définissez votre code PIN à 6 chiffres</Text>
            </View>

            <View style={styles.pinBlock}>
              <Text style={styles.pinBlockLabel}>CRÉER LE CODE PIN (6 CHIFFRES)</Text>
              <PinInput value={pin} onChange={setPin} />
            </View>

            <View style={styles.pinBlock}>
              <Text style={styles.pinBlockLabel}>CONFIRMER LE CODE PIN</Text>
              <PinInput value={confirmPin} onChange={setConfirmPin} />
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, { opacity: loading ? 0.7 : 1 }]}
              onPress={handleFinalRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>
                {loading ? "Création en cours..." : "Finaliser l'inscription"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Progress Modal */}
      <ProgressModal
        visible={showProgress}
        title="Création du compte"
        steps={progressSteps}
        errorMessage={progressError}
        onCancel={() => {
          setShowProgress(false);
          setLoading(false);
        }}
        onRetry={handleFinalRegister}
        backgroundColor="#FFFFFF"
        primaryColor="#191970"
        textColor="#000000"
        mutedColor="#8E9AB4"
        accentColor="#191970"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    paddingHorizontal: 24,
    flexGrow: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 28,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F4F6FB",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepDot: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
  },
  stepDotActive: {
    backgroundColor: "#191970",
  },
  stepCounterText: {
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    color: "#8E9AB4",
  },

  stepBody: {
    gap: 20,
  },
  headerBlock: {
    marginBottom: 6,
  },
  pageTitle: {
    fontSize: 26,
    fontFamily: "Poppins_700Bold",
    color: "#000000",
    letterSpacing: -0.5,
  },
  pageSub: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: "#8E9AB4",
    marginTop: 4,
  },

  // Segmented control Rôle
  roleSegment: {
    flexDirection: "row",
    backgroundColor: "#F4F6FB",
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  roleTab: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  roleTabActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  roleTabText: {
    fontSize: 14,
    fontFamily: "Poppins_600SemiBold",
    color: "#8E9AB4",
  },
  roleTabTextActive: {
    color: "#191970",
  },

  // Champs de saisie
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    color: "#8E9AB4",
    letterSpacing: 0.5,
  },
  textInput: {
    height: 52,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    fontFamily: "Poppins_600SemiBold",
    color: "#000000",
  },
  phoneInputRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    overflow: "hidden",
  },
  countryCodeBadge: {
    height: "100%",
    paddingHorizontal: 16,
    backgroundColor: "#F4F6FB",
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1.5,
    borderRightColor: "#E2E8F0",
  },
  countryCodeText: {
    fontSize: 14,
    fontFamily: "Poppins_700Bold",
    color: "#191970",
  },
  phoneField: {
    flex: 1,
    height: "100%",
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: "Poppins_700Bold",
    color: "#000000",
    letterSpacing: 1.5,
  },
  codeField: {
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },

  // Pin section
  pinBlock: {
    alignItems: "center",
    gap: 8,
    marginVertical: 4,
  },
  pinBlockLabel: {
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    color: "#8E9AB4",
    letterSpacing: 0.5,
  },

  // Bouton d'action principal
  primaryBtn: {
    height: 54,
    backgroundColor: "#191970",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Poppins_700Bold",
  },

  loginLink: {
    alignItems: "center",
    marginTop: 8,
  },
  loginLinkText: {
    fontSize: 13,
    fontFamily: "Poppins_400Regular",
    color: "#8E9AB4",
  },
  loginLinkBold: {
    color: "#191970",
    fontFamily: "Poppins_700Bold",
  },
});

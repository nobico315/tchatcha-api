import { Check, CheckCircle2, ChevronDown, Clock, Globe2, X, Mic, MicOff, MessageSquareText } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
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

import { useAuth } from "@/context/AuthContext";
import { Operator, TransactionType, useTransactions } from "@/context/TransactionContext";
import { usePhoneDictation } from "@/hooks/usePhoneDictation";
import { formatAmount } from "@/utils/format";
import {
  detectOperatorFromDigits,
  formatPhonePairs,
  groupThousands,
  normalizeBeninPhone,
} from "@/utils/beninPhone";
import { parseMomoSms } from "@/utils/momoSmsParser";

const amountPresets = [500, 1000, 2000, 5000, 10000, 25000];

const operatorBadgeColors: Record<Operator, { backgroundColor: string }> = {
  MTN: { backgroundColor: "#FFC700" },
  Moov: { backgroundColor: "#00C3FF" },
  Celtis: { backgroundColor: "#00A86B" },
};

export default function NewTransaction() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { addTransaction, getSavedClientByPhone, transactions, getTodaySession } = useTransactions();
  const params = useLocalSearchParams<{ type?: TransactionType }>();

  const todaySession = user ? getTodaySession(user.id) : null;
  const isDayOpen = !!(todaySession && todaySession.isOpen);
  const todayStr = new Date().toISOString().split("T")[0];
  const todayTxCount = (transactions || []).filter(
    (t) => t.agentId === user?.id && t.createdAt.startsWith(todayStr)
  ).length;

  const initialType: TransactionType =
    params.type === "retrait" || params.type === "vente" ? params.type : "depot";

  const [type, setType] = useState<TransactionType>(initialType);
  const [phoneDigits, setPhoneDigits] = useState("");
  const [operator, setOperator] = useState<Operator | null>(null);
  const [manualOperatorSelected, setManualOperatorSelected] = useState(false);
  const [showOperatorPicker, setShowOperatorPicker] = useState(false);
  const [amount, setAmount] = useState("");
  const [clientName, setClientName] = useState("");
  const [paid, setPaid] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [smsDraft, setSmsDraft] = useState("");

  const handleImportSms = () => {
    const parsed = parseMomoSms(smsDraft);
    if (!parsed) {
      Alert.alert(
        "SMS non reconnu",
        "Impossible d'extraire l'opérateur, le type (dépôt/retrait/crédit) ou le montant depuis ce SMS."
      );
      return;
    }
    setType(parsed.type);
    setOperator(parsed.operator);
    setManualOperatorSelected(true);
    setAmount(String(parsed.amount));
    if (parsed.clientPhone) setPhoneDigits(parsed.clientPhone);
    if (parsed.clientName && !parsed.clientName.startsWith("Client ")) {
      setClientName(parsed.clientName);
    }
    setSmsDraft("");
    setShowSmsModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const phoneInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const amountInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Nettoyage des timers à la sortie de l'écran
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (focusTimer.current) clearTimeout(focusTimer.current);
    };
  }, []);

  const formattedPhone = formatPhonePairs(phoneDigits);
  const showGlobe = operator === null;

  /* ───────── Saisie du numéro (clavier, collage ou voix) ───────── */
  const handlePhoneChange = (text: string) => {
    const clean = normalizeBeninPhone(text);
    setPhoneDigits(clean);

    if (clean.length === 0) setManualOperatorSelected(false);

    const detected = detectOperatorFromDigits(clean);
    if (detected) {
      setOperator(detected);
      setManualOperatorSelected(false);
    } else if (!manualOperatorSelected) {
      setOperator(null);
    }

    if (clean.length === 8) {
      const fullPhone = `+22901${clean}`;
      const saved = getSavedClientByPhone(fullPhone) || getSavedClientByPhone(`01${clean}`);
      if (saved?.name && !clientName) setClientName(saved.name);

      if (focusTimer.current) clearTimeout(focusTimer.current);
      focusTimer.current = setTimeout(() => amountInputRef.current?.focus(), 80);
    }
  };

  /* ───────── Dictée vocale ───────── */
  const { isListening, error: speechError, toggle: toggleDictation } = usePhoneDictation(handlePhoneChange);

  const onMicPress = () => {
    Keyboard.dismiss();
    toggleDictation();
  };

  /* ───────── Réseau / montant ───────── */
  const selectOperator = (selectedOperator: Operator) => {
    setOperator(selectedOperator);
    setManualOperatorSelected(true);
    setShowOperatorPicker(false);
  };

  const handleAmountChange = (t: string) => {
    const raw = t.replace(/[^0-9]/g, "").slice(0, 9);
    const num = parseInt(raw, 10);
    setAmount(isNaN(num) ? "" : groupThousands(num));
  };

  const handleSelectAmount = (val: number) => {
    setAmount(groupThousands(val));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const numericAmount = parseInt(amount.replace(/\s/g, ""), 10) || 0;

  const handleClose = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  };

  /* ───────── Enregistrement ───────── */
  const handleSubmit = async () => {
    if (loading) return;

    if (phoneDigits.length < 8) {
      Alert.alert("Numéro incomplet", "Veuillez saisir un numéro de téléphone valide à 8 chiffres après 01.");
      return;
    }

    if (!operator) {
      Alert.alert("Réseau non reconnu", "Sélectionnez le réseau du numéro avec l’icône globe avant de continuer.");
      return;
    }

    if (numericAmount < 100) {
      Alert.alert("Montant invalide", "Le montant minimum est de 100 FCFA.");
      return;
    }

    setLoading(true);
    try {
      const fullPhone = `+22901${phoneDigits}`;
      const finalClientName = clientName.trim() || fullPhone;

      await addTransaction({
        type,
        clientName: finalClientName,
        clientPhone: fullPhone,
        amount: numericAmount,
        operator,
        savedClient: true,
        paid,
        agentId: user?.id ?? "",
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const label = type === "depot" ? "Dépôt" : type === "retrait" ? "Retrait" : "Crédit";
      setSuccessMsg(`✓ ${label} de ${formatAmount(numericAmount)} FCFA enregistré !`);

      setPhoneDigits("");
      setAmount("");
      setClientName("");
      setOperator(null);
      setManualOperatorSelected(false);
      setPaid(true);
      setType("depot");

      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => {
        setSuccessMsg(null);
        phoneInputRef.current?.focus();
      }, 3000);
    } catch (err: any) {
      Alert.alert("Erreur", err?.message ?? "Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setLoading(false);
    }
  };

  const tabs: { key: TransactionType; label: string }[] = [
    { key: "depot", label: "Dépôt" },
    { key: "retrait", label: "Retrait" },
    { key: "vente", label: "Crédit / Forfait" },
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#FFFFFF" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: "#FFFFFF" }}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 30 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Fermer + Importer SMS */}
        <View style={[styles.header, { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }]}>
          <TouchableOpacity
            onPress={() => setShowSmsModal(true)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              backgroundColor: "#EEF2FF",
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 20,
            }}
            activeOpacity={0.7}
          >
            <MessageSquareText size={16} color="#191970" />
            <Text style={{ fontSize: 12, fontFamily: "Poppins_600SemiBold", color: "#191970" }}>
              Importer un SMS
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.closeBtn}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
          >
            <X size={22} color="#8E9AB4" strokeWidth={2.2} />
          </TouchableOpacity>
        </View>

        <Modal visible={showSmsModal} transparent animationType="fade" onRequestClose={() => setShowSmsModal(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 20 }}>
            <View style={{ backgroundColor: "#FFFFFF", borderRadius: 20, padding: 20, gap: 14 }}>
              <Text style={{ fontSize: 16, fontFamily: "Poppins_700Bold", color: "#191970" }}>
                Coller un SMS Mobile Money
              </Text>
              <Text style={{ fontSize: 12, fontFamily: "Poppins_400Regular", color: "#64748B" }}>
                Collez le SMS de confirmation MTN, Moov ou Celtiis pour pré-remplir automatiquement la transaction.
              </Text>
              <TextInput
                value={smsDraft}
                onChangeText={setSmsDraft}
                multiline
                numberOfLines={4}
                placeholder="Ex: Vous avez reçu 10000 FCFA de 0197644096 pour retrait MTN MoMo..."
                placeholderTextColor="#94A3B8"
                style={{
                  borderWidth: 1,
                  borderColor: "#E2E8F0",
                  borderRadius: 12,
                  padding: 12,
                  minHeight: 100,
                  textAlignVertical: "top",
                  fontSize: 13,
                  color: "#0F172A",
                }}
              />
              <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end" }}>
                <TouchableOpacity
                  onPress={() => setShowSmsModal(false)}
                  style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: "#F1F5F9" }}
                >
                  <Text style={{ fontSize: 13, fontFamily: "Poppins_600SemiBold", color: "#475569" }}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleImportSms}
                  style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: "#191970" }}
                >
                  <Text style={{ fontSize: 13, fontFamily: "Poppins_600SemiBold", color: "#FFFFFF" }}>Analyser</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Toast de succès */}
        {successMsg && (
          <View style={styles.successToast}>
            <Text style={styles.successToastText}>{successMsg}</Text>
          </View>
        )}

        {/* Type d'opération */}
        <View style={styles.typeTabsRow}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.typeTab, type === tab.key && styles.typeTabActive]}
              onPress={() => setType(tab.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.typeTabText, type === tab.key && styles.typeTabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Champ 1 : numéro de téléphone */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>NUMÉRO DE TÉLÉPHONE</Text>
          <TouchableOpacity
            activeOpacity={1}
            onPress={() => phoneInputRef.current?.focus()}
            style={[styles.dashedBoxPhone, isListening && styles.dashedBoxListening]}
          >
            {/* Badge réseau : affiche aussi le réseau choisi à la main */}
            <TouchableOpacity
              onPress={() => setShowOperatorPicker((visible) => !visible)}
              activeOpacity={0.7}
              style={[styles.operatorBadge, showGlobe ? styles.operatorBadgePlaceholder : operatorBadgeColors[operator!]]}
              accessibilityRole="button"
              accessibilityLabel="Choisir le réseau"
            >
              {showGlobe ? (
                <Globe2 size={18} color="#8E9AB4" />
              ) : (
                <Text style={[styles.operatorBadgeText, { color: operator === "MTN" ? "#000000" : "#FFFFFF" }]}>
                  {operator}
                </Text>
              )}
              <ChevronDown size={12} color={showGlobe ? "#8E9AB4" : operator === "MTN" ? "#000000" : "#FFFFFF"} />
            </TouchableOpacity>

            <Text style={styles.countryCodeText}>+229 01</Text>

            <View style={styles.phoneInputWithMic}>
              <TextInput
                ref={phoneInputRef}
                style={styles.phoneTextInput}
                value={formattedPhone}
                onChangeText={handlePhoneChange}
                keyboardType="number-pad"
                placeholder="__  __  __  __"
                placeholderTextColor="#8E9AB4"
                selectionColor="#191979"
                cursorColor="#191979"
                autoFocus
              />

              {/* Micro : dictée du numéro */}
              <TouchableOpacity
                style={[styles.micButton, isListening && styles.micButtonListening]}
                onPress={onMicPress}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={isListening ? "Arrêter la dictée" : "Dicter le numéro de téléphone"}
                accessibilityHint="Dites le numéro en français, chiffre par chiffre ou par paires"
              >
                {isListening ? (
                  <MicOff size={18} color="#EF4444" strokeWidth={2.5} />
                ) : (
                  <Mic size={18} color="#191979" strokeWidth={2.5} />
                )}
              </TouchableOpacity>
            </View>
          </TouchableOpacity>

          {isListening && <Text style={styles.speechHint}>Je vous écoute… dites le numéro</Text>}
          {!!speechError && !isListening && <Text style={styles.speechError}>{speechError}</Text>}

          {showOperatorPicker && (
            <View style={styles.operatorPicker}>
              {(["MTN", "Moov", "Celtis"] as Operator[]).map((availableOperator) => (
                <TouchableOpacity
                  key={availableOperator}
                  style={styles.operatorOption}
                  onPress={() => selectOperator(availableOperator)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.operatorOptionText}>{availableOperator}</Text>
                  {operator === availableOperator && <Check size={18} color="#191970" />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Champ 2 : montant */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>MONTANT FCFA</Text>
          <View style={styles.dashedBoxAmount}>
            <TextInput
              ref={amountInputRef}
              style={styles.amountInput}
              value={amount}
              onChangeText={handleAmountChange}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor="#8E9AB4"
              selectionColor="#191979"
              cursorColor="#191979"
            />
            <Text style={styles.currencySuffix}>FCFA</Text>
          </View>

          <View style={styles.chipsRow}>
            {amountPresets.map((val) => (
              <TouchableOpacity key={val} style={styles.chip} onPress={() => handleSelectAmount(val)} activeOpacity={0.7}>
                <Text style={styles.chipText}>{formatAmount(val)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Champ 3 : nom (optionnel) */}
        <View style={styles.fieldSection}>
          <Text style={styles.fieldLabel}>NOM PRÉNOM (OPTIONNEL)</Text>
          <View style={styles.dashedBoxName}>
            <TextInput
              style={styles.nameInput}
              value={clientName}
              onChangeText={setClientName}
              placeholderTextColor="#8E9AB4"
              autoCapitalize="words"
            />
          </View>
        </View>

        {/* Statut de paiement (Segmented control pleine largeur) */}
        <View style={styles.paySection}>
          <Text style={styles.fieldLabel}>STATUT DU PAIEMENT</Text>
          <View style={styles.paySegmentWrap}>
            <TouchableOpacity
              style={[styles.paySegmentBtn, paid && styles.paySegmentPaidActive]}
              onPress={() => {
                setPaid(true);
                void Haptics.selectionAsync();
              }}
              activeOpacity={0.85}
            >
              <CheckCircle2 size={17} color={paid ? "#FFFFFF" : "#15803D"} />
              <Text style={[styles.paySegmentText, paid ? styles.paySegmentTextActive : { color: "#15803D" }]}>
                Payé
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.paySegmentBtn, !paid && styles.paySegmentUnpaidActive]}
              onPress={() => {
                setPaid(false);
                void Haptics.selectionAsync();
              }}
              activeOpacity={0.85}
            >
              <Clock size={17} color={!paid ? "#FFFFFF" : "#DC2626"} />
              <Text style={[styles.paySegmentText, !paid ? styles.paySegmentTextActive : { color: "#DC2626" }]}>
                Non payé
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bouton principal */}
        <TouchableOpacity
          style={[styles.submitBtn, loading && { opacity: 0.75 }]}
          onPress={handleSubmit}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Check size={19} color="#FFFFFF" strokeWidth={2.6} />
          )}
          <Text style={styles.submitBtnText}>{loading ? "Enregistrement..." : "Enregistrer l'opération"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 22, backgroundColor: "#FFFFFF" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", paddingBottom: 4 },
  closeBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

  typeTabsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 16,
  },
  typeTab: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  typeTabActive: { backgroundColor: "#191979" },
  typeTabText: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: "#8E9AB4" },
  typeTabTextActive: { color: "#FFFFFF", fontFamily: "Poppins_700Bold" },

  fieldSection: { marginTop: 14 },
  fieldLabel: { fontSize: 11, fontFamily: "Poppins_700Bold", color: "#8E9AB4", letterSpacing: 0.5, marginBottom: 8 },

  dashedBoxPhone: {
    height: 58,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#BDC6D8",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  dashedBoxListening: { borderColor: "#EF4444" },

  operatorBadge: {
    flexDirection: "row",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  operatorBadgePlaceholder: { backgroundColor: "#F1F3F7" },
  operatorBadgeText: { fontSize: 11, fontFamily: "Poppins_700Bold" },

  // Menu réseau en flux normal (plus de position absolue fragile)
  operatorPicker: {
    marginTop: 8,
    alignSelf: "flex-start",
    width: 150,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E8E8F5",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  operatorOption: {
    minHeight: 44,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  operatorOptionText: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#000000" },

  countryCodeText: { fontSize: 15, fontFamily: "Poppins_700Bold", color: "#000000", marginLeft: 6, flexShrink: 0 },
  phoneInputWithMic: { flex: 1, flexDirection: "row", alignItems: "center", marginLeft: 6, minWidth: 0 },
  phoneTextInput: {
    flex: 1,
    minWidth: 0,
    height: "100%",
    fontSize: 17,
    fontFamily: "Poppins_700Bold",
    color: "#000000",
    letterSpacing: 0.5,
    paddingVertical: 0,
  },
  micButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F4F6FB",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 6,
    flexShrink: 0,
  },
  micButtonListening: { backgroundColor: "#FDE2E4", borderWidth: 1.5, borderColor: "#EF4444" },
  speechHint: { marginTop: 8, fontSize: 12, fontFamily: "Poppins_600SemiBold", color: "#191979" },
  speechError: { marginTop: 8, fontSize: 12, fontFamily: "Poppins_600SemiBold", color: "#EF4444" },

  dashedBoxAmount: {
    height: 58,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#BDC6D8",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  amountInput: { flex: 1, fontSize: 22, fontFamily: "Poppins_700Bold", color: "#000000", height: "100%" },
  currencySuffix: { fontSize: 18, fontFamily: "Poppins_700Bold", color: "#000000" },
  chipsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, gap: 4 },
  chip: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    paddingVertical: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontSize: 11.5, fontFamily: "Poppins_700Bold", color: "#191979" },

  dashedBoxName: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#BDC6D8",
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  nameInput: { fontSize: 15, fontFamily: "Poppins_500Medium", color: "#000000", height: "100%" },

  paySection: {
    marginTop: 18,
    marginBottom: 14,
  },
  paySegmentWrap: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 16,
    padding: 4,
    gap: 6,
  },
  paySegmentBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  paySegmentPaidActive: {
    backgroundColor: "#16A34A",
    shadowColor: "#16A34A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  paySegmentUnpaidActive: {
    backgroundColor: "#DC2626",
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  paySegmentText: { fontSize: 14, fontFamily: "Poppins_700Bold" },
  paySegmentTextActive: { color: "#FFFFFF" },

  submitBtn: {
    height: 56,
    backgroundColor: "#191970",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 6,
    shadowColor: "#191970",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 4,
  },
  submitBtnText: { color: "#FFFFFF", fontSize: 15, fontFamily: "Poppins_700Bold" },

  successToast: {
    backgroundColor: "#191979",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginBottom: 12,
    alignItems: "center",
  },
  successToastText: { color: "#FFFFFF", fontSize: 14, fontFamily: "Poppins_700Bold", textAlign: "center" },

  dayRequiredBanner: {
    backgroundColor: "#FDE2E4",
    borderColor: "#EF4444",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  dayRequiredText: { flex: 1, fontSize: 12, fontFamily: "Poppins_600SemiBold", color: "#EF4444" },
  dayRequiredBtn: { backgroundColor: "#191979", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  dayRequiredBtnText: { color: "#FFFFFF", fontSize: 12, fontFamily: "Poppins_600SemiBold" },
});
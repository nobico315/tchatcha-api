import { ArrowRight, RotateCcw, X } from "lucide-react-native";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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
import * as Haptics from "expo-haptics";
import { useAuth } from "@/context/AuthContext";
import { useTransactions } from "@/context/TransactionContext";
import { useColors } from "@/hooks/useColors";
import { formatAmount } from "@/utils/format";
import { emitAppEvent } from "@/utils/appEvents";

type AccountKey = "cash" | "mtn" | "moov" | "celtis";

const ACCOUNT_FIELDS: Array<{ key: AccountKey; label: string; dotColor: string }> = [
  { key: "cash", label: "Espèces", dotColor: "#16A34A" },
  { key: "mtn", label: "MTN", dotColor: "#EAB308" },
  { key: "moov", label: "Moov", dotColor: "#0EA5E9" },
  { key: "celtis", label: "Celtis", dotColor: "#10B981" },
];

export default function OuvrirJournee() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { openDay, getYesterdayClosingBalances } = useTransactions();

  const [values, setValues] = useState<Record<AccountKey, string>>({
    cash: "",
    mtn: "",
    moov: "",
    celtis: "",
  });
  const [focusedKey, setFocusedKey] = useState<AccountKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [yesterdayBalances, setYesterdayBalances] = useState<{
    cash: number;
    MTN: number;
    Moov: number;
    Celtis: number;
    total: number;
    date: string;
  } | null>(null);

  const inputRefs = useRef<Record<AccountKey, React.ComponentRef<typeof TextInput> | null>>({
    cash: null,
    mtn: null,
    moov: null,
    celtis: null,
  });

  const fmt = (n: number) => (n === 0 ? "" : n.toLocaleString("fr-FR").replace(/,/g, " "));
  const parseAmount = (value: string) => parseInt(value.replace(/\s/g, ""), 10) || 0;

  const cashAmount = parseAmount(values.cash);
  const mtnAmount = parseAmount(values.mtn);
  const moovAmount = parseAmount(values.moov);
  const celtisAmount = parseAmount(values.celtis);
  const openingTotal = cashAmount + mtnAmount + moovAmount + celtisAmount;

  useEffect(() => {
    if (!user) return;
    const yb = getYesterdayClosingBalances(user.id);
    if (yb) setYesterdayBalances(yb);
  }, [user, getYesterdayClosingBalances]);

  const handleAmountChange = (key: AccountKey, text: string) => {
    const raw = text.replace(/[^0-9]/g, "");
    const num = parseInt(raw, 10);
    setValues((prev) => ({
      ...prev,
      [key]: isNaN(num) ? "" : num.toLocaleString("fr-FR").replace(/,/g, " "),
    }));
  };

  const applyYesterday = () => {
    if (!yesterdayBalances) return;
    setValues({
      cash: fmt(yesterdayBalances.cash),
      mtn: fmt(yesterdayBalances.MTN),
      moov: fmt(yesterdayBalances.Moov),
      celtis: fmt(yesterdayBalances.Celtis),
    });
    void Haptics.selectionAsync();
  };

  const handleOpen = async () => {
    if (cashAmount < 0 || mtnAmount < 0 || moovAmount < 0 || celtisAmount < 0) {
      Alert.alert("Erreur", "Les soldes ne peuvent pas être négatifs.");
      return;
    }
    if (!user) return;

    setLoading(true);
    try {
      await openDay(user.id, {
        cash: cashAmount,
        MTN: mtnAmount,
        Moov: moovAmount,
        Celtis: celtisAmount,
      });
      emitAppEvent("day:opened", { agentId: user.id }, "success");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const topPad = Platform.OS === "web" ? 24 : insets.top;
  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 14 }]}>
        <View style={styles.headerTextWrap}>
          <Text style={[styles.title, { color: colors.text }]}>Ouvrir la journée</Text>
          <Text style={[styles.dateText, { color: colors.muted }]}>{today}</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.closeBtn}
          activeOpacity={0.7}
          accessibilityLabel="Fermer"
        >
          <X size={20} color="#475569" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 28 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Clôture précédente */}
        {yesterdayBalances && (
          <View style={styles.yesterdayCard}>
            <View style={styles.yesterdayHeader}>
              <Text style={styles.yesterdayTitle}>
                Clôture du {fmtDate(yesterdayBalances.date)}
              </Text>
              <Text style={[styles.yesterdayTotal, { color: colors.primary }]}>
                {formatAmount(yesterdayBalances.total)} FCFA
              </Text>
            </View>

            <View style={styles.yesterdayGrid}>
              <Text style={styles.yesterdayItem}>
                Espèces {formatAmount(yesterdayBalances.cash)}
              </Text>
              <Text style={styles.yesterdayItem}>
                MTN {formatAmount(yesterdayBalances.MTN)}
              </Text>
              <Text style={styles.yesterdayItem}>
                Moov {formatAmount(yesterdayBalances.Moov)}
              </Text>
              <Text style={styles.yesterdayItem}>
                Celtis {formatAmount(yesterdayBalances.Celtis)}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.reconduireBtn, { borderColor: colors.primary }]}
              onPress={applyYesterday}
              activeOpacity={0.8}
            >
              <RotateCcw size={15} color={colors.primary} />
              <Text style={[styles.reconduireText, { color: colors.primary }]}>
                Reconduire les soldes
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Carte de saisie des 4 soldes */}
        <View style={[styles.inputsCard, { backgroundColor: colors.card }]}>
          {ACCOUNT_FIELDS.map((field, idx) => {
            const isFocused = focusedKey === field.key;
            const isLast = idx === ACCOUNT_FIELDS.length - 1;
            const nextKey = !isLast ? ACCOUNT_FIELDS[idx + 1].key : null;

            return (
              <TouchableOpacity
                key={field.key}
                activeOpacity={1}
                onPress={() => inputRefs.current[field.key]?.focus()}
                style={[
                  styles.fieldRow,
                  !isLast && styles.fieldRowDivider,
                  isFocused && styles.fieldRowFocused,
                ]}
              >
                <View style={styles.fieldLeft}>
                  <View style={[styles.dot, { backgroundColor: field.dotColor }]} />
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>{field.label}</Text>
                </View>

                <View style={styles.fieldRight}>
                  <TextInput
                    ref={(el) => {
                      inputRefs.current[field.key] = el;
                    }}
                    style={[styles.fieldInput, { color: colors.primary }]}
                    value={values[field.key]}
                    onChangeText={(t) => handleAmountChange(field.key, t)}
                    onFocus={() => setFocusedKey(field.key)}
                    onBlur={() => setFocusedKey((curr) => (curr === field.key ? null : curr))}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor="#CBD5E1"
                    returnKeyType={isLast ? "done" : "next"}
                    onSubmitEditing={() => {
                      if (nextKey) inputRefs.current[nextKey]?.focus();
                    }}
                  />
                  <Text style={styles.currencySuffix}>FCFA</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Total calculé */}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total de démarrage</Text>
          <Text style={[styles.totalValue, { color: colors.text }]}>
            {formatAmount(openingTotal)} FCFA
          </Text>
        </View>

        {/* Action principale */}
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: colors.primary, opacity: loading ? 0.75 : 1 }]}
          onPress={handleOpen}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.btnText}>Ouvrir la journée</Text>
              <ArrowRight size={18} color="#FFFFFF" strokeWidth={2.4} />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  headerTextWrap: { gap: 2 },
  title: { fontSize: 20, fontFamily: "Poppins_700Bold", letterSpacing: -0.3 },
  dateText: { fontSize: 13, fontFamily: "Poppins_400Regular", textTransform: "capitalize" },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },

  scroll: { flex: 1 },
  body: { padding: 20, gap: 16 },

  yesterdayCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    padding: 16,
    gap: 12,
  },
  yesterdayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  yesterdayTitle: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: "#64748B" },
  yesterdayTotal: { fontSize: 15, fontFamily: "Poppins_700Bold" },
  yesterdayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  yesterdayItem: { fontSize: 12, fontFamily: "Poppins_500Medium", color: "#334155" },
  reconduireBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 10,
  },
  reconduireText: { fontSize: 13, fontFamily: "Poppins_600SemiBold" },

  inputsCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.04,
    shadowRadius: 14,
    elevation: 2,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    height: 64,
    backgroundColor: "#FFFFFF",
  },
  fieldRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  fieldRowFocused: {
    backgroundColor: "#F8FAFF",
  },
  fieldLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  fieldLabel: { fontSize: 15, fontFamily: "Poppins_600SemiBold" },
  fieldRight: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, justifyContent: "flex-end" },
  fieldInput: {
    minWidth: 90,
    textAlign: "right",
    fontSize: 20,
    fontFamily: "Poppins_700Bold",
    paddingVertical: 6,
  },
  currencySuffix: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: "#94A3B8" },

  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  totalLabel: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: "#64748B" },
  totalValue: { fontSize: 18, fontFamily: "Poppins_700Bold" },

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
});

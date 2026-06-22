import { User, Users, Wallet } from "lucide-react-native";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PinInput } from "@/components/PinInput";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { Role } from "@/context/AuthContext";

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

  const handleRegister = async () => {
    if (!firstName || !lastName || !phone) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs.");
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
    setLoading(true);
    const result = await register({ firstName, lastName, phone: `+229${phone}`, pin, role });
    setLoading(false);
    if (!result.success) {
      Alert.alert("Erreur", result.error);
    } else {
      router.replace("/(tabs)");
    }
  };

  const InputField = ({ label, value, onChange, keyboardType = "default", placeholder = "" }: {
    label: string; value: string; onChange: (v: string) => void;
    keyboardType?: any; placeholder?: string;
  }) => (
    <View>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
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

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <View style={styles.logoRow}>
          <Wallet size={24} color={colors.primary} />
          <Text style={[styles.logoText, { color: colors.primary }]}>Tcha-Tcha</Text>
        </View>
        <Text style={[styles.heading, { color: colors.primary }]}>Créer un compte</Text>

        <View style={styles.form}>
          <View style={styles.nameRow}>
            <View style={{ flex: 1 }}>
              <InputField label="PRÉNOM" value={firstName} onChange={setFirstName} placeholder="Kouassi" />
            </View>
            <View style={{ flex: 1 }}>
              <InputField label="NOM" value={lastName} onChange={setLastName} placeholder="Koffi" />
            </View>
          </View>

          <View>
            <Text style={[styles.label, { color: colors.muted }]}>NUMÉRO DE TÉLÉPHONE</Text>
            <View style={[styles.phoneRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <Text style={[styles.prefix, { color: colors.primary }]}>🇧🇯 +229</Text>
              <TextInput
                style={[styles.phoneInput, { color: colors.text, fontFamily: "Poppins_400Regular" }]}
                value={phone}
                onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                placeholder="XX XX XX XX"
                placeholderTextColor={colors.muted}
                maxLength={8}
              />
            </View>
          </View>

          <View>
            <Text style={[styles.label, { color: colors.muted }]}>RÔLE</Text>
            <View style={styles.roleRow}>
              {([["agent", "Agent", User], ["gerant", "Gérant", Users]] as [Role, string, any][]).map(([r, lbl, Icon]) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.roleCard, { borderColor: role === r ? colors.primary : colors.border, backgroundColor: role === r ? "#eef0ff" : colors.card }]}
                  onPress={() => setRole(r)}
                >
                  <Icon size={22} color={role === r ? colors.primary : colors.muted} />
                  <Text style={[styles.roleLabel, { color: role === r ? colors.primary : colors.muted }]}>{lbl}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ gap: 12 }}>
            <Text style={[styles.label, { color: colors.muted }]}>CRÉER UN CODE PIN</Text>
            <PinInput value={pin} onChange={setPin} />
          </View>
          <View style={{ gap: 12 }}>
            <Text style={[styles.label, { color: colors.muted }]}>CONFIRMER LE CODE PIN</Text>
            <PinInput value={confirmPin} onChange={setConfirmPin} />
          </View>

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

        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 8 }}>
          <Text style={[styles.link, { color: colors.primary, textDecorationLine: "underline" }]}>
            Déjà un compte ? Se connecter
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 8 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  logoText: { fontSize: 20, fontFamily: "Poppins_700Bold" },
  heading: { fontSize: 24, fontFamily: "Poppins_700Bold", marginBottom: 16 },
  form: { gap: 18 },
  nameRow: { flexDirection: "row", gap: 12 },
  label: { fontSize: 12, fontFamily: "Poppins_600SemiBold", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 },
  input: { height: 52, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, fontSize: 14 },
  phoneRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, height: 52, paddingHorizontal: 16, gap: 8 },
  prefix: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  phoneInput: { flex: 1, fontSize: 14, height: "100%" },
  roleRow: { flexDirection: "row", gap: 12 },
  roleCard: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 2, alignItems: "center", gap: 8 },
  roleLabel: { fontSize: 13, fontFamily: "Poppins_600SemiBold" },
  btn: { height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 15, fontFamily: "Poppins_700Bold" },
  link: { textAlign: "center", fontSize: 13, fontFamily: "Poppins_400Regular" },
});

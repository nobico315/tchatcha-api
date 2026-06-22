import { Wallet } from "lucide-react-native";
import { router } from "expo-router";
import React, { useState } from "react";
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
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function Login() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone || pin.length < 6) {
      Alert.alert("Erreur", "Veuillez saisir votre numéro et votre code PIN.");
      return;
    }
    setLoading(true);
    const result = await login(`+229${phone}`, pin);
    setLoading(false);
    if (!result.success) {
      Alert.alert("Échec de connexion", result.error);
      setPin("");
    } else {
      router.replace("/(tabs)");
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoRow}>
          <Wallet size={28} color={colors.primary} />
          <Text style={[styles.logoText, { color: colors.primary }]}>Tcha-Tcha</Text>
        </View>
        <Text style={[styles.subtitle, { color: colors.muted }]}>Connexion à votre compte</Text>

        <View style={styles.form}>
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

          <View style={{ gap: 12 }}>
            <Text style={[styles.label, { color: colors.muted }]}>CODE PIN (6 CHIFFRES)</Text>
            <PinInput value={pin} onChange={setPin} />
          </View>

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

        <TouchableOpacity onPress={() => router.push("/(auth)/forgot-pin")} style={{ marginTop: 12 }}>
          <Text style={[styles.link, { color: colors.muted }]}>Code PIN oublié ?</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/(auth)/register")} style={{ marginTop: 8 }}>
          <Text style={[styles.link, { color: colors.primary, textDecorationLine: "underline" }]}>
            Pas encore de compte ? Créer un compte
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 8 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center", marginBottom: 4 },
  logoText: { fontSize: 24, fontFamily: "Poppins_700Bold" },
  subtitle: { textAlign: "center", fontSize: 14, fontFamily: "Poppins_400Regular", marginBottom: 24 },
  form: { gap: 20 },
  label: { fontSize: 12, fontFamily: "Poppins_600SemiBold", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    height: 52,
    paddingHorizontal: 16,
    gap: 8,
  },
  prefix: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  phoneInput: { flex: 1, fontSize: 14, height: "100%" },
  btn: { height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 15, fontFamily: "Poppins_700Bold" },
  link: { textAlign: "center", fontSize: 13, fontFamily: "Poppins_400Regular" },
});

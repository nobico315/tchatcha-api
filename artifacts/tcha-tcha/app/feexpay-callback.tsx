import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { useSearchParams, router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function FeexPayCallback() {
  const { ref } = useSearchParams();
  const colors = useColors();
  const { updateUser } = useAuth();
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const verify = async () => {
      const reference = Array.isArray(ref) ? ref[0] : ref;
      if (!reference) {
        setMessage("Référence de paiement manquante.");
        setLoading(false);
        return;
      }

      try {
        const resp = await fetch(`${process.env.EXPO_PUBLIC_API_URL ?? ""}/api/feexpay/verify?ref=${encodeURIComponent(reference)}`);
        if (!resp.ok) {
          const txt = await resp.text();
          setMessage(`Erreur serveur: ${txt}`);
          setLoading(false);
          return;
        }
        const data = await resp.json();
        const paymentStatus = (data.status || data.payment_status || data.statusCode || data.reason || "").toString().toUpperCase();

        if (paymentStatus === "SUCCESSFUL" || paymentStatus === "SUCCESS") {
          const newExpiry = new Date();
          newExpiry.setDate(newExpiry.getDate() + 30);
          await updateUser({ subscriptionExpiry: newExpiry.toISOString() });
          setStatus("success");
          setMessage("Paiement confirmé. Abonnement mis à jour.");
        } else {
          setStatus("failed");
          setMessage("Paiement non confirmé. Veuillez vérifier votre compte ou réessayer.");
        }
      } catch (err) {
        setMessage("Erreur lors de la vérification du paiement.");
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [ref, updateUser]);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}> 
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.text, { color: colors.muted, marginTop: 12 }]}>Vérification du paiement...</Text>
        </View>
      ) : (
        <View style={styles.center}>
          <Text style={[styles.title, { color: status === "success" ? colors.successText : colors.error }]}>
            {status === "success" ? "Paiement réussi" : "Paiement échoué"}
          </Text>
          {message ? <Text style={[styles.text, { color: colors.muted, marginTop: 8 }]}>{message}</Text> : null}

          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.primary }]} onPress={() => router.push("/(tabs)")}>
            <Text style={[styles.btnText, { color: colors.accent }]}>Retour à l'application</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  title: { fontSize: 20, fontFamily: "Poppins_700Bold" },
  text: { fontSize: 14, fontFamily: "Poppins_400Regular", textAlign: "center" },
  btn: { marginTop: 24, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  btnText: { fontSize: 15, fontFamily: "Poppins_700Bold" },
});

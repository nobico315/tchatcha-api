import { Plus, Users, X } from "lucide-react-native";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AgentCard } from "@/components/AgentCard";
import { useAuth, User } from "@/context/AuthContext";
import { useTransactions } from "@/context/TransactionContext";
import { useColors } from "@/hooks/useColors";

export default function Equipe() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getMyAgents, addAgentByManager, attachAgentByManager } = useAuth();
  const { transactions, getBalance } = useTransactions();
  const [agents, setAgents] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isAttachMode, setIsAttachMode] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [attachPhone, setAttachPhone] = useState("");
  const [attachPin, setAttachPin] = useState("");

  const reload = () => getMyAgents().then(setAgents);

  useEffect(() => {
    reload();
  }, []);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const todayStr = new Date().toISOString().split("T")[0];

  const totalTxToday = transactions.filter(
    (t) => agents.some((a) => a.id === t.agentId) && t.createdAt.startsWith(todayStr)
  ).length;

  const resetForm = () => {
    setFirstName(""); setLastName(""); setPhone(""); setPin(""); setPinConfirm("");
    setAttachPhone(""); setAttachPin("");
    setIsAttachMode(false);
  };

  const handleAdd = async () => {
    if (!firstName.trim()) { Alert.alert("Erreur", "Saisissez le prénom."); return; }
    if (!lastName.trim()) { Alert.alert("Erreur", "Saisissez le nom."); return; }
    if (!phone.trim() || phone.length < 8) { Alert.alert("Erreur", "Numéro de téléphone invalide."); return; }
    if (pin.length < 4) { Alert.alert("Erreur", "Le PIN doit contenir au moins 4 chiffres."); return; }
    if (pin !== pinConfirm) { Alert.alert("Erreur", "Les codes PIN ne correspondent pas."); return; }

    setLoading(true);
    const result = await addAgentByManager({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: `+229${phone.trim()}`,
      pin,
    });
    setLoading(false);

    if (result.success) {
      setShowModal(false);
      resetForm();
      await reload();
    } else {
      Alert.alert("Erreur", result.error ?? "Impossible d'ajouter l'agent.");
    }
  };

  const handleAttach = async () => {
    if (!attachPhone.trim() || attachPhone.length < 8) { Alert.alert("Erreur", "Numéro de téléphone invalide."); return; }
    if (attachPin.length < 4) { Alert.alert("Erreur", "Le PIN doit contenir au moins 4 chiffres."); return; }

    setLoading(true);
    const result = await attachAgentByManager({ phone: `+229${attachPhone.trim()}`, pin: attachPin });
    setLoading(false);

    if (result.success) {
      setShowModal(false);
      resetForm();
      await reload();
      Alert.alert("Succès", "Agent existant rattaché.");
    } else {
      Alert.alert("Erreur", result.error ?? "Impossible de rattacher cet agent.");
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}>
        <Text style={[styles.heading, { color: colors.primary }]}>Mon équipe</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => setShowModal(true)}
        >
          <Plus size={18} color={colors.accent} />
          <Text style={[styles.addBtnText, { color: colors.accent }]}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        {/* Stats */}
        <View style={[styles.statsCard, { backgroundColor: colors.primary }]}>
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{agents.length}</Text>
            <Text style={styles.statLabel}>Agents</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{totalTxToday}</Text>
            <Text style={styles.statLabel}>Tx aujourd'hui</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.primary }]}>Liste des agents</Text>

        {agents.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Users size={40} color={colors.muted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Aucun agent</Text>
            <Text style={[styles.emptyText, { color: colors.muted }]}>Appuyez sur « Ajouter » pour enregistrer votre premier agent.</Text>
          </View>
        ) : (
          agents.map((a) => (
            <AgentCard
              key={a.id}
              agent={a}
              txCount={transactions.filter((t) => t.agentId === a.id && t.createdAt.startsWith(todayStr)).length}
              balance={getBalance(a.id)}
            />
          ))
        )}
      </View>

      {/* Add Agent Modal */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowModal(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 20 }]}>
            <View style={[{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 }]} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.primary }]}>Agent</Text>
              <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
                <X size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: "row", gap: 10, justifyContent: "center" }}>
              <TouchableOpacity
                style={[styles.modeBtn, isAttachMode ? styles.modeBtnInactive : styles.modeBtnActive, { borderColor: colors.primary }]}
                onPress={() => setIsAttachMode(false)}
              >
                <Text style={[styles.modeBtnText, { color: isAttachMode ? colors.muted : colors.primary }]}>Nouveau agent</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, isAttachMode ? styles.modeBtnActive : styles.modeBtnInactive, { borderColor: colors.primary }]}
                onPress={() => setIsAttachMode(true)}
              >
                <Text style={[styles.modeBtnText, { color: isAttachMode ? colors.primary : colors.muted }]}>Attacher agent</Text>
              </TouchableOpacity>
            </View>

            {isAttachMode ? (
              <>
                <View>
                  <Text style={[styles.label, { color: colors.muted }]}>TÉLÉPHONE</Text>
                  <View style={[styles.phoneRow, { backgroundColor: colors.input, borderColor: colors.border }]}> 
                    <Text style={[styles.prefix, { color: colors.primary }]}>+229</Text>
                    <TextInput
                      style={[styles.phoneInput, { color: colors.text }]}
                      value={attachPhone}
                      onChangeText={(t) => setAttachPhone(t.replace(/[^0-9]/g, ""))}
                      keyboardType="number-pad"
                      placeholder="XX XX XX XX"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                </View>
                <View>
                  <Text style={[styles.label, { color: colors.muted }]}>CODE PIN</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                    value={attachPin}
                    onChangeText={(t) => setAttachPin(t.replace(/[^0-9]/g, ""))}
                    keyboardType="number-pad"
                    secureTextEntry
                    placeholder="••••"
                    placeholderTextColor={colors.muted}
                    maxLength={6}
                  />
                </View>
                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
                  onPress={handleAttach}
                  disabled={loading}
                >
                  <Text style={[styles.submitBtnText, { color: colors.accent }]}>Rattacher un agent existant</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.formRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: colors.muted }]}>PRÉNOM</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                      value={firstName} onChangeText={setFirstName} placeholder="Kofi" placeholderTextColor={colors.muted}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: colors.muted }]}>NOM</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                      value={lastName} onChangeText={setLastName} placeholder="Atta" placeholderTextColor={colors.muted}
                    />
                  </View>
                </View>

                <View>
                  <Text style={[styles.label, { color: colors.muted }]}>TÉLÉPHONE</Text>
                  <View style={[styles.phoneRow, { backgroundColor: colors.input, borderColor: colors.border }]}> 
                    <Text style={[styles.prefix, { color: colors.primary }]}>+229</Text>
                    <TextInput
                      style={[styles.phoneInput, { color: colors.text }]}
                      value={phone}
                      onChangeText={(t) => setPhone(t.replace(/[^0-9]/g, ""))}
                      keyboardType="number-pad"
                      placeholder="XX XX XX XX"
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: colors.muted }]}>CODE PIN</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                      value={pin} onChangeText={(t) => setPin(t.replace(/[^0-9]/g, ""))}
                      keyboardType="number-pad" secureTextEntry placeholder="••••" placeholderTextColor={colors.muted} maxLength={6}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: colors.muted }]}>CONFIRMER</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                      value={pinConfirm} onChangeText={(t) => setPinConfirm(t.replace(/[^0-9]/g, ""))}
                      keyboardType="number-pad" secureTextEntry placeholder="••••" placeholderTextColor={colors.muted} maxLength={6}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
                  onPress={handleAdd}
                  disabled={loading}
                >
                  <Text style={[styles.submitBtnText, { color: colors.accent }]}> 
                    {loading ? "Enregistrement..." : "Enregistrer l'agent"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heading: { fontSize: 24, fontFamily: "Poppins_700Bold" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, minHeight: 44 },
  addBtnText: { fontSize: 14, fontFamily: "Poppins_700Bold" },
  body: { padding: 20, gap: 24 },
  statsCard: { borderRadius: 16, padding: 24, flexDirection: "row" },
  statItem: { flex: 1, alignItems: "center" },
  statVal: { color: "#FFD700", fontSize: 28, fontFamily: "Poppins_700Bold" },
  statLabel: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "Poppins_400Regular", marginTop: 4 },
  divider: { width: 1, backgroundColor: "rgba(255,255,255,0.2)" },
  sectionTitle: { fontSize: 18, fontFamily: "Poppins_700Bold" },
  empty: { borderRadius: 16, borderWidth: 1, padding: 36, alignItems: "center", gap: 14 },
  emptyTitle: { fontSize: 17, fontFamily: "Poppins_700Bold" },
  emptyText: { fontSize: 14, fontFamily: "Poppins_400Regular", textAlign: "center" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 18 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheetTitle: { fontSize: 20, fontFamily: "Poppins_700Bold" },
  formRow: { flexDirection: "row", gap: 14 },
  label: { fontSize: 12, fontFamily: "Poppins_600SemiBold", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10 },
  input: { height: 56, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, fontSize: 15, fontFamily: "Poppins_400Regular" },
  phoneRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, height: 56, paddingHorizontal: 16, gap: 10 },
  prefix: { fontSize: 15, fontFamily: "Poppins_600SemiBold" },
  phoneInput: { flex: 1, fontSize: 15, fontFamily: "Poppins_400Regular" },
  submitBtn: { height: 56, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 6 },
  submitBtnText: { fontSize: 16, fontFamily: "Poppins_700Bold" },
  modeBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, minHeight: 44, justifyContent: "center", alignItems: "center" },
  modeBtnActive: { backgroundColor: "transparent" },
  modeBtnInactive: { backgroundColor: "transparent" },
  modeBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
});

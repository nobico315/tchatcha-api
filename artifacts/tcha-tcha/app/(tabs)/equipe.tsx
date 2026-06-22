import { Plus, Users } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AgentCard } from "@/components/AgentCard";
import { useAuth, User } from "@/context/AuthContext";
import { useTransactions } from "@/context/TransactionContext";
import { useColors } from "@/hooks/useColors";

export default function Equipe() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getAgents } = useAuth();
  const { transactions, getBalance, getTodayStats } = useTransactions();
  const [agents, setAgents] = useState<User[]>([]);

  useEffect(() => {
    getAgents().then(setAgents);
  }, []);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ paddingBottom: 120 }}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}>
        <Text style={[styles.heading, { color: colors.primary }]}>Mon équipe</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            Alert.prompt(
              "Inviter un agent",
              "Entrez le numéro de téléphone de l'agent à inviter.",
              (text) => {
                if (text) Alert.alert("Invitation envoyée", `Un SMS d'invitation a été envoyé au +229${text}.`);
              },
              "plain-text",
              "",
              "number-pad"
            );
          }}
        >
          <Plus size={18} color={colors.accent} />
          <Text style={[styles.addBtnText, { color: colors.accent }]}>Inviter</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <View style={[styles.statsCard, { backgroundColor: colors.primary }]}>
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{agents.length || 3}</Text>
            <Text style={styles.statLabel}>Agents actifs</Text>
          </View>
          <View style={[styles.divider]} />
          <View style={styles.statItem}>
            <Text style={styles.statVal}>{transactions.length}</Text>
            <Text style={styles.statLabel}>Tx aujourd'hui</Text>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.primary }]}>Liste des agents</Text>

        {agents.length === 0 ? (
          <>
            {/* Demo agents */}
            {[
              { id: "d1", firstName: "Kouassi", lastName: "Koffi", phone: "+22960000001", role: "agent" as const, pin: "000000", createdAt: "", subscriptionExpiry: "" },
              { id: "d2", firstName: "Aminata", lastName: "Traoré", phone: "+22960000002", role: "agent" as const, pin: "000000", createdAt: "", subscriptionExpiry: "" },
              { id: "d3", firstName: "Ibrahim", lastName: "Diallo", phone: "+22960000003", role: "agent" as const, pin: "000000", createdAt: "", subscriptionExpiry: "" },
            ].map((a) => (
              <AgentCard key={a.id} agent={a} txCount={Math.floor(Math.random() * 20)} balance={200000 + Math.random() * 300000} />
            ))}
          </>
        ) : (
          agents.map((a) => (
            <AgentCard key={a.id} agent={a} txCount={transactions.filter((t) => t.agentId === a.id).length} balance={getBalance(a.id)} />
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heading: { fontSize: 22, fontFamily: "Poppins_700Bold" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { fontSize: 13, fontFamily: "Poppins_700Bold" },
  body: { padding: 20, gap: 20 },
  statsCard: { borderRadius: 16, padding: 20, flexDirection: "row" },
  statItem: { flex: 1, alignItems: "center" },
  statVal: { color: "#FFD700", fontSize: 24, fontFamily: "Poppins_700Bold" },
  statLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Poppins_400Regular", marginTop: 2 },
  divider: { width: 1, backgroundColor: "rgba(255,255,255,0.2)" },
  sectionTitle: { fontSize: 16, fontFamily: "Poppins_700Bold" },
});

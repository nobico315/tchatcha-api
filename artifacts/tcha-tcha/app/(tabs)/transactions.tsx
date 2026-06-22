import { Search, X } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import {
  Alert, Modal, Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Badge } from "@/components/Badge";
import { TransactionItem } from "@/components/TransactionItem";
import { useAuth } from "@/context/AuthContext";
import { Transaction, TransactionType, useTransactions } from "@/context/TransactionContext";
import { useColors } from "@/hooks/useColors";
import { formatAmount, formatDate, formatTime } from "@/utils/format";

type Filter = "all" | TransactionType;

export default function Transactions() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { transactions, deleteTransaction } = useTransactions();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Transaction | null>(null);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const matchFilter = filter === "all" || t.type === filter;
      const matchSearch = t.clientName.toLowerCase().includes(search.toLowerCase()) ||
        t.clientPhone.includes(search);
      return matchFilter && matchSearch;
    });
  }, [transactions, filter, search]);

  const handleDelete = () => {
    Alert.alert("Supprimer", "Voulez-vous vraiment supprimer cette transaction ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer", style: "destructive", onPress: async () => {
          if (selected) { await deleteTransaction(selected.id); setSelected(null); }
        }
      },
    ]);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}>
        <Text style={[styles.heading, { color: colors.primary }]}>Transactions</Text>
        <View style={[styles.searchBar, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <Search size={16} color={colors.muted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text, fontFamily: "Poppins_400Regular" }]}
            placeholder="Rechercher..."
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
          {([["all", "Tout"], ["depot", "Dépôt"], ["retrait", "Retrait"]] as [Filter, string][]).map(([f, lbl]) => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, { backgroundColor: filter === f ? colors.primary : colors.card, borderColor: filter === f ? colors.primary : colors.border }]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.chipLabel, { color: filter === f ? "#FFFFFF" : colors.muted }]}>{lbl}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.muted }]}>Aucune transaction trouvée.</Text>
          </View>
        ) : (
          filtered.map((tx) => <TransactionItem key={tx.id} item={tx} onPress={() => setSelected(tx)} />)
        )}
      </ScrollView>

      {/* Detail Bottom Sheet */}
      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setSelected(null)} />
        {selected && (
          <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Badge type={selected.type} />
              <TouchableOpacity onPress={() => setSelected(null)}>
                <X size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <View style={styles.amountRow}>
              <Text style={[styles.detailAmount, { color: selected.type === "depot" ? colors.successText : colors.dangerText }]}>
                {formatAmount(selected.amount)}
              </Text>
              <Text style={[styles.detailFcfa, { color: colors.accent }]}> FCFA</Text>
            </View>
            {[
              ["Client", selected.clientName],
              ["Téléphone", selected.clientPhone],
              ["Opérateur", selected.operator],
              ["Date", formatDate(selected.createdAt)],
              ["Heure", formatTime(selected.createdAt)],
              ...(selected.note ? [["Note", selected.note]] : []),
            ].map(([k, v]) => (
              <View key={k} style={[styles.detailRow, { borderColor: colors.border }]}>
                <Text style={[styles.detailKey, { color: colors.muted }]}>{k}</Text>
                <Text style={[styles.detailVal, { color: colors.text }]}>{v}</Text>
              </View>
            ))}
            <TouchableOpacity style={[styles.deleteBtn, { borderColor: colors.dangerText }]} onPress={handleDelete}>
              <Text style={[styles.deleteBtnText, { color: colors.dangerText }]}>Supprimer la transaction</Text>
            </TouchableOpacity>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
  heading: { fontSize: 22, fontFamily: "Poppins_700Bold" },
  searchBar: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, height: 44, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, height: "100%" },
  filtersScroll: { flexGrow: 0 },
  chip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  chipLabel: { fontSize: 13, fontFamily: "Poppins_600SemiBold" },
  list: { padding: 20, paddingBottom: 120 },
  empty: { paddingVertical: 40, alignItems: "center" },
  emptyText: { fontSize: 14, fontFamily: "Poppins_400Regular" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 16, maxHeight: "80%" },
  sheetHandle: { width: 40, height: 4, backgroundColor: "#E8E8F5", borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  amountRow: { flexDirection: "row", alignItems: "baseline" },
  detailAmount: { fontSize: 28, fontFamily: "Poppins_700Bold" },
  detailFcfa: { fontSize: 16, fontFamily: "Poppins_700Bold" },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1 },
  detailKey: { fontSize: 13, fontFamily: "Poppins_400Regular" },
  detailVal: { fontSize: 13, fontFamily: "Poppins_600SemiBold" },
  deleteBtn: { borderWidth: 1.5, borderRadius: 12, height: 48, alignItems: "center", justifyContent: "center", marginTop: 8 },
  deleteBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
});

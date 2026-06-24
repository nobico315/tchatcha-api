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
  const { transactions, deleteTransaction, updateTransaction, getTransactionLogs } = useTransactions();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editClientName, setEditClientName] = useState("");
  const [editClientPhone, setEditClientPhone] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editOperator, setEditOperator] = useState<Transaction["operator"]>("MTN");
  const [editNote, setEditNote] = useState("");

  const logs = useMemo(() => {
    return selected ? getTransactionLogs(selected.id) : [];
  }, [selected, getTransactionLogs]);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      const matchFilter = filter === "all" || t.type === filter;
      const matchSearch = t.clientName.toLowerCase().includes(search.toLowerCase()) ||
        t.clientPhone.includes(search);
      return matchFilter && matchSearch;
    });
  }, [transactions, filter, search]);

  const closeSelected = () => {
    setSelected(null);
    setIsEditing(false);
  };

  const handleDelete = () => {
    Alert.alert("Supprimer", "Voulez-vous vraiment supprimer cette transaction ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer", style: "destructive", onPress: async () => {
          if (selected) { await deleteTransaction(selected.id); closeSelected(); }
        }
      },
    ]);
  };

  const startEdit = () => {
    if (!selected) return;
    setEditClientName(selected.clientName);
    setEditClientPhone(selected.clientPhone);
    setEditAmount(selected.amount.toString());
    setEditOperator(selected.operator);
    setEditNote(selected.note ?? "");
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selected) return;
    const amountValue = parseInt(editAmount.replace(/[^0-9]/g, ""), 10);
    if (!editClientName || amountValue < 100 || !editClientPhone) {
      Alert.alert("Erreur", "Veuillez vérifier le nom du client, le téléphone et le montant.");
      return;
    }
    await updateTransaction(selected.id, {
      clientName: editClientName,
      clientPhone: editClientPhone,
      amount: amountValue,
      operator: editOperator,
      note: editNote,
    });
    setIsEditing(false);
    setSelected({ ...selected, clientName: editClientName, clientPhone: editClientPhone, amount: amountValue, operator: editOperator, note: editNote });
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
      <Modal visible={!!selected && !isEditing} transparent animationType="slide" onRequestClose={closeSelected}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeSelected} />
        {selected && (
          <ScrollView
            style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Badge type={selected.type} />
              <TouchableOpacity onPress={closeSelected}>
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
            {!isEditing ? (
              <>
                <View style={styles.actionRow}>
                  <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.primary }]} onPress={startEdit}>
                    <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>Modifier</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.deleteBtn, { borderColor: colors.dangerText, flex: 1, marginLeft: 10 }]} onPress={handleDelete}>
                    <Text style={[styles.deleteBtnText, { color: colors.dangerText }]}>Supprimer</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.editForm}>
                <Text style={[styles.editLabel, { color: colors.muted }]}>Client</Text>
                <TextInput
                  style={[styles.editInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                  value={editClientName}
                  onChangeText={setEditClientName}
                  placeholder="Nom du client"
                  placeholderTextColor={colors.muted}
                />
                <Text style={[styles.editLabel, { color: colors.muted }]}>Téléphone</Text>
                <TextInput
                  style={[styles.editInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                  value={editClientPhone}
                  onChangeText={setEditClientPhone}
                  placeholder="Téléphone"
                  placeholderTextColor={colors.muted}
                  keyboardType="phone-pad"
                />
                <Text style={[styles.editLabel, { color: colors.muted }]}>Montant</Text>
                <TextInput
                  style={[styles.editInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.primary }]}
                  value={editAmount}
                  onChangeText={(text) => setEditAmount(text.replace(/[^0-9]/g, ""))}
                  keyboardType="number-pad"
                  placeholder="Montant"
                  placeholderTextColor={colors.muted}
                />
                <Text style={[styles.editLabel, { color: colors.muted }]}>Opérateur</Text>
                <View style={styles.operatorRow}>
                  {(["MTN", "Moov", "Celtis"] as Transaction["operator"][]).map((op) => (
                    <TouchableOpacity
                      key={op}
                      style={[styles.opPill, { borderColor: editOperator === op ? colors.primary : colors.border, backgroundColor: editOperator === op ? "#eef0ff" : colors.card }]}
                      onPress={() => setEditOperator(op)}
                    >
                      <Text style={[styles.opLabel, { color: editOperator === op ? colors.primary : colors.muted }]}>{op}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.editLabel, { color: colors.muted }]}>Note</Text>
                <TextInput
                  style={[styles.editInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                  value={editNote}
                  onChangeText={setEditNote}
                  placeholder="Note (optionnel)"
                  placeholderTextColor={colors.muted}
                />
                <View style={styles.actionRow}>
                  <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.primary }]} onPress={() => setIsEditing(false)}>
                    <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>Annuler</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary, flex: 1, marginLeft: 10 }]} onPress={handleSaveEdit}>
                    <Text style={[styles.primaryBtnText, { color: colors.accent }]}>Enregistrer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {user?.role === "gerant" && logs.length > 0 && (
              <View style={styles.historySection}>
                <Text style={[styles.historyTitle, { color: colors.primary }]}>Historique</Text>
                {logs.map((log) => (
                  <View key={log.id} style={[styles.historyItem, { borderColor: colors.border }]}> 
                    <Text style={[styles.historyAction, { color: colors.text }]}>Type : {log.action}</Text>
                    <Text style={[styles.historyTime, { color: colors.muted }]}>{formatDate(log.timestamp)} {formatTime(log.timestamp)}</Text>
                    {log.changes && Object.keys(log.changes).length > 0 && (
                      <Text style={[styles.historyChange, { color: colors.muted }]}>{Object.entries(log.changes).map(([field, value]) => `${field}=${value}`).join(", ")}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </Modal>

      <Modal visible={!!selected && isEditing} transparent animationType="slide" onRequestClose={() => setIsEditing(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setIsEditing(false)} />
        {selected && (
          <ScrollView
            style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.sheetHandle} />
            <View style={[styles.sheetHeader, { justifyContent: "space-between" }]}> 
              <Text style={[styles.sheetTitle, { color: colors.primary }]}>Modifier la transaction</Text>
              <TouchableOpacity onPress={() => setIsEditing(false)}>
                <X size={22} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <View style={styles.editForm}>
              <Text style={[styles.editLabel, { color: colors.muted }]}>Client</Text>
              <TextInput
                style={[styles.editInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                value={editClientName}
                onChangeText={setEditClientName}
                placeholder="Nom du client"
                placeholderTextColor={colors.muted}
              />
              <Text style={[styles.editLabel, { color: colors.muted }]}>Téléphone</Text>
              <TextInput
                style={[styles.editInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                value={editClientPhone}
                onChangeText={setEditClientPhone}
                placeholder="Téléphone"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
              />
              <Text style={[styles.editLabel, { color: colors.muted }]}>Montant</Text>
              <TextInput
                style={[styles.editInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.primary }]}
                value={editAmount}
                onChangeText={(text) => setEditAmount(text.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                placeholder="Montant"
                placeholderTextColor={colors.muted}
              />
              <Text style={[styles.editLabel, { color: colors.muted }]}>Opérateur</Text>
              <View style={styles.operatorRow}>
                {(["MTN", "Moov", "Celtis"] as Transaction["operator"][]).map((op) => (
                  <TouchableOpacity
                    key={op}
                    style={[styles.opPill, { borderColor: editOperator === op ? colors.primary : colors.border, backgroundColor: editOperator === op ? "#eef0ff" : colors.card }]}
                    onPress={() => setEditOperator(op)}
                  >
                    <Text style={[styles.opLabel, { color: editOperator === op ? colors.primary : colors.muted }]}>{op}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.editLabel, { color: colors.muted }]}>Note</Text>
              <TextInput
                style={[styles.editInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                value={editNote}
                onChangeText={setEditNote}
                placeholder="Note (optionnel)"
                placeholderTextColor={colors.muted}
              />
              <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.primary }]} onPress={() => setIsEditing(false)}>
                  <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary, flex: 1, marginLeft: 10 }]} onPress={handleSaveEdit}>
                  <Text style={[styles.primaryBtnText, { color: colors.accent }]}>Enregistrer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
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
  detailBlock: { borderRadius: 16, backgroundColor: "rgba(0,0,0,0.02)", overflow: "hidden" },
  sheetContent: { paddingBottom: 24, gap: 16 },
  sectionTitle: { fontSize: 15, fontFamily: "Poppins_700Bold", marginBottom: 12 },
  sheetTitle: { fontSize: 18, fontFamily: "Poppins_700Bold" },
  operatorRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  opPill: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1 },
  opLabel: { fontSize: 13, fontFamily: "Poppins_600SemiBold" },
  editForm: { gap: 12 },
  editLabel: { fontSize: 12, fontFamily: "Poppins_600SemiBold", textTransform: "uppercase", letterSpacing: 0.4 },
  editInput: { width: "100%", borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 14, fontFamily: "Poppins_400Regular" },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 12, alignItems: "center" },
  primaryBtn: { flex: 1, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  primaryBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  secondaryBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  deleteBtn: { borderWidth: 1.5, borderRadius: 12, height: 48, alignItems: "center", justifyContent: "center", flex: 1 },
  deleteBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  historySection: { marginTop: 16 },
  historyTitle: { fontSize: 15, fontFamily: "Poppins_700Bold", marginBottom: 8 },
  historyItem: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 },
  historyAction: { fontSize: 13, fontFamily: "Poppins_600SemiBold" },
  historyTime: { fontSize: 12, fontFamily: "Poppins_400Regular", marginTop: 4 },
  historyChange: { fontSize: 12, fontFamily: "Poppins_400Regular", marginTop: 4 },
});

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, FlatList, KeyboardAvoidingView, Modal, Platform, RefreshControl, StyleSheet, Text,
  TextInput, TouchableOpacity, View, ScrollView
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowDownCircle, ArrowUpCircle, Calendar, ChevronDown, Clock,
  Filter, Pencil, Search, SlidersHorizontal, Trash2, X, FileText, ShoppingCart, TrendingUp, Package, CheckCircle
} from "lucide-react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { LinearGradient } from "expo-linear-gradient";

import { useAuth } from "@/context/AuthContext";
import { Transaction, TransactionType, useTransactions } from "@/context/TransactionContext";
import { TransactionItem } from "@/components/TransactionItem";

import { useColors } from "@/hooks/useColors";
import { formatAmount, formatDate, formatTime, formatShortDate } from "@/utils/format";
import { CommissionSettings, DEFAULT_COMMISSION_SETTINGS, loadCommissionSettings } from "@/utils/commission";
import { emitAppEvent } from "@/utils/appEvents";

type TypeFilter = "all" | TransactionType;
type OperatorFilter = "all" | "MTN" | "Moov" | "Celtis";
type DateFilter = "today" | "week" | "month" | "all";
type SortMode = "newest" | "oldest" | "highest" | "lowest";
type ViewTab = "all" | "dettes";

const DATE_LABELS: Record<DateFilter, string> = { today: "Aujourd'hui", week: "7 jours", month: "30 jours", all: "Tout" };
const TRANSACTION_FIELD_LABELS: Record<string, string> = {
  type: "Type",
  clientName: "Client",
  clientPhone: "Téléphone",
  amount: "Montant",
  operator: "Opérateur",
  note: "Note",
  paid: "Statut",
  savedClient: "Client enregistré",
  saleMode: "Mode de vente",
};

function formatHistoryValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "amount" && typeof value === "number") return `${formatAmount(value)} FCFA`;
  if (field === "paid" && typeof value === "boolean") return value ? "Payé" : "Non payé";
  if (field === "savedClient" && typeof value === "boolean") return value ? "Oui" : "Non";
  return String(value);
}

export default function Transactions() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { transactions, deleteTransaction, updateTransaction, getTransactionLogs, refreshTransactions } = useTransactions();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshList = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshTransactions();
      emitAppEvent("sync:completed", { source: "transactions" }, "light");
    } finally {
      setRefreshing(false);
    }
  }, [refreshTransactions]);
  const [commissionSettings, setCommissionSettings] = useState<CommissionSettings>(DEFAULT_COMMISSION_SETTINGS);

  // Onglet principal : Toutes ou Dettes
  const [activeTab, setActiveTab] = useState<ViewTab>("all");

  // Filtres
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [opFilter, setOpFilter] = useState<OperatorFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [showFilters, setShowFilters] = useState(false);

  // Detail modal
  const [selected, setSelected] = useState<Transaction | null>(null);

  // Edit modal
  const [isEditing, setIsEditing] = useState(false);
  const [editClientName, setEditClientName] = useState("");
  const [editClientPhone, setEditClientPhone] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editOperator, setEditOperator] = useState<Transaction["operator"]>("MTN");
  const [editNote, setEditNote] = useState("");
  const [statusUpdating, setStatusUpdating] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    loadCommissionSettings().then(setCommissionSettings);
  }, []);

  // ── Filtrage Date ──
  const getDateCutoff = useCallback((f: DateFilter): Date | null => {
    if (f === "all") return null;
    const d = new Date();
    if (f === "today") { d.setHours(0, 0, 0, 0); return d; }
    if (f === "week") { d.setDate(d.getDate() - 7); return d; }
    d.setDate(d.getDate() - 30);
    return d;
  }, []);

  // ── Filtrage Transactions Mobile ──
  const filteredMobile = useMemo(() => {
    const cutoff = activeTab === "dettes" ? null : getDateCutoff(dateFilter);
    const q = search.toLowerCase().trim();

    let result = transactions.filter((t) => {
      // Onglet Dettes : uniquement non payées
      if (activeTab === "dettes" && t.paid !== false) return false;
      if (typeFilter !== "all" && t.type !== typeFilter) return false;
      if (opFilter !== "all" && t.operator !== opFilter) return false;
      if (cutoff && new Date(t.createdAt) < cutoff) return false;
      if (q && !t.clientName.toLowerCase().includes(q) && !t.clientPhone.includes(q)) return false;
      return true;
    });

    result.sort((a, b) => {
      switch (sortMode) {
        case "newest": return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest": return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "highest": return b.amount - a.amount;
        case "lowest": return a.amount - b.amount;
      }
    });

    return result;
  }, [transactions, activeTab, typeFilter, opFilter, dateFilter, sortMode, search, getDateCutoff]);

  // Nombre total de dettes
  const unpaidCount = useMemo(() => {
    return transactions.filter((t) => t.paid === false).length;
  }, [transactions]);

  const totalUnpaidAmount = useMemo(() => {
    return transactions.filter((t) => t.paid === false).reduce((sum, t) => sum + t.amount, 0);
  }, [transactions]);

  // ── Statistiques Transactions Mobile ──
  const mobileStats = useMemo(() => {
    const depots = filteredMobile.filter((t) => t.type === "depot").reduce((s, t) => s + t.amount, 0);
    const retraits = filteredMobile.filter((t) => t.type === "retrait" || t.type === "recharge").reduce((s, t) => s + t.amount, 0);
    const ventes = filteredMobile.filter((t) => t.type === "vente").reduce((s, t) => s + t.amount, 0);
    return { depots, retraits, ventes, count: filteredMobile.length };
  }, [filteredMobile]);

  // ── Génération de PDF Professionnel ──
  const handleExportPDF = async () => {
    const dateRangeStr = DATE_LABELS[dateFilter];
    
    let htmlContent = `
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; padding: 20px; }
          h1 { color: #191970; font-size: 24px; margin-bottom: 5px; }
          .subtitle { color: #666; font-size: 14px; margin-bottom: 25px; }
          .summary-box { display: flex; justify-content: space-between; background: #f4f4fa; border: 1px solid #e2e2ec; border-radius: 8px; padding: 15px; margin-bottom: 25px; }
          .summary-item { text-align: center; flex: 1; }
          .summary-item h3 { font-size: 11px; text-transform: uppercase; color: #777; margin: 0 0 5px 0; }
          .summary-item p { font-size: 18px; font-weight: bold; color: #191970; margin: 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th { background: #191970; color: white; text-align: left; padding: 10px; font-size: 12px; text-transform: uppercase; }
          td { padding: 10px; border-bottom: 1px solid #eee; font-size: 12px; }
          .amount-positive { color: #1a7a4a; font-weight: bold; }
          .amount-negative { color: #c0392b; font-weight: bold; }
          .footer { text-align: center; margin-top: 40px; font-size: 11px; color: #999; }
        </style>
      </head>
      <body>
    `;

    htmlContent += `
      <h1>Rapport Mobile Money</h1>
      <div class="subtitle">Période : ${dateRangeStr} | Généré par Tcha-Tcha</div>
      <div class="summary-box">
        <div class="summary-item">
          <h3>Total Dépôts</h3>
          <p>${formatAmount(mobileStats.depots)} F</p>
        </div>
        <div class="summary-item">
          <h3>Total Retraits</h3>
          <p>${formatAmount(mobileStats.retraits)} F</p>
        </div>
        <div class="summary-item">
          <h3>Ventes Services</h3>
          <p>${formatAmount(mobileStats.ventes)} F</p>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Client</th>
            <th>Téléphone</th>
            <th>Opérateur</th>
            <th>Type</th>
            <th>Montant</th>
          </tr>
        </thead>
        <tbody>
          ${filteredMobile.map(t => `
            <tr>
              <td>${formatShortDate(t.createdAt)}</td>
              <td>${t.clientName}</td>
              <td>${t.clientPhone}</td>
              <td>${t.operator}</td>
              <td>${t.type === "depot" ? "Dépôt" : t.type === "retrait" ? "Retrait" : t.type === "vente" ? "Vente Forfait" : "Vente"}</td>
              <td class="${t.type === "depot" || t.type === "vente" ? 'amount-positive' : 'amount-negative'}">
                ${t.type === "depot" || t.type === "vente" ? "+" : "−"}${formatAmount(t.amount)} F
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;

    htmlContent += `
        <div class="footer">Tcha-Tcha Pay • Application Mobile Agent</div>
      </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Rapport Tcha-Tcha" });
    } catch (e) {
      Alert.alert("Erreur", "Impossible de générer le rapport PDF.");
    }
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
      Alert.alert("Erreur", "Vérifiez les informations.");
      return;
    }
    await updateTransaction(selected.id, { clientName: editClientName, clientPhone: editClientPhone, amount: amountValue, operator: editOperator, note: editNote });
    setIsEditing(false);
    setSelected({ ...selected, clientName: editClientName, clientPhone: editClientPhone, amount: amountValue, operator: editOperator, note: editNote });
  };

  const transactionHistory = selected
    ? getTransactionLogs(selected.id)
        .filter((log) => log.action === "edited")
        .sort((left, right) => right.timestamp.localeCompare(left.timestamp))
    : [];
  const renderTransactionHistory = () => (
    <View style={s.historySection}>
      <Text style={[s.historyHeading, { color: colors.text }]}>Historique des modifications</Text>
      {transactionHistory.length === 0 ? (
        <Text style={[s.historyEmpty, { color: colors.muted }]}>Aucune modification enregistrée.</Text>
      ) : transactionHistory.map((log) => {
        const changes = Object.entries(log.changes ?? {})
          .filter(([field]) => TRANSACTION_FIELD_LABELS[field]);
        return (
          <View key={log.id} style={[s.historyCard, { borderColor: colors.border }]}>
            <Text style={[s.historyDate, { color: colors.muted }]}>
              Modifiée le {formatDate(log.timestamp)} à {formatTime(log.timestamp)}
            </Text>
            {changes.length === 0 ? (
              <Text style={[s.historyValue, { color: colors.text }]}>Détails de la modification indisponibles.</Text>
            ) : changes.map(([field, value]) => {
              const hasPreviousAndNext = typeof value === "object"
                && value !== null
                && "before" in value
                && "after" in value;
              return (
                <Text key={field} style={[s.historyValue, { color: colors.text }]}>
                  {TRANSACTION_FIELD_LABELS[field]} : {hasPreviousAndNext
                    ? `${formatHistoryValue(field, value.before)} → ${formatHistoryValue(field, value.after)}`
                    : formatHistoryValue(field, value)}
                </Text>
              );
            })}
          </View>
        );
      })}
    </View>
  );

  const renderTxItem = useCallback(({ item }: { item: Transaction }) => {
    return <TransactionItem key={item.id} item={item} onPress={() => setSelected(item)} commissionSettings={commissionSettings} />;
  }, [commissionSettings]);


  return (
    <View style={[s.container, { backgroundColor: "#FFFFFF" }]}>
      {/* Header White */}
      <View style={[s.whiteHeader, { paddingTop: topPad + 12 }]}>
        <View style={s.headerRow}>
          <View>
            <Text style={s.headingText}>Transactions</Text>
            <Text style={s.headingSub}>Historique des opérations</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity style={s.iconBtnHeader} onPress={handleExportPDF} activeOpacity={0.7}>
              <FileText size={18} color="#000000" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.iconBtnHeader, showFilters && { backgroundColor: "#ECE8FF", borderColor: "#6366F1" }]}
              onPress={() => setShowFilters((v) => !v)}
              activeOpacity={0.7}
            >
              <SlidersHorizontal size={18} color={showFilters ? "#6366F1" : "#000000"} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Onglets : Toutes / Dettes */}
        <View style={s.segmentContainer}>
          <TouchableOpacity
            style={[s.segmentBtn, activeTab === "all" && s.segmentBtnActive]}
            onPress={() => setActiveTab("all")}
            activeOpacity={0.7}
          >
            <Text style={[s.segmentText, activeTab === "all" && s.segmentTextActive]}>
              Toutes ({transactions.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.segmentBtn, activeTab === "dettes" && s.segmentBtnActive]}
            onPress={() => setActiveTab("dettes")}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[s.segmentText, activeTab === "dettes" && s.segmentTextActive]}>
                Dettes
              </Text>
              {unpaidCount > 0 ? (
                <View style={[s.badgeDette, activeTab === "dettes" ? { backgroundColor: "#EF4444" } : { backgroundColor: "#FDE2E4" }]}>
                  <Text style={[s.badgeDetteText, activeTab === "dettes" ? { color: "#FFFFFF" } : { color: "#EF4444" }]}>
                    {unpaidCount}
                  </Text>
                </View>
              ) : (
                <Text style={[s.segmentText, activeTab === "dettes" && s.segmentTextActive]}>
                  (0)
                </Text>
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={s.searchBarWhite}>
          <Search size={18} color="#8E9AB4" />
          <TextInput
            style={s.searchInputWhite}
            placeholder={activeTab === "dettes" ? "Rechercher un débiteur..." : "Rechercher par nom..."}
            placeholderTextColor="#8E9AB4"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <X size={18} color="#8E9AB4" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filtres de recherche */}
      {showFilters && (
        <View style={[s.extFilters, { backgroundColor: "#FFFFFF", borderBottomColor: "#E8E8F5", borderBottomWidth: 1, padding: 16 }]}>
          <View style={s.filterSection}>
            <Text style={[s.filterLabel, { color: "#8E9AB4" }]}>PÉRIODE</Text>
            <View style={s.chipsRow}>
              {(["today", "week", "month", "all"] as DateFilter[]).map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[
                    s.chip,
                    dateFilter === f
                      ? { backgroundColor: "#191970", borderColor: "#191970" }
                      : { backgroundColor: "#FFFFFF", borderColor: "#E8E8F5" },
                  ]}
                  onPress={() => setDateFilter(f)}
                >
                  <Text style={[s.chipText, { color: dateFilter === f ? "#FFFFFF" : "#8E9AB4" }]}>
                    {DATE_LABELS[f]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Stats Consolidées */}
      {activeTab === "all" ? (
        <View style={[s.summaryBar, { backgroundColor: "#FFFFFF", borderColor: "#E8E8F5" }]}>
          <View style={s.summaryItem}>
            <View style={[s.summaryIconWrap, { backgroundColor: "#D8F8E6" }]}>
              <ArrowUpCircle size={18} color="#16A34A" />
            </View>
            <View>
              <Text style={[s.summarySubLabel, { color: "#8E9AB4" }]}>Total Dépôts</Text>
              <Text style={[s.summaryVal, { color: "#191970" }]}>{formatAmount(mobileStats.depots)} FCFA</Text>
            </View>
          </View>
          <View style={[s.summaryDivider, { backgroundColor: "#E8E8F5" }]} />
          <View style={s.summaryItem}>
            <View style={[s.summaryIconWrap, { backgroundColor: "#FDE2E4" }]}>
              <ArrowDownCircle size={18} color="#EF4444" />
            </View>
            <View>
              <Text style={[s.summarySubLabel, { color: "#8E9AB4" }]}>Total Retraits</Text>
              <Text style={[s.summaryVal, { color: "#191970" }]}>{formatAmount(mobileStats.retraits)} FCFA</Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={[s.summaryBar, { backgroundColor: "#FFFFFF", borderColor: "#E8E8F5" }]}>
          <View style={s.summaryItem}>
            <View style={[s.summaryIconWrap, { backgroundColor: "#FDE2E4" }]}>
              <ArrowDownCircle size={18} color="#EF4444" />
            </View>
            <View>
              <Text style={[s.summarySubLabel, { color: "#8E9AB4" }]}>Total Dettes à recouvrer</Text>
              <Text style={[s.summaryVal, { color: "#EF4444" }]}>{formatAmount(totalUnpaidAmount)} FCFA</Text>
            </View>
          </View>
          <View style={[s.summaryDivider, { backgroundColor: "#E8E8F5" }]} />
          <View style={s.summaryItem}>
            <View style={[s.summaryIconWrap, { backgroundColor: "#ECE8FF" }]}>
              <Clock size={18} color="#191970" />
            </View>
            <View>
              <Text style={[s.summarySubLabel, { color: "#8E9AB4" }]}>En attente</Text>
              <Text style={[s.summaryVal, { color: "#191970" }]}>{unpaidCount} opération{unpaidCount > 1 ? "s" : ""}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Listes */}
      <FlatList<Transaction>
        data={filteredMobile}
        keyExtractor={(item) => item.id}
        renderItem={renderTxItem}
        contentContainerStyle={s.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefreshList}
            tintColor="#191970"
            colors={["#191970"]}
          />
        }
        ListEmptyComponent={() => (
          <View style={s.empty}>
            <View style={[s.emptyIconCircle, { backgroundColor: "rgba(25,25,112,0.06)" }]}>
              <CheckCircle size={28} color={activeTab === "dettes" ? "#16A34A" : colors.primary} />
            </View>
            <Text style={[s.emptyTitle, { color: colors.text }]}>
              {activeTab === "dettes" ? "Aucune dette en cours" : "Aucune transaction"}
            </Text>
            <Text style={[s.emptyText, { color: colors.muted }]}>
              {activeTab === "dettes"
                ? "Tous vos clients ont réglé leurs opérations."
                : "Modifiez vos filtres ou enregistrez une nouvelle opération."}
            </Text>
          </View>
        )}
      />

      {/* Detail Modal Mobile */}
      <Modal visible={!!selected && !isEditing} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={s.modalContainer}>
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setSelected(null)} />
          {selected && (
          <View style={[s.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}>
            <View style={s.handle} />
            <View style={s.sheetHeader}>
              <Text style={[s.sheetTitle, { color: colors.primary }]}>Détails de la transaction</Text>
              <TouchableOpacity onPress={() => setSelected(null)}><X size={22} color={colors.muted} /></TouchableOpacity>
            </View>
            <View style={s.detailAmountRow}>
              <Text style={[s.detailAmount, { color: colors.primary }]}>{formatAmount(selected.amount)}</Text>
              <Text style={[s.detailFcfa, { color: colors.accent }]}> FCFA</Text>
            </View>
            <ScrollView style={s.detailScroll} showsVerticalScrollIndicator={false}>
              {[
                ["Client", selected.clientName],
                ["Téléphone", selected.clientPhone],
                ["Opérateur", selected.operator],
                ["Type", selected.type === "depot" ? "Dépôt" : selected.type === "retrait" ? "Retrait" : "Vente"],
                ["Date", formatDate(selected.createdAt)],
                ["Statut", selected.paid === false ? "Non payé (Dette)" : "Payé"],
                ...(selected.note ? [["Note", selected.note]] : []),
              ].map(([k, v]) => (
                <View key={k} style={[s.detailRow, { borderColor: colors.border }]}>
                  <Text style={[s.detailKey, { color: colors.muted }]}>{k}</Text>
                  <Text style={[s.detailVal, { color: colors.text }]}>{v}</Text>
                </View>
              ))}
              {renderTransactionHistory()}
            </ScrollView>
            <View style={s.actionRow}>
              {selected.paid === false && (
                <TouchableOpacity
                  style={[s.actionBtn, { backgroundColor: "#16A34A" }]}
                  onPress={async () => {
                    await updateTransaction(selected.id, { paid: true });
                    setSelected({ ...selected, paid: true });
                  }}
                >
                  <CheckCircle size={16} color="#FFFFFF" />
                  <Text style={[s.actionBtnText, { color: "#FFFFFF" }]}>Marquer payé</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.primary }]} onPress={startEdit}>
                <Pencil size={16} color="#FFFFFF" />
                <Text style={[s.actionBtnText, { color: "#FFFFFF" }]}>Modifier</Text>
              </TouchableOpacity>
            </View>
          </View>
          )}
        </View>
      </Modal>

      {/* Edit Modal Mobile */}
      <Modal visible={!!selected && isEditing} transparent animationType="slide" onRequestClose={() => setIsEditing(false)}>
        <View style={s.modalContainer}>
          <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setIsEditing(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={s.keyboardView}>
            {selected && (
              <View style={[s.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}>
                <View style={s.handle} />
                <View style={[s.sheetHeader, { justifyContent: "space-between" }]}>
                  <Text style={[s.sheetTitle, { color: colors.primary }]}>Modifier la transaction</Text>
                  <TouchableOpacity onPress={() => setIsEditing(false)} style={s.closeBtn}><X size={18} color={colors.muted} /></TouchableOpacity>
                </View>
                <ScrollView style={s.editForm} keyboardShouldPersistTaps="handled">
                  <Text style={[s.editLabel, { color: colors.muted }]}>CLIENT</Text>
                  <TextInput style={[s.editInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]} value={editClientName} onChangeText={setEditClientName} />

                  <Text style={[s.editLabel, { color: colors.muted, marginTop: 10 }]}>TÉLÉPHONE</Text>
                  <TextInput style={[s.editInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]} value={editClientPhone} onChangeText={setEditClientPhone} keyboardType="phone-pad" />

                  <Text style={[s.editLabel, { color: colors.muted, marginTop: 10 }]}>MONTANT (FCFA)</Text>
                  <TextInput style={[s.editInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.primary, fontSize: 18, fontFamily: "Poppins_700Bold" }]} value={editAmount} onChangeText={setEditAmount} keyboardType="number-pad" />

                  {renderTransactionHistory()}

                  <View style={s.editActions}>
                    <TouchableOpacity style={[s.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSaveEdit}>
                      <Text style={[s.saveBtnText, { color: "#FFFFFF" }]}>Sauvegarder</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </View>
            )}
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  gradientHeader: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    position: "relative",
    overflow: "hidden",
  },
  whiteHeader: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  headingText: { color: "#000000", fontSize: 24, fontFamily: "Poppins_700Bold", letterSpacing: -0.3 },
  headingSub: { color: "#8E9AB4", fontSize: 13, fontFamily: "Poppins_400Regular", marginTop: 2 },
  iconBtnHeader: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E8E8F5",
    alignItems: "center",
    justifyContent: "center",
  },
  searchBarWhite: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E8E8F5",
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
  },
  searchInputWhite: { flex: 1, color: "#000000", fontSize: 14, fontFamily: "Poppins_400Regular" },

  // Segmented Tabs inside Header (Toutes / Dettes)
  segmentContainer: {
    flexDirection: "row",
    backgroundColor: "#F4F6F9",
    borderRadius: 14,
    padding: 3,
    marginBottom: 12,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  segmentBtnActive: {
    backgroundColor: "#191970",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
    color: "#8E9AB4",
  },
  segmentTextActive: {
    color: "#FFFFFF",
    fontFamily: "Poppins_700Bold",
  },
  badgeDette: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 10,
    minWidth: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeDetteText: {
    fontSize: 11,
    fontFamily: "Poppins_700Bold",
  },

  // Filters
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontSize: 12, fontFamily: "Poppins_600SemiBold" },
  extFilters: { gap: 12, paddingTop: 4 },
  filterSection: { gap: 8 },
  filterLabel: { fontSize: 11, fontFamily: "Poppins_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6 },

  // Consolidated Summary Bar
  summaryBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  summaryItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  summaryIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  summarySubLabel: { fontSize: 10, fontFamily: "Poppins_400Regular", color: "#666" },
  summaryVal: { fontSize: 13, fontFamily: "Poppins_700Bold", marginTop: 1 },
  summaryDivider: { width: 1, height: 28, backgroundColor: "rgba(0,0,0,0.08)" },

  // List
  list: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 120 },
  empty: { paddingVertical: 60, alignItems: "center", gap: 10 },
  emptyIconCircle: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 16, fontFamily: "Poppins_700Bold" },
  emptyText: { fontSize: 13, fontFamily: "Poppins_400Regular", textAlign: "center", paddingHorizontal: 20 },

  // Tx Stock row item
  txCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderLeftColor: "#16a34a",
    marginBottom: 10,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  txDot: { width: 10, height: 10, borderRadius: 5 },
  txInfo: { flex: 1 },
  txName: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  txSub: { fontSize: 11, fontFamily: "Poppins_400Regular", marginTop: 2 },
  txAmount: { fontSize: 15, fontFamily: "Poppins_700Bold" },

  // Modals
  modalContainer: { flex: 1, justifyContent: "flex-end" },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.58)" },
  keyboardView: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: "82%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  handle: { width: 50, height: 5, backgroundColor: "#DDDDE8", borderRadius: 3, alignSelf: "center", marginBottom: 12 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sheetTitle: { fontSize: 18, fontFamily: "Poppins_700Bold", letterSpacing: -0.3 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(0,0,0,0.06)", alignItems: "center", justifyContent: "center" },

  // Detail
  detailScroll: { maxHeight: 420 },
  detailAmountRow: { flexDirection: "row", alignItems: "baseline", marginBottom: 8 },
  detailAmount: { fontSize: 28, fontFamily: "Poppins_700Bold" },
  detailFcfa: { fontSize: 16, fontFamily: "Poppins_700Bold" },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1 },
  detailKey: { fontSize: 13, fontFamily: "Poppins_400Regular" },
  detailVal: { fontSize: 13, fontFamily: "Poppins_600SemiBold", maxWidth: "60%", textAlign: "right" },
  historySection: { gap: 8, marginTop: 16 },
  historyHeading: { fontSize: 13, fontFamily: "Poppins_700Bold" },
  historyEmpty: { fontSize: 12, fontFamily: "Poppins_400Regular" },
  historyCard: { borderWidth: 1, borderRadius: 12, padding: 10, gap: 4 },
  historyDate: { fontSize: 11, fontFamily: "Poppins_600SemiBold", marginBottom: 2 },
  historyValue: { fontSize: 12, fontFamily: "Poppins_400Regular" },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  actionBtn: { flex: 1, height: 48, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  actionBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },

  // Edit
  editForm: { gap: 12, maxHeight: 350 },
  editLabel: { fontSize: 11, fontFamily: "Poppins_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4, opacity: 0.6 },
  editInput: { borderRadius: 16, borderWidth: 1.5, padding: 13, fontSize: 14, fontFamily: "Poppins_400Regular" },
  editActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  saveBtn: { flex: 1, height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  saveBtnText: { fontSize: 14, fontFamily: "Poppins_700Bold", letterSpacing: 0.2 },
});

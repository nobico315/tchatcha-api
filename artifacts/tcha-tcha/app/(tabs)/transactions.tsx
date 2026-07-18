import React, { useCallback, useMemo, useState } from "react";
import {
  Alert, FlatList, Modal, Platform, StyleSheet, Text,
  TextInput, TouchableOpacity, View, ScrollView
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ArrowDownCircle, ArrowUpCircle, Calendar, ChevronDown, Clock,
  Filter, Pencil, Search, SlidersHorizontal, Trash2, X, FileText, ShoppingCart, TrendingUp, Package, CheckCircle
} from "lucide-react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { useAuth } from "@/context/AuthContext";
import { Transaction, TransactionType, useTransactions } from "@/context/TransactionContext";
import { useProducts, LocalProduct, LocalProductSale } from "@/context/ProductContext";
import { useColors } from "@/hooks/useColors";
import { formatAmount, formatDate, formatTime, formatShortDate } from "@/utils/format";

type TypeFilter = "all" | TransactionType;
type OperatorFilter = "all" | "MTN" | "Moov" | "Celtis";
type DateFilter = "today" | "week" | "month" | "all";
type SortMode = "newest" | "oldest" | "highest" | "lowest";

const DATE_LABELS: Record<DateFilter, string> = { today: "Aujourd'hui", week: "7 jours", month: "30 jours", all: "Tout" };

export default function Transactions() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { transactions, deleteTransaction, updateTransaction } = useTransactions();
  const { products, sales } = useProducts();

  // Onglet principal: "mobile" (transactions standard) ou "stock" (ventes de produits physiques)
  const [activeTab, setActiveTab] = useState<"mobile" | "stock">("mobile");

  // Filtres
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [opFilter, setOpFilter] = useState<OperatorFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("today");
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

  const topPad = Platform.OS === "web" ? 67 : insets.top;

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
    const cutoff = getDateCutoff(dateFilter);
    const q = search.toLowerCase().trim();

    let result = transactions.filter((t) => {
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
  }, [transactions, typeFilter, opFilter, dateFilter, sortMode, search, getDateCutoff]);

  // Map des produits pour un lookup de prix d'achat ultra rapide
  const productsMap = useMemo(() => {
    const map = new Map<string, { purchasePrice: number; purchaseType: string }>();
    for (const p of products) {
      let pPrice = 0;
      let pType = "detail";
      if (p.description) {
        try {
          const meta = JSON.parse(p.description);
          pPrice = meta.purchasePrice || 0;
          pType = meta.purchaseType || "detail";
        } catch {}
      }
      map.set(p.id, { purchasePrice: pPrice, purchaseType: pType });
    }
    return map;
  }, [products]);

  // ── Filtrage Ventes Stock ──
  const filteredStock = useMemo(() => {
    const cutoff = getDateCutoff(dateFilter);
    const q = search.toLowerCase().trim();

    let result = sales.filter((s) => {
      if (cutoff && new Date(s.createdAt) < cutoff) return false;
      if (q && !s.productName.toLowerCase().includes(q) && !(s.barcode ?? "").includes(q)) return false;
      return true;
    });

    result.sort((a, b) => {
      switch (sortMode) {
        case "newest": return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "oldest": return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "highest": return b.totalPrice - a.totalPrice;
        case "lowest": return a.totalPrice - b.totalPrice;
      }
    });

    return result;
  }, [sales, dateFilter, search, sortMode, getDateCutoff]);

  // ── Statistiques Transactions Mobile ──
  const mobileStats = useMemo(() => {
    const depots = filteredMobile.filter((t) => t.type === "depot").reduce((s, t) => s + t.amount, 0);
    const retraits = filteredMobile.filter((t) => t.type === "retrait" || t.type === "recharge").reduce((s, t) => s + t.amount, 0);
    const ventes = filteredMobile.filter((t) => t.type === "vente").reduce((s, t) => s + t.amount, 0);
    return { depots, retraits, ventes, count: filteredMobile.length };
  }, [filteredMobile]);

  // ── Statistiques Stock & Bénéfices consolidés ──
  const stockStats = useMemo(() => {
    let totalSales = 0;
    let totalPurchases = 0;
    let itemsCount = 0;

    for (const sale of filteredStock) {
      totalSales += sale.totalPrice;
      itemsCount += sale.quantity;

      // Calculer le prix d'achat
      const meta = sale.productId ? productsMap.get(sale.productId) : null;
      const uPurchase = meta ? meta.purchasePrice : 0;
      totalPurchases += uPurchase * sale.quantity;
    }

    const netProfit = totalSales - totalPurchases;

    return {
      revenue: totalSales,
      profit: netProfit,
      itemsSold: itemsCount,
      count: filteredStock.length
    };
  }, [filteredStock, productsMap]);

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

    if (activeTab === "mobile") {
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
    } else {
      htmlContent += `
        <h1>Rapport de Vente de Stock & Bénéfices</h1>
        <div class="subtitle">Période : ${dateRangeStr} | Généré par Tcha-Tcha</div>
        <div class="summary-box">
          <div class="summary-item">
            <h3>Revenu Global</h3>
            <p>${formatAmount(stockStats.revenue)} F</p>
          </div>
          <div class="summary-item">
            <h3>Bénéfice Net</h3>
            <p style="color: #1a7a4a;">+${formatAmount(stockStats.profit)} F</p>
          </div>
          <div class="summary-item">
            <h3>Articles vendus</h3>
            <p>${stockStats.itemsSold}</p>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Produit</th>
              <th>Qté</th>
              <th>P. Achat Unitaire</th>
              <th>P. Vente Unitaire</th>
              <th>Total Vente</th>
              <th>Bénéfice</th>
            </tr>
          </thead>
          <tbody>
            ${filteredStock.map(s => {
              const meta = s.productId ? productsMap.get(s.productId) : null;
              const uPurchase = meta ? meta.purchasePrice : 0;
              const profit = s.totalPrice - (uPurchase * s.quantity);
              return `
                <tr>
                  <td>${formatShortDate(s.createdAt)}</td>
                  <td>${s.productName}</td>
                  <td>${s.quantity}</td>
                  <td>${formatAmount(uPurchase)} F</td>
                  <td>${formatAmount(s.unitPrice)} F</td>
                  <td>${formatAmount(s.totalPrice)} F</td>
                  <td class="amount-positive">+${formatAmount(profit)} F</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      `;
    }

    htmlContent += `
        <div class="footer">Tcha-Tcha Pay & Stock • Application Mobile Agent</div>
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

  const renderTxItem = useCallback(({ item }: { item: Transaction }) => {
    const isPositive = item.type === "depot" || item.type === "vente";
    return (
      <TouchableOpacity style={[s.txCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setSelected(item)} activeOpacity={0.7}>
        <View style={[s.txDot, { backgroundColor: isPositive ? colors.successText : colors.dangerText }]} />
        <View style={s.txInfo}>
          <Text style={[s.txName, { color: colors.text }]} numberOfLines={1}>{item.clientName}</Text>
          <Text style={[s.txSub, { color: colors.muted }]}>
            {item.operator} · {item.type === "depot" ? "Dépôt" : item.type === "retrait" ? "Retrait" : item.type === "vente" ? "Vente Forfait" : "Vente"} · {formatTime(item.createdAt)}
          </Text>
        </View>
        <Text style={[s.txAmount, { color: isPositive ? colors.successText : colors.dangerText }]}>
          {isPositive ? "+" : "−"}{formatAmount(item.amount)} F
        </Text>
      </TouchableOpacity>
    );
  }, [colors]);

  const renderStockItem = useCallback(({ item }: { item: LocalProductSale }) => {
    const meta = item.productId ? productsMap.get(item.productId) : null;
    const uPurchase = meta ? meta.purchasePrice : 0;
    const profit = item.totalPrice - (uPurchase * item.quantity);

    return (
      <View style={[s.txCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[s.txDot, { backgroundColor: "#1a7a4a" }]} />
        <View style={s.txInfo}>
          <Text style={[s.txName, { color: colors.text }]} numberOfLines={1}>{item.productName}</Text>
          <Text style={[s.txSub, { color: colors.muted }]}>
            Stock • {item.quantity} u × {formatAmount(item.unitPrice)} F • {formatTime(item.createdAt)}
          </Text>
          {uPurchase > 0 && (
            <Text style={{ fontSize: 10, color: "#1a7a4a", fontFamily: "Poppins_600SemiBold", marginTop: 2 }}>
              Gain net: +{formatAmount(profit)} FCFA (Achat: {formatAmount(uPurchase)} F/u)
            </Text>
          )}
        </View>
        <Text style={[s.txAmount, { color: "#1a7a4a" }]}>
          +{formatAmount(item.totalPrice)} F
        </Text>
      </View>
    );
  }, [colors, productsMap]);

  return (
    <View style={[s.container, { backgroundColor: colors.surface }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}>
        <View style={s.headerRow}>
          <Text style={[s.heading, { color: colors.primary }]}>Transactions & Stock</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity style={[s.filterToggle, { borderColor: colors.border }]} onPress={handleExportPDF}>
              <FileText size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.filterToggle, { backgroundColor: showFilters ? colors.primary : colors.card, borderColor: colors.border }]} onPress={() => setShowFilters(v => !v)}>
              <SlidersHorizontal size={16} color={showFilters ? "#fff" : colors.muted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search */}
        <View style={[s.searchBar, { backgroundColor: colors.input, borderColor: colors.border }]}>
          <Search size={16} color={colors.muted} />
          <TextInput
            style={[s.searchInput, { color: colors.text }]}
            placeholder={activeTab === "mobile" ? "Rechercher par nom..." : "Rechercher un produit..."}
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && <TouchableOpacity onPress={() => setSearch("")}><X size={16} color={colors.muted} /></TouchableOpacity>}
        </View>
      </View>

      {/* Tabs */}
      <View style={s.tabContainer}>
        <TouchableOpacity style={[s.tabButton, activeTab === "mobile" && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]} onPress={() => setActiveTab("mobile")}>
          <Text style={[s.tabText, { color: activeTab === "mobile" ? colors.primary : colors.muted }]}>Transaction Mobile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[s.tabButton, activeTab === "stock" && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]} onPress={() => setActiveTab("stock")}>
          <Text style={[s.tabText, { color: activeTab === "stock" ? colors.primary : colors.muted }]}>Ventes Stock</Text>
        </TouchableOpacity>
      </View>

      {/* Filtres de recherche */}
      {showFilters && (
        <View style={[s.extFilters, { backgroundColor: colors.background, borderBottomColor: colors.border, borderBottomWidth: 1, padding: 20 }]}>
          <View style={s.filterSection}>
            <Text style={[s.filterLabel, { color: colors.muted }]}>Période</Text>
            <View style={s.chipsRow}>
              {(["today", "week", "month", "all"] as DateFilter[]).map((f) => (
                <TouchableOpacity key={f} style={[s.chip, { backgroundColor: dateFilter === f ? colors.primary : colors.card, borderColor: colors.border }]} onPress={() => setDateFilter(f)}>
                  <Text style={[s.chipText, { color: dateFilter === f ? "#fff" : colors.muted }]}>{DATE_LABELS[f]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Stats Consolidées */}
      {activeTab === "mobile" ? (
        <View style={[s.summaryBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.summaryItem}>
            <ArrowUpCircle size={15} color={colors.successText} />
            <Text style={[s.summaryVal, { color: colors.text }]}>{formatAmount(mobileStats.depots)} F</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryItem}>
            <ArrowDownCircle size={15} color={colors.dangerText} />
            <Text style={[s.summaryVal, { color: colors.text }]}>{formatAmount(mobileStats.retraits)} F</Text>
          </View>
        </View>
      ) : (
        <View style={[s.summaryBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.summaryItem}>
            <TrendingUp size={15} color={colors.primary} />
            <Text style={[s.summaryVal, { color: colors.text }]}>Revenu: {formatAmount(stockStats.revenue)} F</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryItem}>
            <CheckCircle size={15} color="#1a7a4a" />
            <Text style={[s.summaryVal, { color: "#1a7a4a" }]}>Gain: +{formatAmount(stockStats.profit)} F</Text>
          </View>
        </View>
      )}

      {/* Listes */}
      {activeTab === "mobile" ? (
        <FlatList<Transaction>
          data={filteredMobile}
          keyExtractor={(item) => item.id}
          renderItem={renderTxItem}
          contentContainerStyle={s.list}
          ListEmptyComponent={() => (
            <View style={s.empty}>
              <Text style={[s.emptyTitle, { color: colors.text }]}>Aucun résultat</Text>
              <Text style={[s.emptyText, { color: colors.muted }]}>Modifiez vos filtres ou effectuez une nouvelle opération.</Text>
            </View>
          )}
        />
      ) : (
        <FlatList<LocalProductSale>
          data={filteredStock}
          keyExtractor={(item) => item.id}
          renderItem={renderStockItem}
          contentContainerStyle={s.list}
          ListEmptyComponent={() => (
            <View style={s.empty}>
              <Text style={[s.emptyTitle, { color: colors.text }]}>Aucun résultat</Text>
              <Text style={[s.emptyText, { color: colors.muted }]}>Modifiez vos filtres ou effectuez une nouvelle opération.</Text>
            </View>
          )}
        />
      )}

      {/* Detail Modal Mobile */}
      <Modal visible={!!selected && !isEditing} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
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
            {[
              ["Client", selected.clientName],
              ["Téléphone", selected.clientPhone],
              ["Opérateur", selected.operator],
              ["Type", selected.type === "depot" ? "Dépôt" : selected.type === "retrait" ? "Retrait" : "Vente"],
              ["Date", formatDate(selected.createdAt)],
              ...(selected.note ? [["Note", selected.note]] : []),
            ].map(([k, v]) => (
              <View key={k} style={[s.detailRow, { borderColor: colors.border }]}>
                <Text style={[s.detailKey, { color: colors.muted }]}>{k}</Text>
                <Text style={[s.detailVal, { color: colors.text }]}>{v}</Text>
              </View>
            ))}
            <View style={s.actionRow}>
              <TouchableOpacity style={[s.actionBtn, { backgroundColor: colors.primary }]} onPress={startEdit}>
                <Pencil size={16} color="#FFD700" />
                <Text style={[s.actionBtnText, { color: "#FFD700" }]}>Modifier</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>

      {/* Edit Modal Mobile */}
      <Modal visible={!!selected && isEditing} transparent animationType="slide" onRequestClose={() => setIsEditing(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setIsEditing(false)} />
        {selected && (
          <View style={[s.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}>
            <View style={s.handle} />
            <View style={[s.sheetHeader, { justifyContent: "space-between" }]}>
              <Text style={[s.sheetTitle, { color: colors.primary }]}>Modifier la transaction</Text>
              <TouchableOpacity onPress={() => setIsEditing(false)}><X size={22} color={colors.muted} /></TouchableOpacity>
            </View>
            <ScrollView style={s.editForm}>
              <Text style={[s.editLabel, { color: colors.muted }]}>CLIENT</Text>
              <TextInput style={[s.editInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]} value={editClientName} onChangeText={setEditClientName} />
              
              <Text style={[s.editLabel, { color: colors.muted, marginTop: 10 }]}>TÉLÉPHONE</Text>
              <TextInput style={[s.editInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]} value={editClientPhone} onChangeText={setEditClientPhone} keyboardType="phone-pad" />
              
              <Text style={[s.editLabel, { color: colors.muted, marginTop: 10 }]}>MONTANT (FCFA)</Text>
              <TextInput style={[s.editInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.primary, fontSize: 18, fontFamily: "Poppins_700Bold" }]} value={editAmount} onChangeText={setEditAmount} keyboardType="number-pad" />
              
              <View style={s.editActions}>
                <TouchableOpacity style={[s.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSaveEdit}>
                  <Text style={[s.saveBtnText, { color: "#FFD700" }]}>Sauvegarder</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12, gap: 10 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heading: { fontSize: 22, fontFamily: "Poppins_700Bold" },
  filterToggle: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  searchBar: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, height: 44, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, height: "100%", fontFamily: "Poppins_400Regular" },
  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: "Poppins_600SemiBold" },
  extFilters: { gap: 12, paddingTop: 4 },
  filterSection: { gap: 6 },
  filterLabel: { fontSize: 11, fontFamily: "Poppins_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },

  // Tabs
  tabContainer: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#eee" },
  tabButton: { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabText: { fontSize: 13, fontFamily: "Poppins_700Bold" },

  // Summary
  summaryBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", marginHorizontal: 20, marginTop: 10, marginBottom: 4, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1 },
  summaryItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  summaryVal: { fontSize: 13, fontFamily: "Poppins_700Bold" },
  summaryDivider: { width: 1, height: 18, backgroundColor: "#eee" },

  // List
  list: { padding: 20, paddingBottom: 120 },
  empty: { paddingVertical: 60, alignItems: "center", gap: 12 },
  emptyTitle: { fontSize: 16, fontFamily: "Poppins_700Bold" },
  emptyText: { fontSize: 13, fontFamily: "Poppins_400Regular", textAlign: "center" },

  // Tx item
  txCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8, gap: 12 },
  txDot: { width: 10, height: 10, borderRadius: 5 },
  txInfo: { flex: 1 },
  txName: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  txSub: { fontSize: 11, fontFamily: "Poppins_400Regular", marginTop: 2 },
  txAmount: { fontSize: 14, fontFamily: "Poppins_700Bold" },

  // Modals
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "82%" },
  handle: { width: 40, height: 4, backgroundColor: "#E8E8F5", borderRadius: 2, alignSelf: "center", marginBottom: 12 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sheetTitle: { fontSize: 18, fontFamily: "Poppins_700Bold" },

  // Detail
  detailAmountRow: { flexDirection: "row", alignItems: "baseline", marginBottom: 8 },
  detailAmount: { fontSize: 28, fontFamily: "Poppins_700Bold" },
  detailFcfa: { fontSize: 16, fontFamily: "Poppins_700Bold" },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1 },
  detailKey: { fontSize: 13, fontFamily: "Poppins_400Regular" },
  detailVal: { fontSize: 13, fontFamily: "Poppins_600SemiBold", maxWidth: "60%", textAlign: "right" },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  actionBtn: { flex: 1, height: 48, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  actionBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },

  // Edit
  editForm: { gap: 12, maxHeight: 350 },
  editLabel: { fontSize: 11, fontFamily: "Poppins_600SemiBold", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 },
  editInput: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 14, fontFamily: "Poppins_400Regular" },
  editActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  saveBtn: { flex: 1, height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  saveBtnText: { fontSize: 14, fontFamily: "Poppins_700Bold" },
});

import { Plus, Users, X, ArrowUpCircle, ArrowDownCircle, TrendingUp, CheckCircle, Package, FileText } from "lucide-react-native";
import { router } from "expo-router";
import React, { useEffect, useState, useMemo } from "react";
import {
  Alert, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View, FlatList
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

import { AgentCard } from "@/components/AgentCard";
import { useAuth, User } from "@/context/AuthContext";
import { useTransactions, Transaction } from "@/context/TransactionContext";
import { useProducts, LocalProductSale } from "@/context/ProductContext";
import { useColors } from "@/hooks/useColors";
import { formatAmount, formatTime, formatShortDate, formatDate } from "@/utils/format";

type AgentDetailTab = "mobile" | "stock";

export default function Equipe() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getMyAgents, addAgentByManager, attachAgentByManager } = useAuth();
  const { transactions, getBalance } = useTransactions();
  const { products, sales } = useProducts();

  const [agents, setAgents] = useState<User[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isAttachMode, setIsAttachMode] = useState(false);

  // Formulaire d'ajout
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [attachPhone, setAttachPhone] = useState("");
  const [attachPin, setAttachPin] = useState("");

  // Supervision détaillée de l'agent sélectionné
  const [selectedAgent, setSelectedAgent] = useState<User | null>(null);
  const [detailTab, setDetailTab] = useState<AgentDetailTab>("mobile");
  const [timeFilter, setTimeFilter] = useState<"today" | "week" | "month">("today");

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

  // ── Filtrage et Stats par Agent ──
  const agentCutoffDate = useMemo(() => {
    const d = new Date();
    if (timeFilter === "today") d.setHours(0, 0, 0, 0);
    else if (timeFilter === "week") d.setDate(d.getDate() - 7);
    else d.setDate(d.getDate() - 30);
    return d;
  }, [timeFilter]);

  const agentMobileTx = useMemo(() => {
    if (!selectedAgent) return [];
    return transactions.filter(
      (t) => t.agentId === selectedAgent.id && new Date(t.createdAt) >= agentCutoffDate
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [selectedAgent, transactions, agentCutoffDate]);

  const agentStockSales = useMemo(() => {
    if (!selectedAgent) return [];
    return sales.filter(
      (s) => s.agentId === selectedAgent.id && new Date(s.createdAt) >= agentCutoffDate
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [selectedAgent, sales, agentCutoffDate]);

  const productsMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      let pPrice = 0;
      if (p.description) {
        try {
          const meta = JSON.parse(p.description);
          pPrice = meta.purchasePrice || 0;
        } catch {}
      }
      map.set(p.id, pPrice);
    }
    return map;
  }, [products]);

  const agentStats = useMemo(() => {
    const depots = agentMobileTx.filter(t => t.type === "depot").reduce((s, t) => s + t.amount, 0);
    const retraits = agentMobileTx.filter(t => t.type === "retrait" || t.type === "recharge").reduce((s, t) => s + t.amount, 0);
    
    let totalSales = 0;
    let totalPurchases = 0;
    for (const sale of agentStockSales) {
      totalSales += sale.totalPrice;
      const uPurchase = sale.productId ? (productsMap.get(sale.productId) || 0) : 0;
      totalPurchases += uPurchase * sale.quantity;
    }
    const stockProfit = totalSales - totalPurchases;

    return { depots, retraits, stockSales: totalSales, stockProfit };
  }, [agentMobileTx, agentStockSales, productsMap]);

  // Export PDF individuel de l'agent
  const handleExportAgentPDF = async () => {
    if (!selectedAgent) return;
    const agentName = `${selectedAgent.firstName} ${selectedAgent.lastName}`;
    const periodStr = timeFilter === "today" ? "Aujourd'hui" : timeFilter === "week" ? "7 jours" : "30 jours";

    let html = `
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 20px; color: #333; }
          h1 { color: #191970; font-size: 22px; margin-bottom: 2px; }
          .sub { color: #666; font-size: 13px; margin-bottom: 20px; }
          .box { display: flex; justify-content: space-between; background: #f4f4fa; border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 20px; }
          .box-item { text-align: center; flex: 1; }
          .box-item h3 { font-size: 10px; text-transform: uppercase; color: #777; margin: 0 0 5px 0; }
          .box-item p { font-size: 16px; font-weight: bold; color: #191970; margin: 0; }
          h2 { font-size: 15px; color: #191970; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 25px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #191970; color: white; padding: 8px; text-align: left; font-size: 11px; }
          td { padding: 8px; border-bottom: 1px solid #eee; font-size: 11px; }
          .pos { color: #1a7a4a; font-weight: bold; }
          .neg { color: #c0392b; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Rapport d'activité Agent</h1>
        <div class="sub">Agent: ${agentName} (${selectedAgent.phone}) | Période: ${periodStr}</div>
        
        <div class="box">
          <div class="box-item">
            <h3>Dépôts (MoMo)</h3>
            <p>${formatAmount(agentStats.depots)} F</p>
          </div>
          <div class="box-item">
            <h3>Retraits (MoMo)</h3>
            <p>${formatAmount(agentStats.retraits)} F</p>
          </div>
          <div class="box-item">
            <h3>Ventes Stock</h3>
            <p>${formatAmount(agentStats.stockSales)} F</p>
          </div>
          <div class="box-item">
            <h3>Bénéfices Stock</h3>
            <p style="color:#1a7a4a;">+${formatAmount(agentStats.stockProfit)} F</p>
          </div>
        </div>

        <h2>Transactions Mobile Money</h2>
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
            ${agentMobileTx.map(t => `
              <tr>
                <td>${formatShortDate(t.createdAt)}</td>
                <td>${t.clientName}</td>
                <td>${t.clientPhone}</td>
                <td>${t.operator}</td>
                <td>${t.type === "depot" ? "Dépôt" : "Retrait"}</td>
                <td class="${t.type === 'depot' ? 'pos' : 'neg'}">${t.type === 'depot' ? '+' : '−'}${formatAmount(t.amount)} F</td>
              </tr>
            `).join("")}
          </tbody>
        </table>

        <h2>Ventes de Produits en Stock</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Produit</th>
              <th>Qté</th>
              <th>P. Unitaire</th>
              <th>Total Vente</th>
            </tr>
          </thead>
          <tbody>
            ${agentStockSales.map(s => `
              <tr>
                <td>${formatShortDate(s.createdAt)}</td>
                <td>${s.productName}</td>
                <td>${s.quantity}</td>
                <td>${formatAmount(s.unitPrice)} F</td>
                <td class="pos">+${formatAmount(s.totalPrice)} F</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: `Rapport_${agentName}` });
    } catch {
      Alert.alert("Erreur", "Impossible de générer le rapport PDF.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
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
          {/* Stats globales du gérant */}
          <View style={[styles.statsCard, { backgroundColor: colors.primary }]}>
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{agents.length}</Text>
              <Text style={styles.statLabel}>Agents rattachés</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{totalTxToday}</Text>
              <Text style={styles.statLabel}>Transactions (Aujourd'hui)</Text>
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
                onPress={() => {
                  setSelectedAgent(a);
                  setDetailTab("mobile");
                  setTimeFilter("today");
                }}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* ══ MODAL DETAIL / SUPERVISION AGENT ═════════════════════════════ */}
      <Modal visible={!!selectedAgent} transparent animationType="slide" onRequestClose={() => setSelectedAgent(null)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setSelectedAgent(null)} />
        {selectedAgent && (
          <View style={[styles.sheet, styles.sheetLarge, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
            <View style={[{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 12 }]} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={[styles.sheetTitle, { color: colors.primary }]}>
                  {selectedAgent.firstName} {selectedAgent.lastName}
                </Text>
                <Text style={{ fontSize: 12, color: colors.muted, fontFamily: "Poppins_400Regular" }}>{selectedAgent.phone}</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity style={styles.pdfBtn} onPress={handleExportAgentPDF}>
                  <FileText size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSelectedAgent(null)}><X size={22} color={colors.muted} /></TouchableOpacity>
              </View>
            </View>

            {/* Filtre de Temps */}
            <View style={styles.timeFilterRow}>
              {(["today", "week", "month"] as const).map((filter) => (
                <TouchableOpacity
                  key={filter}
                  style={[styles.timeChip, timeFilter === filter && { backgroundColor: colors.primary }]}
                  onPress={() => setTimeFilter(filter)}
                >
                  <Text style={[styles.timeChipText, { color: timeFilter === filter ? "#fff" : colors.muted }]}>
                    {filter === "today" ? "Aujourd'hui" : filter === "week" ? "7 Jours" : "30 Jours"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Onglets : Mobile Money vs Stock */}
            <View style={styles.tabBar}>
              <TouchableOpacity style={[styles.tabBtn, detailTab === "mobile" && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]} onPress={() => setDetailTab("mobile")}>
                <Text style={[styles.tabBtnText, { color: detailTab === "mobile" ? colors.primary : colors.muted }]}>Mobile Money</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabBtn, detailTab === "stock" && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]} onPress={() => setDetailTab("stock")}>
                <Text style={[styles.tabBtnText, { color: detailTab === "stock" ? colors.primary : colors.muted }]}>Ventes Stock</Text>
              </TouchableOpacity>
            </View>

            {/* Résumé des indicateurs */}
            {detailTab === "mobile" ? (
              <View style={[styles.agentMiniSummary, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.summaryCol}>
                  <ArrowUpCircle size={15} color={colors.successText} />
                  <Text style={[styles.summaryLabelVal, { color: colors.text }]}>{formatAmount(agentStats.depots)} F</Text>
                  <Text style={styles.summaryLabelDesc}>Dépôts</Text>
                </View>
                <View style={styles.colDivider} />
                <View style={styles.summaryCol}>
                  <ArrowDownCircle size={15} color={colors.dangerText} />
                  <Text style={[styles.summaryLabelVal, { color: colors.text }]}>{formatAmount(agentStats.retraits)} F</Text>
                  <Text style={styles.summaryLabelDesc}>Retraits</Text>
                </View>
              </View>
            ) : (
              <View style={[styles.agentMiniSummary, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.summaryCol}>
                  <TrendingUp size={15} color={colors.primary} />
                  <Text style={[styles.summaryLabelVal, { color: colors.text }]}>{formatAmount(agentStats.stockSales)} F</Text>
                  <Text style={styles.summaryLabelDesc}>Revenu Vente</Text>
                </View>
                <View style={styles.colDivider} />
                <View style={styles.summaryCol}>
                  <CheckCircle size={15} color="#1a7a4a" />
                  <Text style={[styles.summaryLabelVal, { color: "#1a7a4a" }]}>+{formatAmount(agentStats.stockProfit)} F</Text>
                  <Text style={styles.summaryLabelDesc}>Bénéfice Net</Text>
                </View>
              </View>
            )}

            {/* Listes d'activité de l'agent */}
            {detailTab === "mobile" ? (
              <FlatList<Transaction>
                data={agentMobileTx}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={styles.itemLeft}>
                      <Text style={[styles.itemName, { color: colors.text }]}>{item.clientName}</Text>
                      <Text style={styles.itemMeta}>{item.operator} · {item.type === "depot" ? "Dépôt" : "Retrait"} · {formatTime(item.createdAt)}</Text>
                    </View>
                    <Text style={[styles.itemAmount, { color: item.type === "depot" ? colors.successText : colors.dangerText }]}>
                      {item.type === "depot" ? "+" : "−"}{formatAmount(item.amount)} F
                    </Text>
                  </View>
                )}
                ListEmptyComponent={() => <Text style={styles.emptyTextCenter}>Aucune transaction sur cette période.</Text>}
              />
            ) : (
              <FlatList<LocalProductSale>
                data={agentStockSales}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  const uPurchase = productsMap.get(item.productId ?? "") || 0;
                  const profit = item.totalPrice - (uPurchase * item.quantity);
                  return (
                    <View style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <View style={styles.itemLeft}>
                        <Text style={[styles.itemName, { color: colors.text }]}>{item.productName}</Text>
                        <Text style={styles.itemMeta}>{item.quantity} u · PU: {formatAmount(item.unitPrice)} F · {formatShortDate(item.createdAt)}</Text>
                        {uPurchase > 0 && <Text style={styles.profitBadge}>Gain: +{formatAmount(profit)} F</Text>}
                      </View>
                      <Text style={[styles.itemAmount, { color: "#1a7a4a" }]}>+{formatAmount(item.totalPrice)} F</Text>
                    </View>
                  );
                }}
                ListEmptyComponent={() => <Text style={styles.emptyTextCenter}>Aucune vente de stock sur cette période.</Text>}
              />
            )}
          </View>
        )}
      </Modal>

      {/* ══ MODAL AJOUT / RATTACHEMENT ══════════════════════════════════ */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowModal(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 20 }]}>
            <View style={[{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 }]} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.primary }]}>Supervision Équipe</Text>
              <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}><X size={22} color={colors.muted} /></TouchableOpacity>
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
                  <Text style={[styles.submitBtnText, { color: colors.accent }]}>Rattacher l'agent</Text>
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
                    {loading ? "Enregistrement..." : "Créer l'agent"}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
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
  sheetLarge: { height: "82%" },
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

  // Supervision Detail Modals styles
  pdfBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: "#ccc", alignItems: "center", justifyContent: "center" },
  timeFilterRow: { flexDirection: "row", gap: 8, marginVertical: 4 },
  timeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#f0f0f5" },
  timeChipText: { fontSize: 12, fontFamily: "Poppins_600SemiBold" },
  tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#eee", marginTop: 8 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabBtnText: { fontSize: 13, fontFamily: "Poppins_700Bold" },
  agentMiniSummary: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, marginVertical: 8 },
  summaryCol: { flex: 1, alignItems: "center", gap: 4 },
  summaryLabelVal: { fontSize: 14, fontFamily: "Poppins_700Bold" },
  summaryLabelDesc: { fontSize: 11, color: "#666" },
  colDivider: { width: 1, height: 24, backgroundColor: "#eee" },
  
  // Item List
  itemCard: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  itemLeft: { flex: 1, gap: 2 },
  itemName: { fontSize: 13, fontFamily: "Poppins_600SemiBold" },
  itemMeta: { fontSize: 11, color: "#777" },
  itemAmount: { fontSize: 13, fontFamily: "Poppins_700Bold", alignSelf: "center", marginLeft: "auto" },
  profitBadge: { fontSize: 10, color: "#1a7a4a", fontFamily: "Poppins_600SemiBold", marginTop: 2 },
  emptyTextCenter: { textAlign: "center", color: "#888", marginTop: 30, fontSize: 13 },
});

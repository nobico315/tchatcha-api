import { Plus, Search, Users, X, ArrowUpCircle, ArrowDownCircle, TrendingUp, CheckCircle, Package, FileText, Share2, Copy } from "lucide-react-native";
import { router } from "expo-router";
import React, { useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView,
  Share, StyleSheet, Text, TextInput, TouchableOpacity, View, FlatList
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { LinearGradient } from "expo-linear-gradient";

import { AgentCard } from "@/components/AgentCard";
import { useAuth, User } from "@/context/AuthContext";
import { useTransactions, Transaction } from "@/context/TransactionContext";
import { useColors } from "@/hooks/useColors";
import { formatAmount, formatTime, formatShortDate, formatDate } from "@/utils/format";
import { normalizeBeninPhone } from "@/utils/beninPhone";

export default function Equipe() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, getMyAgents, addAgentByManager, attachAgentByManager, getManagerInviteCode } = useAuth();
  const { transactions, getBalance, getSessionBalances, getTodaySession } = useTransactions();

  const [agents, setAgents] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [agentFilter, setAgentFilter] = useState<"all" | "open" | "low" | "inactive">("all");
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isAttachMode, setIsAttachMode] = useState(false);
  const [inviteCodeData, setInviteCodeData] = useState<{ code: string; shareMessage: string } | null>(null);

  // Formulaire d'ajout
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [attachPhone, setAttachPhone] = useState("");
  const [attachPin, setAttachPin] = useState("");

  const [selectedAgent, setSelectedAgent] = useState<User | null>(null);
  const [timeFilter, setTimeFilter] = useState<"today" | "week" | "month">("today");

  const reload = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        getMyAgents().then(setAgents),
        getManagerInviteCode().then(setInviteCodeData),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const todayStr = new Date().toISOString().split("T")[0];

  const totalTxToday = transactions.filter(
    (t) => agents.some((a) => a.id === t.agentId) && t.createdAt.startsWith(todayStr)
  ).length;

  const filteredAgents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return agents.filter((a) => {
      const matchesQuery =
        !q ||
        `${a.firstName} ${a.lastName}`.toLowerCase().includes(q) ||
        a.phone.includes(q);
      if (!matchesQuery) return false;

      if (agentFilter === "all") return true;
      const sess = getTodaySession(a.id);
      const sb = getSessionBalances(a.id);
      const hasTx = transactions.some((t) => t.agentId === a.id && t.createdAt.startsWith(todayStr));
      if (agentFilter === "open") return !!sess?.isOpen;
      if (agentFilter === "low") {
        if (!sess?.isOpen) return false;
        return Math.min(sb.MTN, sb.Moov, sb.Celtis) <= 10_000 || sb.cash <= 20_000;
      }
      if (agentFilter === "inactive") return !sess?.isOpen && !hasTx;
      return true;
    });
  }, [agents, searchQuery, agentFilter, getTodaySession, getSessionBalances, transactions, todayStr]);

  const resetForm = () => {
    setFirstName(""); setLastName(""); setPhone(""); setPin(""); setPinConfirm("");
    setAttachPhone(""); setAttachPin("");
    setIsAttachMode(false);
  };

  const handleAdd = async () => {
    if (!firstName.trim()) { Alert.alert("Erreur", "Saisissez le prénom."); return; }
    if (!lastName.trim()) { Alert.alert("Erreur", "Saisissez le nom."); return; }
    const cleanDigits = normalizeBeninPhone(phone);
    if (cleanDigits.length !== 8) { Alert.alert("Erreur", "Numéro de téléphone invalide (8 chiffres après 01)."); return; }
    if (pin.length < 4) { Alert.alert("Erreur", "Le PIN doit contenir au moins 4 chiffres."); return; }
    if (pin !== pinConfirm) { Alert.alert("Erreur", "Les codes PIN ne correspondent pas."); return; }

    setLoading(true);
    const result = await addAgentByManager({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: `+22901${cleanDigits}`,
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
    const cleanDigits = normalizeBeninPhone(attachPhone);
    if (cleanDigits.length !== 8) { Alert.alert("Erreur", "Numéro de téléphone invalide (8 chiffres après 01)."); return; }
    if (attachPin.length < 4) { Alert.alert("Erreur", "Le PIN doit contenir au moins 4 chiffres."); return; }

    setLoading(true);
    const result = await attachAgentByManager({ phone: `+22901${cleanDigits}`, pin: attachPin });
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

  const agentStats = useMemo(() => {
    const depots = agentMobileTx.filter(t => t.type === "depot").reduce((s, t) => s + t.amount, 0);
    const retraits = agentMobileTx.filter(t => t.type === "retrait" || t.type === "recharge").reduce((s, t) => s + t.amount, 0);
    return { depots, retraits };
  }, [agentMobileTx]);

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
    <View style={{ flex: 1, backgroundColor: "#FFFFFF" }}>
      {/* Header White */}
      <View style={[styles.whiteHeader, { paddingTop: topPad + 12 }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Gestion Équipe</Text>
            <Text style={styles.headerSub}>Supervision & performances agents</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtnHeader}
            onPress={() => setShowModal(true)}
            activeOpacity={0.8}
          >
            <Plus size={18} color="#FFFFFF" strokeWidth={2.4} />
            <Text style={styles.addBtnTextHeader}>Ajouter</Text>
          </TouchableOpacity>
        </View>

        {/* Stats globales du gérant */}
        <View style={styles.headerStatsRow}>
          <View style={styles.headerStatPill}>
            <Users size={15} color="#191970" />
            <Text style={styles.headerStatVal}>{agents.length}</Text>
            <Text style={styles.headerStatLbl}>Agent{agents.length !== 1 ? "s" : ""}</Text>
          </View>
          <View style={styles.headerStatPill}>
            <TrendingUp size={15} color="#191970" />
            <Text style={styles.headerStatVal}>{totalTxToday}</Text>
            <Text style={styles.headerStatLbl}>Tx aujourd'hui</Text>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={reload}
            tintColor="#191970"
            colors={["#191970"]}
          />
        }
      >
        <View style={styles.body}>
          {/* Card Code d'invitation Gérant */}
          {inviteCodeData && (
            <View style={styles.inviteCard}>
              <View style={styles.inviteCardHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inviteCardTitle}>Votre code d'invitation équipe</Text>
                  <Text style={styles.inviteCardSub}>Partagez ce code à vos agents pour qu'ils rejoignent votre réseau</Text>
                </View>
                <View style={styles.inviteBadge}>
                  <Text style={styles.inviteBadgeText}>{inviteCodeData.code}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.shareBtn}
                onPress={async () => {
                  try {
                    await Share.share({
                      title: "Rejoindre mon réseau Tcha-Tcha",
                      message: inviteCodeData.shareMessage,
                    });
                  } catch {
                    Alert.alert("Code d'invitation", `${inviteCodeData.code}\n\n${inviteCodeData.shareMessage}`);
                  }
                }}
                activeOpacity={0.8}
              >
                <Share2 size={16} color="#FFFFFF" />
                <Text style={styles.shareBtnText}>Partager le code d'invitation</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Recherche & Filtres réseau */}
          {agents.length > 0 && (
            <View style={{ gap: 10 }}>
              <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Search size={16} color={colors.muted} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Rechercher un agent ou numéro..."
                  placeholderTextColor={colors.muted}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <X size={15} color={colors.muted} />
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {[
                  { key: "all" as const, label: `Tous (${agents.length})` },
                  { key: "open" as const, label: "Journée ouverte" },
                  { key: "low" as const, label: "Solde bas" },
                  { key: "inactive" as const, label: "Inactifs" },
                ].map((f) => {
                  const active = agentFilter === f.key;
                  return (
                    <TouchableOpacity
                      key={f.key}
                      onPress={() => setAgentFilter(f.key)}
                      style={[
                        styles.filterChip,
                        active && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.filterChipText, active && { color: "#FFFFFF" }]}>
                        {f.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>
              Agents de votre réseau ({filteredAgents.length})
            </Text>
          </View>

          {filteredAgents.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.emptyIconCircle, { backgroundColor: "rgba(25,25,112,0.06)" }]}>
                <Users size={32} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {agents.length === 0 ? "Aucun agent rattaché" : "Aucun agent trouvé"}
              </Text>
              <Text style={[styles.emptyText, { color: colors.muted }]}>
                {agents.length === 0
                  ? "Appuyez sur « Ajouter » pour créer ou rattacher votre premier agent."
                  : "Essayez un autre filtre ou terme de recherche."}
              </Text>
            </View>
          ) : (
            filteredAgents.map((a) => (
              <AgentCard
                key={a.id}
                agent={a}
                txCount={transactions.filter((t) => t.agentId === a.id && t.createdAt.startsWith(todayStr)).length}
                balance={getBalance(a.id)}
                onPress={() => {
                  setSelectedAgent(a);
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

            {/* Résumé des indicateurs */}
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

            {/* Liste d'activité de l'agent */}
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
          </View>
        )}
      </Modal>

      {/* ══ MODAL AJOUT / RATTACHEMENT ══════════════════════════════════ */}
      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => { setShowModal(false); resetForm(); }}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => { setShowModal(false); resetForm(); }} />
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.keyboardView}
          >
            <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 20 }]}>
              <View style={[{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 }]} />
              <View style={styles.sheetHeader}>
                <Text style={[styles.sheetTitle, { color: colors.primary }]}>Supervision Équipe</Text>
                <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }} style={styles.closeBtn}><X size={18} color={colors.muted} /></TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={{ gap: 14, paddingTop: 4 }}>
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
                        style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1, flexDirection: "row", gap: 8 }]}
                        onPress={handleAttach}
                        disabled={loading}
                      >
                        {loading && <ActivityIndicator size="small" color="#FFFFFF" />}
                        <Text style={[styles.submitBtnText, { color: "#FFFFFF" }]}>
                          {loading ? "Rattachement..." : "Rattacher l'agent"}
                        </Text>
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
                        style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1, flexDirection: "row", gap: 8 }]}
                        onPress={handleAdd}
                        disabled={loading}
                      >
                        {loading && <ActivityIndicator size="small" color="#FFFFFF" />}
                        <Text style={[styles.submitBtnText, { color: "#FFFFFF" }]}> 
                          {loading ? "Enregistrement..." : "Créer l'agent"}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  whiteHeader: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { fontSize: 24, fontFamily: "Poppins_700Bold", color: "#000000", letterSpacing: -0.3 },
  headerSub: { fontSize: 13, fontFamily: "Poppins_400Regular", color: "#8E9AB4", marginTop: 2 },
  addBtnHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "#191970",
  },
  addBtnTextHeader: { color: "#FFFFFF", fontSize: 13, fontFamily: "Poppins_700Bold" },

  headerStatsRow: { flexDirection: "row", gap: 10, marginTop: 14 },
  headerStatPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E8E8F5",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  headerStatVal: { color: "#191970", fontFamily: "Poppins_700Bold", fontSize: 14 },
  headerStatLbl: { color: "#8E9AB4", fontFamily: "Poppins_600SemiBold", fontSize: 12 },

  body: { padding: 20, gap: 16 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  sectionTitle: { fontSize: 17, fontFamily: "Poppins_700Bold" },

  empty: { borderRadius: 16, borderWidth: 1.5, padding: 36, alignItems: "center", gap: 10 },
  emptyIconCircle: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  emptyTitle: { fontSize: 17, fontFamily: "Poppins_700Bold" },
  emptyText: { fontSize: 13, fontFamily: "Poppins_400Regular", textAlign: "center" },

  overlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.58)" },
  modalContainer: { flex: 1, justifyContent: "flex-end" },
  keyboardView: { width: "100%" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    gap: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  sheetLarge: { height: "82%" },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheetTitle: { fontSize: 20, fontFamily: "Poppins_700Bold", letterSpacing: -0.3 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(0,0,0,0.06)", alignItems: "center", justifyContent: "center" },
  formRow: { flexDirection: "row", gap: 14 },
  label: { fontSize: 11, fontFamily: "Poppins_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 10, opacity: 0.6 },
  input: { height: 54, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, fontSize: 15, fontFamily: "Poppins_400Regular" },
  phoneRow: { flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: 1.5, height: 54, paddingHorizontal: 16, gap: 10 },
  prefix: { fontSize: 15, fontFamily: "Poppins_600SemiBold" },
  phoneInput: { flex: 1, fontSize: 15, fontFamily: "Poppins_400Regular" },
  submitBtn: { height: 58, borderRadius: 18, alignItems: "center", justifyContent: "center", marginTop: 6 },
  submitBtnText: { fontSize: 16, fontFamily: "Poppins_700Bold", letterSpacing: 0.2 },
  modeBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, minHeight: 44, justifyContent: "center", alignItems: "center" },
  modeBtnActive: { backgroundColor: "transparent" },
  modeBtnInactive: { backgroundColor: "transparent" },
  modeBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },

  // Supervision Detail Modals styles
  pdfBtn: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: "rgba(0,0,0,0.1)", alignItems: "center", justifyContent: "center" },
  timeFilterRow: { flexDirection: "row", gap: 8, marginVertical: 4 },
  timeChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#f0f0f5" },
  timeChipText: { fontSize: 12, fontFamily: "Poppins_600SemiBold" },
  tabBar: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#eee", marginTop: 8 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: "center" },
  tabBtnText: { fontSize: 13, fontFamily: "Poppins_700Bold" },
  agentMiniSummary: { flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1.5, marginVertical: 8 },
  summaryCol: { flex: 1, alignItems: "center", gap: 4 },
  summaryLabelVal: { fontSize: 15, fontFamily: "Poppins_700Bold" },
  summaryLabelDesc: { fontSize: 11, color: "#666", fontFamily: "Poppins_400Regular" },
  colDivider: { width: 1, height: 24, backgroundColor: "#eee" },
  
  // Item List
  itemCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 16, borderWidth: 1, borderLeftWidth: 4, borderLeftColor: "#191970", marginBottom: 8, gap: 10 },
  itemLeft: { flex: 1, gap: 2 },
  itemName: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  itemMeta: { fontSize: 11, color: "#777", fontFamily: "Poppins_400Regular" },
  itemAmount: { fontSize: 14, fontFamily: "Poppins_700Bold", alignSelf: "center", marginLeft: "auto" },
  profitBadge: { fontSize: 11, color: "#16a34a", fontFamily: "Poppins_600SemiBold", marginTop: 2 },
  emptyTextCenter: { textAlign: "center", color: "#888", marginTop: 30, fontSize: 13, fontFamily: "Poppins_400Regular" },

  // Invite Card
  inviteCard: {
    backgroundColor: "#F4F6FB",
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#D6DFEE",
    padding: 16,
    marginBottom: 8,
    gap: 12,
  },
  inviteCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  inviteCardTitle: {
    fontSize: 14,
    fontFamily: "Poppins_700Bold",
    color: "#191970",
  },
  inviteCardSub: {
    fontSize: 11.5,
    fontFamily: "Poppins_400Regular",
    color: "#6B7A99",
    marginTop: 2,
  },
  inviteBadge: {
    backgroundColor: "#191970",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  inviteBadgeText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Poppins_700Bold",
    letterSpacing: 1,
  },
  shareBtn: {
    backgroundColor: "#191970",
    height: 44,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  shareBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, fontSize: 13, fontFamily: "Poppins_400Regular" },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  filterChipText: { fontSize: 12, fontFamily: "Poppins_600SemiBold", color: "#475569" },
});

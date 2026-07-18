import { 
  BarChart3, 
  Calendar, 
  Check, 
  ChevronLeft, 
  ChevronRight, 
  Coins, 
  Download, 
  HelpCircle, 
  List, 
  Percent, 
  RefreshCw, 
  Settings, 
  TrendingUp 
} from "lucide-react-native";
import React, { useEffect, useState, useMemo } from "react";
import { 
  Alert, 
  FlatList, 
  Platform, 
  ScrollView, 
  StyleSheet, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  View 
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { CustomBarChart } from "@/components/CustomBarChart";
import { MetricCard } from "@/components/MetricCard";
import { useAuth } from "@/context/AuthContext";
import { useTransactions, Transaction } from "@/context/TransactionContext";
import { useColors } from "@/hooks/useColors";
import { exportReportToPDF } from "@/utils/pdf";
import { formatDate, formatShortDate, toISODate, formatAmount, formatTime } from "@/utils/format";
import { 
  calculateCommission, 
  loadCommissionSettings, 
  saveCommissionSettings, 
  CommissionSettings, 
  DEFAULT_COMMISSION_SETTINGS, 
  Operator 
} from "@/utils/commission";

type PeriodType = "today" | "yesterday" | "7days" | "30days" | "custom";
type TabType = "stats" | "transactions" | "settings";

export default function Rapport() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { transactions } = useTransactions();

  // Navigation and Period tabs
  const [currentTab, setCurrentTab] = useState<TabType>("stats");
  const [period, setPeriod] = useState<PeriodType>("today");
  
  // Custom Date Range States
  const [startDateStr, setStartDateStr] = useState(toISODate(new Date()));
  const [endDateStr, setEndDateStr] = useState(toISODate(new Date()));
  
  // Commission settings
  const [commSettings, setCommSettings] = useState<CommissionSettings>(DEFAULT_COMMISSION_SETTINGS);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Percentage input states (for custom percentage mode)
  const [inputs, setInputs] = useState({
    MTN_depot: "0.6",
    MTN_retrait: "0.6",
    MTN_vente: "5.0",
    Moov_depot: "0.6",
    Moov_retrait: "0.6",
    Moov_vente: "5.0",
    Celtis_depot: "0.7",
    Celtis_retrait: "0.7",
    Celtis_vente: "5.0",
  });

  // Load settings on mount
  useEffect(() => {
    async function initSettings() {
      const settings = await loadCommissionSettings();
      setCommSettings(settings);
      setInputs({
        MTN_depot: settings.MTN.depot.toString(),
        MTN_retrait: settings.MTN.retrait.toString(),
        MTN_vente: settings.MTN.vente.toString(),
        Moov_depot: settings.Moov.depot.toString(),
        Moov_retrait: settings.Moov.retrait.toString(),
        Moov_vente: settings.Moov.vente.toString(),
        Celtis_depot: settings.Celtis.depot.toString(),
        Celtis_retrait: settings.Celtis.retrait.toString(),
        Celtis_vente: settings.Celtis.vente.toString(),
      });
    }
    initSettings();
  }, []);

  // Helper to adjust custom dates by days
  const adjustDate = (target: "start" | "end", days: number) => {
    const currentStr = target === "start" ? startDateStr : endDateStr;
    const date = new Date(currentStr);
    date.setDate(date.getDate() + days);
    const newStr = toISODate(date);
    
    if (target === "start") {
      if (newStr <= endDateStr) setStartDateStr(newStr);
    } else {
      if (newStr >= startDateStr && newStr <= toISODate(new Date())) setEndDateStr(newStr);
    }
  };

  // 1. Filtered Transactions based on selected period
  const periodTransactions = useMemo(() => {
    const today = new Date();
    let start = new Date();
    let end = new Date();

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    if (period === "yesterday") {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      start = new Date(yesterday);
      start.setHours(0, 0, 0, 0);
      end = new Date(yesterday);
      end.setHours(23, 59, 59, 999);
    } else if (period === "7days") {
      const past = new Date();
      past.setDate(past.getDate() - 6);
      start = past;
      start.setHours(0, 0, 0, 0);
    } else if (period === "30days") {
      const past = new Date();
      past.setDate(past.getDate() - 29);
      start = past;
      start.setHours(0, 0, 0, 0);
    } else if (period === "custom") {
      start = new Date(startDateStr);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDateStr);
      end.setHours(23, 59, 59, 999);
    }

    return transactions.filter((tx) => {
      const txDate = new Date(tx.createdAt);
      const matchUser = user ? tx.agentId === user.id : true;
      return txDate >= start && txDate <= end && matchUser;
    });
  }, [transactions, period, startDateStr, endDateStr, user]);

  // 2. Computed Metrics & Profit
  const reportStats = useMemo(() => {
    let depots = 0;
    let retraits = 0;
    let vente = 0;
    let totalProfit = 0;

    const opBreakdown = {
      MTN: { volume: 0, count: 0, profit: 0 },
      Moov: { volume: 0, count: 0, profit: 0 },
      Celtis: { volume: 0, count: 0, profit: 0 },
    };

    periodTransactions.forEach((tx) => {
      const amount = tx.amount;
      const op = tx.operator as Operator;
      const comm = calculateCommission(tx.type, amount, op, commSettings);

      totalProfit += comm;
      if (opBreakdown[op]) {
        opBreakdown[op].volume += amount;
        opBreakdown[op].count += 1;
        opBreakdown[op].profit += comm;
      }

      if (tx.type === "depot") depots += amount;
      else if (tx.type === "retrait") retraits += amount;
      else if (tx.type === "vente") vente += amount;
    });

    return {
      depots,
      retraits,
      vente,
      soldeNet: depots - retraits,
      count: periodTransactions.length,
      totalProfit,
      opBreakdown,
    };
  }, [periodTransactions, commSettings]);

  // 3. Dynamic Chart Data (Hours or Days)
  const chartData = useMemo(() => {
    if (period === "today" || period === "yesterday") {
      // Group by hours (12 slots of 2 hours)
      return Array.from({ length: 12 }, (_, i) => {
        const h = i * 2;
        const count = periodTransactions.filter((t) => {
          const hours = new Date(t.createdAt).getHours();
          return hours >= h && hours < h + 2;
        }).length;
        return { label: `${h}h`, value: count };
      });
    } else {
      // Group by days
      const daysMap: Record<string, number> = {};
      periodTransactions.forEach((tx) => {
        const key = formatShortDate(tx.createdAt);
        daysMap[key] = (daysMap[key] || 0) + 1;
      });

      // Fill in all days in the range
      const data: { label: string; value: number }[] = [];
      const today = new Date();
      let countDays = period === "7days" ? 7 : 30;
      if (period === "custom") {
        const diffTime = Math.abs(new Date(endDateStr).getTime() - new Date(startDateStr).getTime());
        countDays = Math.min(Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1, 30);
      }

      for (let i = countDays - 1; i >= 0; i--) {
        const d = new Date();
        if (period === "custom") {
          d.setTime(new Date(endDateStr).getTime() - i * 24 * 60 * 60 * 1000);
        } else {
          d.setDate(today.getDate() - i);
        }
        const key = formatShortDate(d.toISOString());
        data.push({ label: key, value: daysMap[key] || 0 });
      }

      return data;
    }
  }, [periodTransactions, period, startDateStr, endDateStr]);

  // Formatted period label for PDF / UI
  const periodLabel = useMemo(() => {
    if (period === "today") return "Aujourd'hui";
    if (period === "yesterday") return "Hier";
    if (period === "7days") return "7 derniers jours";
    if (period === "30days") return "30 derniers jours";
    return `Du ${formatShortDate(startDateStr)} au ${formatShortDate(endDateStr)}`;
  }, [period, startDateStr, endDateStr]);

  // Handle PDF export
  const handleExportPDF = async () => {
    if (!user) {
      Alert.alert("Erreur", "Utilisateur non identifié");
      return;
    }

    await exportReportToPDF({
      agentName: `${user.firstName} ${user.lastName}`,
      periodLabel,
      stats: {
        depots: reportStats.depots,
        retraits: reportStats.retraits,
        vente: reportStats.vente,
        soldeNet: reportStats.soldeNet,
        count: reportStats.count,
      },
      commissionSettings: commSettings,
      transactions: periodTransactions.map((tx) => ({
        id: tx.id,
        type: tx.type,
        clientName: tx.clientName,
        clientPhone: tx.clientPhone,
        amount: tx.amount,
        operator: tx.operator,
        note: tx.note,
        createdAt: tx.createdAt,
      })),
    });
  };

  // Handle commission settings save
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    const updated: CommissionSettings = {
      useProgressiveGrid: commSettings.useProgressiveGrid,
      MTN: {
        depot: parseFloat(inputs.MTN_depot) || 0,
        retrait: parseFloat(inputs.MTN_retrait) || 0,
        vente: parseFloat(inputs.MTN_vente) || 0,
      },
      Moov: {
        depot: parseFloat(inputs.Moov_depot) || 0,
        retrait: parseFloat(inputs.Moov_retrait) || 0,
        vente: parseFloat(inputs.Moov_vente) || 0,
      },
      Celtis: {
        depot: parseFloat(inputs.Celtis_depot) || 0,
        retrait: parseFloat(inputs.Celtis_retrait) || 0,
        vente: parseFloat(inputs.Celtis_vente) || 0,
      },
    };

    const success = await saveCommissionSettings(updated);
    setIsSavingSettings(false);
    if (success) {
      setCommSettings(updated);
      Alert.alert("Succès", "Configurations des commissions enregistrées avec succès.");
      setCurrentTab("stats");
    } else {
      Alert.alert("Erreur", "Impossible de sauvegarder les configurations.");
    }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  // Render operator cards
  const renderOperatorCard = (op: Operator, brandColor: string, accentColor: string, textColor: string) => {
    const stats = reportStats.opBreakdown[op];
    const totalVolume = stats ? stats.volume : 0;
    const profit = stats ? stats.profit : 0;
    const count = stats ? stats.count : 0;

    return (
      <View key={op} style={[styles.opCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <View style={styles.opCardHeader}>
          <View style={[styles.opBadge, { backgroundColor: brandColor }]}>
            <Text style={[styles.opBadgeText, { color: textColor }]}>{op}</Text>
          </View>
          <Text style={[styles.opCardCount, { color: colors.muted }]}>{count} tx</Text>
        </View>
        
        <Text style={[styles.opCardLabel, { color: colors.muted }]}>Volume total</Text>
        <Text style={[styles.opCardVolume, { color: colors.text }]}>{formatAmount(totalVolume)} FCFA</Text>

        <View style={styles.opCardDivider} />
        
        <View style={styles.opCardFooter}>
          <Text style={[styles.opProfitLabel, { color: colors.muted }]}>Bénéfice</Text>
          <Text style={[styles.opProfitValue, { color: colors.successText }]}>+ {formatAmount(profit)} FCFA</Text>
        </View>
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* HEADER SECTION */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.heading, { color: colors.primary }]}>Rapports & Bénéfices</Text>
          <TouchableOpacity onPress={handleExportPDF} style={[styles.pdfBtn, { backgroundColor: colors.primary }]}>
            <Download size={16} color="#FFFFFF" />
            <Text style={styles.pdfBtnText}>PDF</Text>
          </TouchableOpacity>
        </View>

        {/* Period Selector Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodTabsContainer}>
          {(["today", "yesterday", "7days", "30days", "custom"] as const).map((p) => (
            <TouchableOpacity 
              key={p} 
              onPress={() => setPeriod(p)}
              style={[
                styles.periodTab, 
                period === p && { backgroundColor: colors.primary, borderColor: colors.primary }
              ]}
            >
              <Text style={[styles.periodTabText, { color: period === p ? "#FFFFFF" : colors.muted }]}>
                {p === "today" && "Aujourd'hui"}
                {p === "yesterday" && "Hier"}
                {p === "7days" && "7J"}
                {p === "30days" && "30J"}
                {p === "custom" && "Perso"}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Custom Range Picker */}
        {period === "custom" && (
          <View style={[styles.customRangeContainer, { borderColor: colors.border }]}>
            <View style={styles.datePickerCol}>
              <Text style={[styles.datePickerLabel, { color: colors.muted }]}>Début</Text>
              <View style={styles.dateSelectorRow}>
                <TouchableOpacity onPress={() => adjustDate("start", -1)} style={[styles.arrowBtn, { borderColor: colors.border }]}>
                  <ChevronLeft size={16} color={colors.primary} />
                </TouchableOpacity>
                <TextInput
                  style={[styles.dateInput, { color: colors.text, borderColor: colors.border }]}
                  value={startDateStr}
                  onChangeText={setStartDateStr}
                  placeholder="YYYY-MM-DD"
                  maxLength={10}
                />
                <TouchableOpacity onPress={() => adjustDate("start", 1)} style={[styles.arrowBtn, { borderColor: colors.border }]}>
                  <ChevronRight size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.datePickerCol}>
              <Text style={[styles.datePickerLabel, { color: colors.muted }]}>Fin</Text>
              <View style={styles.dateSelectorRow}>
                <TouchableOpacity onPress={() => adjustDate("end", -1)} style={[styles.arrowBtn, { borderColor: colors.border }]}>
                  <ChevronLeft size={16} color={colors.primary} />
                </TouchableOpacity>
                <TextInput
                  style={[styles.dateInput, { color: colors.text, borderColor: colors.border }]}
                  value={endDateStr}
                  onChangeText={setEndDateStr}
                  placeholder="YYYY-MM-DD"
                  maxLength={10}
                />
                <TouchableOpacity onPress={() => adjustDate("end", 1)} style={[styles.arrowBtn, { borderColor: colors.border }]}>
                  <ChevronRight size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Navigation Tabs (Stats, Transactions, Settings) */}
        <View style={styles.navTabs}>
          <TouchableOpacity 
            onPress={() => setCurrentTab("stats")} 
            style={[styles.navTab, currentTab === "stats" && [styles.navTabActive, { borderBottomColor: colors.primary }]]}
          >
            <BarChart3 size={18} color={currentTab === "stats" ? colors.primary : colors.muted} />
            <Text style={[styles.navTabText, { color: currentTab === "stats" ? colors.primary : colors.muted }]}>Stats</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setCurrentTab("transactions")} 
            style={[styles.navTab, currentTab === "transactions" && [styles.navTabActive, { borderBottomColor: colors.primary }]]}
          >
            <List size={18} color={currentTab === "transactions" ? colors.primary : colors.muted} />
            <Text style={[styles.navTabText, { color: currentTab === "transactions" ? colors.primary : colors.muted }]}>Détails</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setCurrentTab("settings")} 
            style={[styles.navTab, currentTab === "settings" && [styles.navTabActive, { borderBottomColor: colors.primary }]]}
          >
            <Settings size={18} color={currentTab === "settings" ? colors.primary : colors.muted} />
            <Text style={[styles.navTabText, { color: currentTab === "settings" ? colors.primary : colors.muted }]}>Réglages</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* TAB CONTENT */}
      {currentTab === "stats" && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {/* Main Profit Card (Gold Gradient) */}
          <LinearGradient colors={["#191970", "#0B0B3F"]} style={styles.profitBanner}>
            <View style={styles.profitBannerHeader}>
              <View style={styles.profitIconWrapper}>
                <Coins size={22} color="#FFD700" />
              </View>
              <Text style={styles.profitBannerLabel}>Bénéfice estimé ({periodLabel})</Text>
            </View>
            <Text style={styles.profitBannerValue}>+ {formatAmount(reportStats.totalProfit)} FCFA</Text>
            <View style={styles.profitBannerFooter}>
              <Text style={styles.profitBannerSub}>{reportStats.count} transaction{reportStats.count > 1 ? "s" : ""} réalisée{reportStats.count > 1 ? "s" : ""}</Text>
            </View>
          </LinearGradient>

          {/* Metric Cards Grid */}
          <View style={styles.metricsGrid}>
            <View style={styles.metricsRow}>
              <MetricCard label="Total dépôts" value={reportStats.depots} isCurrency bg={colors.successBg} textColor={colors.successText} />
              <MetricCard label="Total retraits" value={reportStats.retraits} isCurrency bg={colors.dangerBg} textColor={colors.dangerText} />
            </View>
            <View style={styles.metricsRow}>
              <MetricCard label="Ventes crédit" value={reportStats.vente} isCurrency bg="rgba(25, 25, 112, 0.05)" textColor={colors.primary} />
              <MetricCard label="Transactions" value={reportStats.count} bg={colors.surface} textColor={colors.text} />
            </View>
          </View>

          {/* SIM Cards Breakdown Section */}
          <View style={styles.sectionContainer}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Bénéfices par carte SIM</Text>
            <View style={styles.opGrid}>
              {renderOperatorCard("MTN", "#FFC80A", "rgba(255,200,10,0.18)", "#000000")}
              {renderOperatorCard("Moov", "#00C3FF", "rgba(0,195,255,0.15)", "#FFFFFF")}
              {renderOperatorCard("Celtis", "#64FF96", "rgba(100,255,150,0.15)", "#000000")}
            </View>
          </View>

          {/* Activity Chart */}
          <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.chartHeader}>
              <TrendingUp size={18} color={colors.primary} />
              <Text style={[styles.chartTitle, { color: colors.primary }]}>
                {period === "today" || period === "yesterday" ? "Transactions par heure" : "Transactions par jour"}
              </Text>
            </View>
            <CustomBarChart data={chartData} height={165} />
          </View>
        </ScrollView>
      )}

      {currentTab === "transactions" && (
        <View style={{ flex: 1 }}>
          <FlatList
            data={periodTransactions}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.txListContainer}
            ListEmptyComponent={
              <View style={[styles.empty, { borderColor: colors.border }]}>
                <Calendar size={40} color={colors.muted} style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyText, { color: colors.muted }]}>Aucune transaction sur cette période.</Text>
              </View>
            }
            renderItem={({ item }) => {
              const comm = calculateCommission(item.type, item.amount, item.operator, commSettings);
              let badgeBg = "rgba(76, 175, 80, 0.1)";
              let badgeColor = "#4CAF50";
              
              if (item.type === "retrait") {
                badgeBg = "rgba(244, 67, 54, 0.1)";
                badgeColor = "#F44336";
              } else if (item.type === "vente") {
                badgeBg = "rgba(25, 25, 112, 0.1)";
                badgeColor = "#191970";
              }

              return (
                <View style={[styles.txItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.txItemLeft}>
                    <View style={[styles.txTypeBadge, { backgroundColor: badgeBg }]}>
                      <Text style={[styles.txTypeBadgeText, { color: badgeColor }]}>
                        {item.type === "depot" && "D"}
                        {item.type === "retrait" && "R"}
                        {item.type === "vente" && "V"}
                      </Text>
                    </View>
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={[styles.txClientName, { color: colors.text }]} numberOfLines={1}>
                        {item.clientName || "Client inconnu"}
                      </Text>
                      <Text style={[styles.txMetaText, { color: colors.muted }]}>
                        {formatTime(item.createdAt)} • {item.operator}
                      </Text>
                    </View>
                  </View>

                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.txAmount, { color: colors.text }]}>
                      {formatAmount(item.amount)} FCFA
                    </Text>
                    <Text style={[styles.txCommission, { color: colors.successText }]}>
                      + {formatAmount(comm)} FCFA
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        </View>
      )}

      {currentTab === "settings" && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          {/* Calculation Mode Panel */}
          <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.settingsCardTitle, { color: colors.text }]}>Mode de calcul des commissions</Text>
            <Text style={[styles.settingsCardDesc, { color: colors.muted }]}>
              Choisissez comment l'application doit estimer vos bénéfices pour chaque transaction.
            </Text>

            <View style={styles.toggleContainer}>
              <TouchableOpacity 
                style={[
                  styles.toggleBtn, 
                  commSettings.useProgressiveGrid && [styles.toggleBtnActive, { backgroundColor: colors.primary }]
                ]}
                onPress={() => setCommSettings({ ...commSettings, useProgressiveGrid: true })}
              >
                <TrendingUp size={16} color={commSettings.useProgressiveGrid ? "#FFFFFF" : colors.muted} />
                <Text style={[styles.toggleBtnText, { color: commSettings.useProgressiveGrid ? "#FFFFFF" : colors.muted }]}>
                  Grille progressive
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.toggleBtn, 
                  !commSettings.useProgressiveGrid && [styles.toggleBtnActive, { backgroundColor: colors.primary }]
                ]}
                onPress={() => setCommSettings({ ...commSettings, useProgressiveGrid: false })}
              >
                <Percent size={16} color={!commSettings.useProgressiveGrid ? "#FFFFFF" : colors.muted} />
                <Text style={[styles.toggleBtnText, { color: !commSettings.useProgressiveGrid ? "#FFFFFF" : colors.muted }]}>
                  Pourcentage fixe
                </Text>
              </TouchableOpacity>
            </View>

            {commSettings.useProgressiveGrid ? (
              <View style={[styles.infoBox, { backgroundColor: "rgba(25, 25, 112, 0.04)" }]}>
                <HelpCircle size={16} color={colors.primary} />
                <Text style={[styles.infoBoxText, { color: colors.muted }]}>
                  Le mode grille calcule automatiquement vos commissions en fonction des tranches de montant officielles en vigueur au Bénin (MTN, Moov, Celtis).
                </Text>
              </View>
            ) : (
              <View style={[styles.infoBox, { backgroundColor: "rgba(76, 175, 80, 0.05)" }]}>
                <Percent size={16} color="#4CAF50" />
                <Text style={[styles.infoBoxText, { color: colors.muted }]}>
                  Le mode pourcentage fixe applique un taux fixe configurable pour chaque type de transaction et opérateur.
                </Text>
              </View>
            )}
          </View>

          {/* Configuration Grid */}
          {!commSettings.useProgressiveGrid && (
            <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.settingsCardTitle, { color: colors.text }]}>Pourcentages personnalisés</Text>
              <Text style={[styles.settingsCardDesc, { color: colors.muted }]}>
                Saisissez les taux de commission en % appliqués par vos réseaux partenaires.
              </Text>

              {/* Operator Rows */}
              {(["MTN", "Moov", "Celtis"] as const).map((op) => (
                <View key={op} style={styles.settingsOpSection}>
                  <Text style={[styles.settingsOpTitle, { color: colors.primary }]}>{op} SIM</Text>
                  <View style={styles.inputsRow}>
                    <View style={styles.inputCol}>
                      <Text style={[styles.inputLabel, { color: colors.muted }]}>Dépôt (%)</Text>
                      <TextInput
                        style={[styles.settingsInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                        keyboardType="decimal-pad"
                        value={inputs[`${op}_depot` as keyof typeof inputs]}
                        onChangeText={(val) => setInputs({ ...inputs, [`${op}_depot`]: val })}
                      />
                    </View>
                    <View style={styles.inputCol}>
                      <Text style={[styles.inputLabel, { color: colors.muted }]}>Retrait (%)</Text>
                      <TextInput
                        style={[styles.settingsInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                        keyboardType="decimal-pad"
                        value={inputs[`${op}_retrait` as keyof typeof inputs]}
                        onChangeText={(val) => setInputs({ ...inputs, [`${op}_retrait`]: val })}
                      />
                    </View>
                    <View style={styles.inputCol}>
                      <Text style={[styles.inputLabel, { color: colors.muted }]}>Vente (%)</Text>
                      <TextInput
                        style={[styles.settingsInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                        keyboardType="decimal-pad"
                        value={inputs[`${op}_vente` as keyof typeof inputs]}
                        onChangeText={(val) => setInputs({ ...inputs, [`${op}_vente`]: val })}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Action buttons */}
          <TouchableOpacity 
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            onPress={handleSaveSettings}
            disabled={isSavingSettings}
          >
            <Check size={18} color="#FFFFFF" />
            <Text style={styles.saveBtnText}>{isSavingSettings ? "Enregistrement..." : "Enregistrer la configuration"}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 20, paddingBottom: 8, gap: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heading: { fontSize: 20, fontFamily: "Poppins_700Bold" },
  pdfBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  pdfBtnText: { color: "#FFFFFF", fontSize: 12, fontFamily: "Poppins_600SemiBold" },
  
  periodTabsContainer: { gap: 8, paddingVertical: 4 },
  periodTab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 18, borderWidth: 1, borderColor: "transparent", minWidth: 60, alignItems: "center" },
  periodTabText: { fontSize: 12, fontFamily: "Poppins_600SemiBold" },

  customRangeContainer: { 
    flexDirection: "row", 
    gap: 16, 
    borderWidth: 1, 
    borderRadius: 12, 
    padding: 10, 
    marginTop: 4, 
    justifyContent: "space-between" 
  },
  datePickerCol: { flex: 1, gap: 4 },
  datePickerLabel: { fontSize: 10, fontFamily: "Poppins_600SemiBold" },
  dateSelectorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  arrowBtn: { width: 28, height: 28, borderRadius: 6, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  dateInput: { 
    flex: 1, 
    height: 28, 
    borderWidth: 1, 
    borderRadius: 6, 
    paddingHorizontal: 4, 
    fontSize: 11, 
    fontFamily: "Poppins_400Regular", 
    textAlign: "center" 
  },

  navTabs: { flexDirection: "row", marginTop: 8, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.03)" },
  navTab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderBottomWidth: 2, borderBottomColor: "transparent", paddingVertical: 12 },
  navTabActive: { borderBottomWidth: 2 },
  navTabText: { fontSize: 13, fontFamily: "Poppins_600SemiBold" },

  scrollContainer: { padding: 20, gap: 20, paddingBottom: 100 },
  
  profitBanner: { borderRadius: 18, padding: 20, gap: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
  profitBannerHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  profitIconWrapper: { width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,215,0,0.12)", alignItems: "center", justifyContent: "center" },
  profitBannerLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Poppins_600SemiBold" },
  profitBannerValue: { color: "#FFFFFF", fontSize: 26, fontFamily: "Poppins_700Bold" },
  profitBannerFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  profitBannerSub: { color: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "Poppins_400Regular" },

  metricsGrid: { gap: 10 },
  metricsRow: { flexDirection: "row", gap: 10 },

  sectionContainer: { gap: 12 },
  sectionTitle: { fontSize: 15, fontFamily: "Poppins_700Bold" },
  opGrid: { gap: 10 },
  
  opCard: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 8 },
  opCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  opBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  opBadgeText: { fontSize: 11, fontFamily: "Poppins_700Bold" },
  opCardCount: { fontSize: 11, fontFamily: "Poppins_600SemiBold" },
  opCardLabel: { fontSize: 10, fontFamily: "Poppins_500Medium", textTransform: "uppercase" },
  opCardVolume: { fontSize: 15, fontFamily: "Poppins_700Bold" },
  opCardDivider: { height: 1, backgroundColor: "rgba(0,0,0,0.04)" },
  opCardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  opProfitLabel: { fontSize: 11, fontFamily: "Poppins_500Medium" },
  opProfitValue: { fontSize: 14, fontFamily: "Poppins_700Bold" },

  chartCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  chartHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  chartTitle: { fontSize: 13, fontFamily: "Poppins_600SemiBold" },

  txListContainer: { padding: 20, gap: 10, paddingBottom: 100 },
  empty: { padding: 40, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 13, fontFamily: "Poppins_400Regular", textAlign: "center" },

  txItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14, borderRadius: 12, borderWidth: 1 },
  txItemLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  txTypeBadge: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  txTypeBadgeText: { fontSize: 14, fontFamily: "Poppins_700Bold" },
  txClientName: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  txMetaText: { fontSize: 11, fontFamily: "Poppins_400Regular", marginTop: 2 },
  txAmount: { fontSize: 14, fontFamily: "Poppins_700Bold" },
  txCommission: { fontSize: 12, fontFamily: "Poppins_600SemiBold", marginTop: 2 },

  settingsCard: { borderRadius: 16, borderWidth: 1, padding: 18, gap: 12 },
  settingsCardTitle: { fontSize: 14, fontFamily: "Poppins_700Bold" },
  settingsCardDesc: { fontSize: 11, fontFamily: "Poppins_400Regular", lineHeight: 16 },
  toggleContainer: { flexDirection: "row", gap: 10, marginTop: 4 },
  toggleBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 44, borderRadius: 10, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)", paddingVertical: 10 },
  toggleBtnActive: { borderWidth: 1 },
  toggleBtnText: { fontSize: 12, fontFamily: "Poppins_600SemiBold" },
  infoBox: { flexDirection: "row", gap: 8, padding: 12, borderRadius: 10, alignItems: "flex-start" },
  infoBoxText: { flex: 1, fontSize: 11, fontFamily: "Poppins_400Regular", lineHeight: 16 },

  settingsOpSection: { gap: 10, marginTop: 10, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.04)", paddingTop: 14 },
  settingsOpTitle: { fontSize: 13, fontFamily: "Poppins_700Bold" },
  inputsRow: { flexDirection: "row", gap: 10 },
  inputCol: { flex: 1, gap: 4 },
  inputLabel: { fontSize: 10, fontFamily: "Poppins_500Medium" },
  settingsInput: { height: 40, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, fontSize: 12, fontFamily: "Poppins_600SemiBold", textAlign: "center" },

  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, height: 48 },
  saveBtnText: { color: "#FFFFFF", fontSize: 13, fontFamily: "Poppins_600SemiBold" },
});

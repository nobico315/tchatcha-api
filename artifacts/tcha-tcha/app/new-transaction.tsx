import { CheckCircle, X, Zap, Undo2, Camera, Barcode, ShoppingCart, Search, Package } from "lucide-react-native";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState, useMemo } from "react";
import { Switch } from "react-native";
import {
  Alert, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View, FlatList,
} from "react-native";
import PhoneInput from "react-native-phone-number-input";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";

import { Badge } from "@/components/Badge";
import { useAuth } from "@/context/AuthContext";
import { Operator, TransactionType, useTransactions } from "@/context/TransactionContext";
import { useProducts, LocalProduct } from "@/context/ProductContext";
import { useColors } from "@/hooks/useColors";
import { formatAmount } from "@/utils/format";
import BarcodeScannerModal from "@/components/BarcodeScannerModal";
import QuickSaleModal from "@/components/QuickSaleModal";

const operators: Operator[] = ["MTN", "Moov", "Celtis"];
const amountPresets = [500, 1000, 2000, 5000, 10000, 25000];

const detectOperator = (phone: string): Operator | null => {
  const nums = phone.replace(/[^0-9]/g, "");
  let localNum = nums.startsWith("229") ? nums.slice(3) : nums;
  if (localNum.startsWith("01")) {
    localNum = localNum.slice(2);
  }
  if (localNum.length >= 2) {
    const prefix = localNum.slice(0, 2);
    const mtnPrefixes = ["50", "51", "52", "53", "54", "59", "61", "62", "66", "67", "69", "90", "91", "96", "97"];
    const moovPrefixes = ["55", "56", "57", "58", "60", "63", "64", "65", "94", "95"];
    const celtisPrefixes = ["40", "41", "42", "43", "44", "70", "71", "72", "73", "74"];
    if (mtnPrefixes.includes(prefix)) return "MTN";
    if (moovPrefixes.includes(prefix)) return "Moov";
    if (celtisPrefixes.includes(prefix)) return "Celtis";
  }
  return null;
};

export default function NewTransaction() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { addTransaction, getSavedClientByPhone, deleteTransaction, transactions } = useTransactions();
  const { products, searchProducts, recordSale } = useProducts();
  const params = useLocalSearchParams<{ type?: TransactionType }>();

  const [type, setType] = useState<TransactionType>(params.type || "depot");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [formattedClientPhone, setFormattedClientPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [operator, setOperator] = useState<Operator>("MTN");
  const [note, setNote] = useState("");
  const phoneInputRef = useRef<PhoneInput>(null);
  
  // Stock Selection States (For "recharge" replaced by Stock UI)
  const [stockSearchQuery, setStockSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<LocalProduct | null>(null);
  const [saleQty, setSaleQty] = useState("1");
  const [scannerVisible, setScannerVisible] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [quickSaleVisible, setQuickSaleVisible] = useState(false);

  // Modals / Success states
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveClient, setSaveClient] = useState(false);
  const [saleMode, setSaleMode] = useState<"credit" | "forfait">("credit");
  const [isNameAutoFilled, setIsNameAutoFilled] = useState(false);

  // Express Mode
  const [expressMode, setExpressMode] = useState(false);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [undoTxId, setUndoTxId] = useState<string | null>(null);
  const [undoData, setUndoData] = useState<any>(null);
  const undoTimerRef = useRef<any>(null);

  const numericAmount = type === "recharge" && selectedProduct 
    ? (selectedProduct.price * (parseInt(saleQty, 10) || 1)) 
    : (parseInt(amount.replace(/\s/g, ""), 10) || 0);

  useEffect(() => {
    AsyncStorage.getItem("@tcha_express_mode").then((val) => {
      if (val) setExpressMode(val === "true");
    });
  }, []);

  useEffect(() => {
    const op = detectOperator(clientPhone);
    if (op) setOperator(op);
  }, [clientPhone]);

  const recentClients = useMemo(() => {
    const clientsMap = new Map<string, { name: string; phone: string; operator?: Operator }>();
    for (const tx of transactions) {
      if (tx.clientPhone && tx.clientName) {
        const key = tx.clientPhone.replace(/[^0-9]/g, "");
        if (!clientsMap.has(key)) {
          clientsMap.set(key, { 
            name: tx.clientName, 
            phone: tx.clientPhone,
            operator: tx.operator 
          });
        }
      }
      if (clientsMap.size >= 5) break;
    }
    return Array.from(clientsMap.values());
  }, [transactions]);

  const validate = () => {
    if (type === "recharge") {
      if (!selectedProduct) { Alert.alert("Erreur", "Veuillez sélectionner un produit."); return false; }
      const qty = parseInt(saleQty, 10);
      if (isNaN(qty) || qty <= 0) { Alert.alert("Erreur", "Saisissez une quantité valide."); return false; }
      return true;
    }
    if (!clientName) { Alert.alert("Erreur", "Saisissez le nom du client."); return false; }
    const cleanPhone = clientPhone.replace(/[^0-9]/g, "");
    const isBenin10Digit = cleanPhone.length === 10;
    const isValidLib = formattedClientPhone && phoneInputRef.current?.isValidNumber(clientPhone);
    if (!isBenin10Digit && !isValidLib) {
      Alert.alert("Erreur", "Saisissez un numéro de téléphone valide.");
      return false;
    }
    if (numericAmount < 100) { Alert.alert("Erreur", "Montant minimum : 100 FCFA."); return false; }
    return true;
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      if (type === "recharge" && selectedProduct) {
        const qty = parseInt(saleQty, 10) || 1;
        await recordSale({
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          unitPrice: selectedProduct.price,
          quantity: qty,
          totalPrice: selectedProduct.price * qty,
          barcode: selectedProduct.barcode,
          note: note.trim() || null,
        });
      } else {
        await addTransaction({
          type,
          clientName,
          clientPhone: formattedClientPhone,
          amount: numericAmount,
          operator,
          savedClient: saveClient,
          saleMode: type === "vente" ? saleMode : undefined,
          note,
          agentId: user?.id ?? "",
        });
      }
      setShowConfirm(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowSuccess(true);
    } catch (err: any) {
      Alert.alert("Erreur", err?.message ?? "Une erreur est survenue.");
      setShowConfirm(false);
    } finally {
      setLoading(false);
    }
  };

  const handleBarCodeScanned = (barcode: string) => {
    setScannedBarcode(barcode);
    setQuickSaleVisible(true);
  };

  const handleSelectRecentClient = (client: { name: string; phone: string; operator?: Operator }) => {
    const cleanPhone = client.phone.replace(/[^0-9]/g, "");
    const localPhone = cleanPhone.startsWith("229") ? cleanPhone.slice(3) : cleanPhone;
    setClientPhone(localPhone);
    setClientName(client.name);
    if (client.operator) setOperator(client.operator);
    setIsNameAutoFilled(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSelectAmount = (val: number) => {
    setAmount(val.toLocaleString("fr-FR").replace(/,/g, " "));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const reset = () => {
    setClientName(""); setClientPhone(""); setAmount(""); setNote(""); setOperator("MTN");
    setSelectedProduct(null); setSaleQty("1"); setStockSearchQuery("");
    setIsNameAutoFilled(false);
    setShowSuccess(false); setType("depot");
  };

  const filteredProducts = searchProducts(stockSearchQuery);

  if (showSuccess) {
    return (
      <View style={[styles.success, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20, paddingTop: insets.top + 40 }]}>
        <CheckCircle size={72} color={colors.successText} />
        <Text style={[styles.successTitle, { color: colors.successText }]}>
          {type === "recharge" ? "Vente enregistrée !" : "Transaction validée !"}
        </Text>
        <View style={styles.successAmountRow}>
          <Text style={[styles.successAmount, { color: colors.primary }]}>{formatAmount(numericAmount)}</Text>
          <Text style={[styles.successFcfa, { color: colors.accent }]}> FCFA</Text>
        </View>
        {type !== "recharge" && <Text style={[styles.successClient, { color: colors.muted }]}>{clientName}</Text>}
        <View style={styles.successBtns}>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={reset}>
            <Text style={[styles.primaryBtnText, { color: colors.accent }]}>Nouveau enregistrement</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { reset(); router.replace(type === "recharge" ? "/stock" : "/transactions"); }}>
            <Text style={[styles.ghostBtn, { color: colors.primary }]}>Voir l'historique</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={[{ flex: 1, backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={[styles.heading, { color: colors.primary }]}>Enregistrer</Text>
          <TouchableOpacity onPress={() => router.back()}><X size={24} color={colors.muted} /></TouchableOpacity>
        </View>

        <View style={styles.body}>
          {/* Tabs toggle */}
          <View style={[styles.toggle, { backgroundColor: colors.surface }]}>
            {([
              ["depot", "Dépôt"],
              ["retrait", "Retrait"],
              ["recharge", "STOCK"],
              ["vente", "Vente"],
            ] as [TransactionType, string][]).map(([t, lbl]) => (
              <TouchableOpacity
                key={t}
                style={[styles.pill, type === t && { backgroundColor: colors.primary }]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.pillLabel, { color: type === t ? "#FFFFFF" : colors.muted }]}>{lbl}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* ── SECTION STOCK ────────────────────────────────────────────── */}
          {type === "recharge" ? (
            <View style={{ gap: 14 }}>
              {/* Scan Shortcut */}
              <TouchableOpacity 
                style={[styles.scanShortcutBtn, { backgroundColor: colors.primary }]} 
                onPress={() => setScannerVisible(true)}
              >
                <Camera size={18} color="#FFD700" />
                <Text style={[styles.scanShortcutTxt, { color: "#FFD700" }]}>Scanner Code-barres pour Vendre</Text>
              </TouchableOpacity>

              {/* Sélectionné */}
              {selectedProduct ? (
                <View style={[styles.selectedProductCard, { backgroundColor: colors.card, borderColor: colors.primary }]}>
                  <Package size={20} color={colors.primary} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={[styles.selectedName, { color: colors.text }]}>{selectedProduct.name}</Text>
                    <Text style={[styles.selectedMeta, { color: colors.muted }]}>
                      Prix: {formatAmount(selectedProduct.price)} F • Stock dispo: {selectedProduct.stock ?? 0}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => setSelectedProduct(null)}><X size={18} color={colors.muted} /></TouchableOpacity>
                </View>
              ) : (
                <View>
                  <Text style={[styles.label, { color: colors.muted }]}>RECHERCHER UN PRODUIT</Text>
                  <View style={[styles.searchRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
                    <Search size={16} color={colors.muted} />
                    <TextInput
                      style={{ flex: 1, color: colors.text, fontFamily: "Poppins_400Regular", marginLeft: 6, height: 46 }}
                      value={stockSearchQuery}
                      onChangeText={setStockSearchQuery}
                      placeholder="Saisissez le nom du produit..."
                      placeholderTextColor={colors.muted}
                    />
                  </View>
                  {/* Suggestions de recherche */}
                  {stockSearchQuery.trim().length > 0 && (
                    <View style={[styles.suggestionsList, { borderColor: colors.border, backgroundColor: colors.card }]}>
                      {filteredProducts.slice(0, 5).map((p) => (
                        <TouchableOpacity
                          key={p.id}
                          style={[styles.suggestionItem, { borderBottomColor: colors.border }]}
                          onPress={() => {
                            setSelectedProduct(p);
                            setStockSearchQuery("");
                          }}
                        >
                          <Text style={{ color: colors.text, fontFamily: "Poppins_600SemiBold" }}>{p.name}</Text>
                          <Text style={{ color: colors.muted, fontSize: 11 }}>{formatAmount(p.price)} FCFA</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Quantité */}
              <View>
                <Text style={[styles.label, { color: colors.muted }]}>QUANTITÉ À VENDRE</Text>
                <View style={[styles.qtySelector, { backgroundColor: colors.input, borderColor: colors.border }]}>
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => setSaleQty(q => Math.max(1, parseInt(q, 10) - 1).toString())}>
                    <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.primary }}>−</Text>
                  </TouchableOpacity>
                  <TextInput
                    style={{ flex: 1, textAlign: "center", fontSize: 18, fontFamily: "Poppins_700Bold", color: colors.text }}
                    value={saleQty}
                    onChangeText={t => setSaleQty(t.replace(/[^0-9]/g, "") || "1")}
                    keyboardType="number-pad"
                  />
                  <TouchableOpacity style={styles.qtyBtn} onPress={() => setSaleQty(q => (parseInt(q, 10) + 1).toString())}>
                    <Text style={{ fontSize: 24, fontWeight: "bold", color: colors.primary }}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Note */}
              <View>
                <Text style={[styles.label, { color: colors.muted }]}>NOTE (OPTIONNEL)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text, fontFamily: "Poppins_400Regular" }]}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Note ou commentaire sur la vente..."
                  placeholderTextColor={colors.muted}
                />
              </View>

              {numericAmount > 0 && (
                <View style={[styles.totalRow, { backgroundColor: "rgba(25,25,112,0.05)", borderColor: colors.primary }]}>
                  <Text style={{ color: colors.muted, fontFamily: "Poppins_600SemiBold" }}>Total :</Text>
                  <Text style={{ color: colors.primary, fontFamily: "Poppins_700Bold", fontSize: 18, marginLeft: "auto" }}>
                    {formatAmount(numericAmount)} FCFA
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: (!selectedProduct) ? 0.6 : 1 }]}
                onPress={() => { if (validate()) setShowConfirm(true); }}
                disabled={!selectedProduct}
              >
                <Text style={[styles.primaryBtnText, { color: colors.accent }]}>Confirmer la vente</Text>
              </TouchableOpacity>
            </View>
          ) : (
            // ── FLUX TRANSACTION STANDARD (DÉPOT/RETRAIT/VENTE) ──────────
            <>
              {type === "vente" && (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                  <TouchableOpacity
                    style={[styles.smallPill, saleMode === "credit" && { backgroundColor: colors.primary }]}
                    onPress={() => setSaleMode("credit")}
                  >
                    <Text style={[styles.smallPillLabel, { color: saleMode === "credit" ? "#fff" : colors.muted }]}>Crédit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.smallPill, saleMode === "forfait" && { backgroundColor: colors.primary }]}
                    onPress={() => setSaleMode("forfait")}
                  >
                    <Text style={[styles.smallPillLabel, { color: saleMode === "forfait" ? "#fff" : colors.muted }]}>Forfait</Text>
                  </TouchableOpacity>
                </View>
              )}

              {recentClients.length > 0 && (
                <View style={styles.recentClientsSection}>
                  <Text style={[styles.recentClientsTitle, { color: colors.muted }]}>Clients récents</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentScroll}>
                    {recentClients.map((client, idx) => (
                      <TouchableOpacity 
                        key={idx} 
                        style={[styles.recentClientChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                        onPress={() => handleSelectRecentClient(client)}
                      >
                        <Text style={[styles.recentClientName, { color: colors.text }]} numberOfLines={1}>{client.name}</Text>
                        <Text style={[styles.recentClientPhone, { color: colors.muted }]}>{client.phone.slice(-8)}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              <View>
                <Text style={[styles.label, { color: colors.muted }]}>NUMÉRO DE TÉLÉPHONE</Text>
                <PhoneInput
                  ref={phoneInputRef}
                  value={clientPhone}
                  defaultCode="BJ"
                  layout="first"
                  onChangeText={(text) => setClientPhone(text)}
                  onChangeFormattedText={(text) => setFormattedClientPhone(text)}
                  withDarkTheme={false}
                  withShadow
                  autoFocus={recentClients.length === 0}
                  disableArrowIcon={false}
                  placeholder="Numéro du client"
                  textInputProps={{ keyboardType: "phone-pad" }}
                  containerStyle={[styles.phoneContainer, { backgroundColor: colors.input, borderColor: colors.border }]}
                  textContainerStyle={[styles.phoneTextContainer, { backgroundColor: colors.input }]}
                  textInputStyle={[styles.phoneInput, { color: colors.text, fontFamily: "Poppins_400Regular" }]}
                  codeTextStyle={[styles.codeText, { color: colors.text }]}
                  countryPickerButtonStyle={[styles.countryButton, { backgroundColor: colors.input }]}
                  flagButtonStyle={styles.flagButton}
                />
              </View>

              <View>
                <Text style={[styles.label, { color: colors.muted }]}>NOM DU CLIENT</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text, fontFamily: "Poppins_400Regular" }]}
                  value={clientName}
                  onChangeText={(text) => {
                    setClientName(text);
                    if (isNameAutoFilled) setIsNameAutoFilled(false);
                  }}
                  placeholder="Ex: Kofi Atta"
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View>
                <Text style={[styles.label, { color: colors.muted }]}>MONTANT FCFA</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.primary, fontSize: 20, fontFamily: "Poppins_700Bold" }]}
                  value={amount}
                  onChangeText={(t) => {
                    const raw = t.replace(/[^0-9]/g, "");
                    const num = parseInt(raw, 10);
                    setAmount(isNaN(num) ? "" : num.toLocaleString("fr-FR").replace(/,/g, " "));
                  }}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={colors.muted}
                />
                
                <View style={styles.presetsRow}>
                  {amountPresets.map((val) => (
                    <TouchableOpacity
                      key={val}
                      style={[styles.presetChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
                      onPress={() => handleSelectAmount(val)}
                    >
                      <Text style={[styles.presetText, { color: colors.primary }]}>{formatAmount(val)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View>
                <Text style={[styles.label, { color: colors.muted }]}>OPÉRATEUR</Text>
                <View style={styles.operatorRow}>
                  {operators.map((op) => {
                    let activeColor = colors.primary;
                    let activeBg = "#eef0ff";
                    if (op === "MTN" && operator === op) { activeColor = "#FFC80A"; activeBg = "rgba(255,200,10,0.1)"; }
                    else if (op === "Moov" && operator === op) { activeColor = "#00C3FF"; activeBg = "rgba(0,195,255,0.08)"; }
                    else if (op === "Celtis" && operator === op) { activeColor = "#4CAF50"; activeBg = "rgba(76,175,80,0.08)"; }

                    return (
                      <TouchableOpacity
                        key={op}
                        style={[styles.opPill, { borderColor: operator === op ? activeColor : colors.border, backgroundColor: operator === op ? activeBg : colors.card }]}
                        onPress={() => setOperator(op)}
                      >
                        <Text style={[styles.opLabel, { color: operator === op ? activeColor : colors.muted }]}>{op}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View>
                <Text style={[styles.label, { color: colors.muted }]}>NOTE (OPTIONNEL)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text, fontFamily: "Poppins_400Regular" }]}
                  value={note}
                  onChangeText={setNote}
                  placeholder="Ajouter une note..."
                  placeholderTextColor={colors.muted}
                />
              </View>

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                <Text style={[styles.label, { color: colors.muted, marginBottom: 0 }]}>Enregistrer le client</Text>
                <Switch value={saveClient} onValueChange={setSaveClient} />
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
                onPress={() => { if (validate()) setShowConfirm(true); }}
              >
                <Text style={[styles.primaryBtnText, { color: colors.accent }]}>Valider la transaction</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={handleBarCodeScanned}
        colors={colors}
        title="Scanner Vente de Stock"
      />

      {/* Quick Sale Modal (triggered after scan) */}
      <QuickSaleModal
        visible={quickSaleVisible}
        onClose={() => {
          setQuickSaleVisible(false);
          setScannedBarcode(null);
          reset();
        }}
        barcode={scannedBarcode}
        colors={colors}
      />

      {/* Confirm Modal */}
      <Modal visible={showConfirm} transparent animationType="slide" onRequestClose={() => setShowConfirm(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowConfirm(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 20 }]}>
          <View style={[{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 }]} />
          <Text style={[styles.confirmTitle, { color: colors.primary }]}>
            {type === "recharge" ? "Confirmer la Vente de Stock" : "Confirmer la transaction"}
          </Text>
          
          <View style={styles.confirmAmountRow}>
            <Text style={[styles.confirmAmount, { color: colors.primary }]}>{formatAmount(numericAmount)}</Text>
            <Text style={[styles.confirmFcfa, { color: colors.accent }]}> FCFA</Text>
          </View>
          
          {type === "recharge" && selectedProduct ? (
            <>
              <View style={[styles.detailRow, { borderColor: colors.border }]}>
                <Text style={[styles.detailKey, { color: colors.muted }]}>Produit</Text>
                <Text style={[styles.detailVal, { color: colors.text }]}>{selectedProduct.name}</Text>
              </View>
              <View style={[styles.detailRow, { borderColor: colors.border }]}>
                <Text style={[styles.detailKey, { color: colors.muted }]}>Quantité</Text>
                <Text style={[styles.detailVal, { color: colors.text }]}>{saleQty} u</Text>
              </View>
              {note ? (
                <View style={[styles.detailRow, { borderColor: colors.border }]}>
                  <Text style={[styles.detailKey, { color: colors.muted }]}>Note</Text>
                  <Text style={[styles.detailVal, { color: colors.text }]}>{note}</Text>
                </View>
              ) : null}
            </>
          ) : (
            [
              ["Client", clientName],
              ["Téléphone", formattedClientPhone || clientPhone],
              ["Opérateur", operator],
              ...(note ? [["Note", note]] : []),
            ].map(([k, v]) => (
              <View key={k} style={[styles.detailRow, { borderColor: colors.border }]}>
                <Text style={[styles.detailKey, { color: colors.muted }]}>{k}</Text>
                <Text style={[styles.detailVal, { color: colors.text }]}>{v}</Text>
              </View>
            ))
          )}

          <View style={styles.confirmBtns}>
            <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.primary }]} onPress={() => setShowConfirm(false)}>
              <Text style={[styles.secondaryBtnText, { color: colors.primary }]}>Modifier</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: colors.primary, flex: 1, opacity: loading ? 0.7 : 1 }]} onPress={handleConfirm} disabled={loading}>
              <Text style={[styles.primaryBtnText, { color: colors.accent }]}>{loading ? "..." : "Confirmer"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 8 },
  heading: { fontSize: 20, fontFamily: "Poppins_700Bold" },
  body: { paddingHorizontal: 20, gap: 16 },
  toggle: { flexDirection: "row", borderRadius: 12, padding: 4, gap: 4 },
  pill: { flex: 1, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  pillLabel: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  smallPill: { height: 36, flex: 1, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#ccc" },
  smallPillLabel: { fontSize: 12, fontFamily: "Poppins_600SemiBold" },
  label: { fontSize: 11, fontFamily: "Poppins_600SemiBold", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6 },
  input: { height: 50, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, fontSize: 14 },
  phoneContainer: { borderRadius: 12, borderWidth: 1, height: 50, overflow: "hidden" },
  phoneTextContainer: { borderTopRightRadius: 12, borderBottomRightRadius: 12, backgroundColor: "transparent" },
  codeText: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  countryButton: { width: 80, borderTopLeftRadius: 12, borderBottomLeftRadius: 12, overflow: "hidden" },
  flagButton: { width: 80, justifyContent: "center", alignItems: "center" },
  phoneInput: { flex: 1, fontSize: 14, height: "100%" },
  
  operatorRow: { flexDirection: "row", gap: 10 },
  opPill: { flex: 1, height: 44, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  opLabel: { fontSize: 13, fontFamily: "Poppins_700Bold" },
  
  primaryBtn: { height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  primaryBtnText: { fontSize: 15, fontFamily: "Poppins_700Bold" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 14 },
  confirmTitle: { fontSize: 18, fontFamily: "Poppins_700Bold" },
  confirmAmountRow: { flexDirection: "row", alignItems: "baseline" },
  confirmAmount: { fontSize: 32, fontFamily: "Poppins_700Bold" },
  confirmFcfa: { fontSize: 18, fontFamily: "Poppins_700Bold" },
  detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1 },
  detailKey: { fontSize: 13, fontFamily: "Poppins_400Regular" },
  detailVal: { fontSize: 13, fontFamily: "Poppins_600SemiBold" },
  confirmBtns: { flexDirection: "row", gap: 12, marginTop: 4 },
  secondaryBtn: { height: 52, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 20, alignItems: "center", justifyContent: "center" },
  secondaryBtnText: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  success: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 40 },
  successTitle: { fontSize: 22, fontFamily: "Poppins_700Bold" },
  successAmountRow: { flexDirection: "row", alignItems: "baseline" },
  successAmount: { fontSize: 32, fontFamily: "Poppins_700Bold" },
  successFcfa: { fontSize: 18, fontFamily: "Poppins_700Bold" },
  successClient: { fontSize: 15, fontFamily: "Poppins_400Regular" },
  successBtns: { width: "100%", gap: 12, marginTop: 8 },
  ghostBtn: { textAlign: "center", fontSize: 14, fontFamily: "Poppins_600SemiBold", textDecorationLine: "underline" },

  recentClientsSection: { gap: 6 },
  recentClientsTitle: { fontSize: 10, fontFamily: "Poppins_600SemiBold", textTransform: "uppercase", letterSpacing: 0.3 },
  recentScroll: { gap: 8, paddingVertical: 2 },
  recentClientChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, alignItems: "center", gap: 2, minWidth: 80 },
  recentClientName: { fontSize: 11, fontFamily: "Poppins_600SemiBold" },
  recentClientPhone: { fontSize: 9, fontFamily: "Poppins_400Regular" },

  presetsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  presetChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  presetText: { fontSize: 11, fontFamily: "Poppins_600SemiBold" },

  // Stock additions
  scanShortcutBtn: { flexDirection: "row", height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 4 },
  scanShortcutTxt: { fontSize: 13, fontFamily: "Poppins_700Bold" },
  searchRow: { flexDirection: "row", alignItems: "center", height: 50, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12 },
  selectedProductCard: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, padding: 12 },
  selectedName: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  selectedMeta: { fontSize: 11, fontFamily: "Poppins_400Regular", marginTop: 2 },
  suggestionsList: { borderWidth: 1, borderRadius: 12, marginTop: 4, overflow: "hidden" },
  suggestionItem: { padding: 12, borderBottomWidth: 1 },
  qtySelector: { flexDirection: "row", alignItems: "center", height: 52, borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  qtyBtn: { width: 48, height: "100%", alignItems: "center", justifyContent: "center" },
  totalRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, padding: 12 },
});

/**
 * QuickSaleModal.tsx
 * Modal d'enregistrement de vente rapide après scan de code-barres.
 * Gère correctement le clavier virtuel pour ne pas cacher le formulaire.
 */
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CheckCircle, Package, ShoppingCart, X } from "lucide-react-native";
import { lookupBarcode, BarcodeProduct } from "@/utils/barcodeApi";
import { useProducts, LocalProduct } from "@/context/ProductContext";
import { formatAmount } from "@/utils/format";

interface QuickSaleModalProps {
  visible: boolean;
  onClose: () => void;
  barcode: string | null;
  colors: any;
}

export default function QuickSaleModal({ visible, onClose, barcode, colors }: QuickSaleModalProps) {
  const insets = useSafeAreaInsets();
  const { searchProductByBarcode, recordSale } = useProducts();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localProduct, setLocalProduct] = useState<LocalProduct | null>(null);
  const [onlineProduct, setOnlineProduct] = useState<BarcodeProduct | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [productName, setProductName] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [quantity, setQuantity] = useState("1");

  useEffect(() => {
    if (!visible || !barcode) return;

    setLocalProduct(null);
    setOnlineProduct(null);
    setNotFound(false);
    setProductName("");
    setUnitPrice("");
    setQuantity("1");
    setLoading(true);

    (async () => {
      // 1. Chercher en local
      const local = searchProductByBarcode(barcode);
      if (local) {
        setLocalProduct(local);
        setProductName(local.name);
        setUnitPrice(local.price.toString());
        setLoading(false);
        return;
      }

      // 2. Chercher en ligne
      const online = await lookupBarcode(barcode);
      if (online) {
        setOnlineProduct(online);
        setProductName(online.name);
        setLoading(false);
        return;
      }

      // 3. Rien
      setNotFound(true);
      setLoading(false);
    })();
  }, [visible, barcode]);

  const handleSave = async () => {
    const name = productName.trim();
    const price = parseInt(unitPrice, 10);
    const qty = parseInt(quantity, 10);

    if (!name) return;
    if (!price || price <= 0) return;
    if (!qty || qty <= 0) return;

    setSaving(true);
    try {
      await recordSale({
        productId: localProduct?.id ?? null,
        productName: name,
        unitPrice: price,
        quantity: qty,
        totalPrice: price * qty,
        barcode: barcode ?? null,
        note: null,
      });
      onClose();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const saleTotal = (parseInt(unitPrice, 10) || 0) * (parseInt(quantity, 10) || 0);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.modalContainer}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={s.keyboardView}
        >
          <View style={[s.sheet, { backgroundColor: colors.background, paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 20 }]}>
            <View style={s.handle} />
            <View style={s.headerRow}>
              <Text style={[s.sheetTitle, { color: colors.primary }]}>Enregistrer la vente</Text>
              <TouchableOpacity onPress={onClose} hitSlop={12}><X size={22} color={colors.muted} /></TouchableOpacity>
            </View>

            {barcode && (
              <View style={[s.barcodePill, { backgroundColor: colors.input, borderColor: colors.border }]}>
                <Text style={[s.barcodeLabel, { color: colors.muted }]}>Code-barres : </Text>
                <Text style={[s.barcodeValue, { color: colors.text }]}>{barcode}</Text>
              </View>
            )}

            {loading ? (
              <View style={s.loadingBox}>
                <ActivityIndicator color={colors.primary} size="large" />
                <Text style={[s.loadingText, { color: colors.muted }]}>Recherche du produit en ligne…</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={{ gap: 14 }}>
                  {/* Badge statut */}
                  {localProduct && (
                    <View style={[s.statusBadge, { backgroundColor: "#eafaf0", borderColor: "#1a7a4a" }]}>
                      <CheckCircle size={16} color="#1a7a4a" />
                      <Text style={[s.statusText, { color: "#1a7a4a" }]}>Produit trouvé dans votre catalogue</Text>
                    </View>
                  )}
                  {onlineProduct && !localProduct && (
                    <View style={[s.statusBadge, { backgroundColor: "rgba(25,25,112,0.06)", borderColor: colors.primary }]}>
                      <Package size={16} color={colors.primary} />
                      <Text style={[s.statusText, { color: colors.primary }]}>Identifié en ligne — ajustez le prix</Text>
                    </View>
                  )}
                  {notFound && (
                    <View style={[s.statusBadge, { backgroundColor: "#fff8e1", borderColor: "#ffd54f" }]}>
                      <Package size={16} color="#795548" />
                      <Text style={[s.statusText, { color: "#795548" }]}>Produit non trouvé — saisissez les infos</Text>
                    </View>
                  )}

                  {/* Nom */}
                  <View>
                    <Text style={[s.label, { color: colors.muted }]}>PRODUIT</Text>
                    <TextInput
                      style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                      value={productName}
                      onChangeText={setProductName}
                      placeholder="Nom du produit"
                      placeholderTextColor={colors.muted}
                    />
                  </View>

                  {/* Prix + Quantité */}
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.label, { color: colors.muted }]}>PRIX UNITAIRE (FCFA)</Text>
                      <TextInput
                        style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                        value={unitPrice}
                        onChangeText={(t) => setUnitPrice(t.replace(/[^0-9]/g, ""))}
                        placeholder="500"
                        placeholderTextColor={colors.muted}
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.label, { color: colors.muted }]}>QUANTITÉ</Text>
                      <View style={[s.qtyRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
                        <TouchableOpacity style={s.qtyBtn} onPress={() => setQuantity((q) => Math.max(1, parseInt(q, 10) - 1).toString())}>
                          <Text style={[s.qtyBtnTxt, { color: colors.primary }]}>−</Text>
                        </TouchableOpacity>
                        <TextInput
                          style={[s.qtyInput, { color: colors.text }]}
                          value={quantity}
                          onChangeText={(t) => setQuantity(t.replace(/[^0-9]/g, "") || "1")}
                          keyboardType="number-pad"
                          textAlign="center"
                        />
                        <TouchableOpacity style={s.qtyBtn} onPress={() => setQuantity((q) => (parseInt(q, 10) + 1).toString())}>
                          <Text style={[s.qtyBtnTxt, { color: colors.primary }]}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {/* Total */}
                  {saleTotal > 0 && (
                    <View style={[s.totalRow, { backgroundColor: "rgba(25,25,112,0.05)", borderColor: colors.primary }]}>
                      <ShoppingCart size={16} color={colors.primary} />
                      <Text style={[s.totalLabel, { color: colors.muted }]}>Total :</Text>
                      <Text style={[s.totalValue, { color: colors.primary }]}>{formatAmount(saleTotal)} FCFA</Text>
                    </View>
                  )}

                  {/* Bouton */}
                  <TouchableOpacity
                    style={[s.submitBtn, { backgroundColor: colors.primary, opacity: (!productName.trim() || !unitPrice || saving) ? 0.5 : 1 }]}
                    onPress={handleSave}
                    disabled={!productName.trim() || !unitPrice || saving}
                  >
                    {saving
                      ? <ActivityIndicator color="#FFD700" />
                      : <Text style={[s.submitBtnText, { color: "#FFD700" }]}>Enregistrer la vente</Text>
                    }
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalContainer: { flex: 1, justifyContent: "flex-end" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  keyboardView: { width: "100%" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 14 },
  handle: { width: 40, height: 4, backgroundColor: "#E0E0E0", borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheetTitle: { fontSize: 19, fontFamily: "Poppins_700Bold" },
  barcodePill: { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  barcodeLabel: { fontSize: 12, fontFamily: "Poppins_400Regular" },
  barcodeValue: { fontSize: 12, fontFamily: "Poppins_600SemiBold" },
  loadingBox: { alignItems: "center", justifyContent: "center", gap: 12, minHeight: 180 },
  loadingText: { fontSize: 14, fontFamily: "Poppins_400Regular" },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 4 },
  statusText: { fontSize: 13, fontFamily: "Poppins_600SemiBold", flex: 1 },
  label: { fontSize: 11, fontFamily: "Poppins_600SemiBold", textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 6, marginTop: 4 },
  input: { borderRadius: 14, borderWidth: 1, height: 52, paddingHorizontal: 14, fontSize: 15, fontFamily: "Poppins_400Regular" },
  qtyRow: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, height: 52, overflow: "hidden" },
  qtyBtn: { width: 44, height: 52, alignItems: "center", justifyContent: "center" },
  qtyBtnTxt: { fontSize: 22, fontFamily: "Poppins_700Bold" },
  qtyInput: { flex: 1, height: 52, fontSize: 18, fontFamily: "Poppins_700Bold" },
  totalRow: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, padding: 12 },
  totalLabel: { fontSize: 14, fontFamily: "Poppins_400Regular" },
  totalValue: { fontSize: 18, fontFamily: "Poppins_700Bold", marginLeft: "auto" },
  submitBtn: { height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 4 },
  submitBtnText: { fontSize: 16, fontFamily: "Poppins_700Bold" },
});

/**
 * QuickStockModal.tsx
 * Modal d'ajout/mise à jour d'un produit en stock via scan de code-barres.
 * Gère correctement la remontée du clavier et permet d'enregistrer le prix d'achat.
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
import { Archive, CheckCircle, Package, X } from "lucide-react-native";
import { lookupBarcode, BarcodeProduct } from "@/utils/barcodeApi";
import { useProducts, LocalProduct } from "@/context/ProductContext";

interface QuickStockModalProps {
  visible: boolean;
  onClose: () => void;
  barcode: string | null;
  colors: any;
}

export default function QuickStockModal({ visible, onClose, barcode, colors }: QuickStockModalProps) {
  const insets = useSafeAreaInsets();
  const { searchProductByBarcode, addProduct, editProduct } = useProducts();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localProduct, setLocalProduct] = useState<LocalProduct | null>(null);
  const [onlineProduct, setOnlineProduct] = useState<BarcodeProduct | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [category, setCategory] = useState("");
  
  // Nouveaux champs pour le prix d'achat
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseType, setPurchaseType] = useState<"detail" | "gros">("detail");

  useEffect(() => {
    if (!visible || !barcode) return;

    setLocalProduct(null);
    setOnlineProduct(null);
    setNotFound(false);
    setProductName("");
    setProductPrice("");
    setQuantity("1");
    setCategory("");
    setPurchasePrice("");
    setPurchaseType("detail");
    setLoading(true);

    (async () => {
      const local = searchProductByBarcode(barcode);
      if (local) {
        setLocalProduct(local);
        setProductName(local.name);
        setProductPrice(local.price.toString());
        setQuantity((local.stock ?? 0).toString());
        setCategory(local.category ?? "");
        
        // Décoder le prix d'achat depuis la description
        if (local.description) {
          try {
            const meta = JSON.parse(local.description);
            if (meta.purchasePrice !== undefined) {
              setPurchasePrice(meta.purchasePrice.toString());
              setPurchaseType(meta.purchaseType || "detail");
            }
          } catch {
            // Pas du JSON valide, on laisse vide
          }
        }
        setLoading(false);
        return;
      }

      const online = await lookupBarcode(barcode);
      if (online) {
        setOnlineProduct(online);
        setProductName(online.name);
        setCategory(online.category ?? "");
        setLoading(false);
        return;
      }

      setNotFound(true);
      setLoading(false);
    })();
  }, [visible, barcode]);

  const handleSave = async () => {
    const name = productName.trim();
    const price = parseInt(productPrice, 10);
    const qty = parseInt(quantity, 10);
    const pPrice = parseInt(purchasePrice, 10) || 0;

    if (!name || !price || price <= 0) return;

    setSaving(true);
    
    // Convertir les infos d'achat en JSON dans la description
    const descJson = JSON.stringify({
      purchasePrice: pPrice,
      purchaseType: purchaseType,
    });

    try {
      if (localProduct) {
        await editProduct(localProduct.id, {
          name,
          price,
          stock: isNaN(qty) ? 0 : qty,
          barcode: barcode ?? localProduct.barcode ?? null,
          category: category.trim() || null,
          description: descJson,
        });
      } else {
        await addProduct({
          name,
          price,
          stock: isNaN(qty) ? 0 : qty,
          barcode: barcode ?? undefined,
          category: category.trim() || undefined,
          description: descJson,
        });
      }
      onClose();
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

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
              <Text style={[s.sheetTitle, { color: colors.primary }]}>{localProduct ? "Mettre à jour le stock" : "Ajouter au stock"}</Text>
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
                <Text style={[s.loadingText, { color: colors.muted }]}>Identification du produit en ligne…</Text>
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={{ gap: 14 }}>
                  {/* Badge statut */}
                  {localProduct && (
                    <View style={[s.statusBadge, { backgroundColor: "#eafaf0", borderColor: "#1a7a4a" }]}>
                      <CheckCircle size={16} color="#1a7a4a" />
                      <Text style={[s.statusText, { color: "#1a7a4a" }]}>Produit existant — mise à jour du stock</Text>
                    </View>
                  )}
                  {onlineProduct && !localProduct && (
                    <View style={[s.statusBadge, { backgroundColor: "rgba(25,25,112,0.06)", borderColor: colors.primary }]}>
                      <Package size={16} color={colors.primary} />
                      <Text style={[s.statusText, { color: colors.primary }]}>Identifié en ligne · précisez le prix et la quantité</Text>
                    </View>
                  )}
                  {notFound && (
                    <View style={[s.statusBadge, { backgroundColor: "#fff8e1", borderColor: "#ffd54f" }]}>
                      <Archive size={16} color="#795548" />
                      <Text style={[s.statusText, { color: "#795548" }]}>Produit inconnu — saisissez les informations</Text>
                    </View>
                  )}

                  {/* Nom */}
                  <View>
                    <Text style={[s.label, { color: colors.muted }]}>NOM DU PRODUIT</Text>
                    <TextInput
                      style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                      value={productName}
                      onChangeText={setProductName}
                      placeholder="Nom du produit"
                      placeholderTextColor={colors.muted}
                    />
                  </View>

                  {/* Prix d'achat */}
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1.2 }}>
                      <Text style={[s.label, { color: colors.muted }]}>PRIX D'ACHAT (FCFA)</Text>
                      <TextInput
                        style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                        value={purchasePrice}
                        onChangeText={(t) => setPurchasePrice(t.replace(/[^0-9]/g, ""))}
                        placeholder="Ex: 1500"
                        placeholderTextColor={colors.muted}
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.label, { color: colors.muted }]}>TYPE D'ACHAT</Text>
                      <View style={s.purchaseTypeRow}>
                        <TouchableOpacity 
                          style={[s.typeBtn, purchaseType === "detail" && { backgroundColor: colors.primary }]} 
                          onPress={() => setPurchaseType("detail")}
                        >
                          <Text style={[s.typeBtnText, { color: purchaseType === "detail" ? "#fff" : colors.muted }]}>Détail</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[s.typeBtn, purchaseType === "gros" && { backgroundColor: colors.primary }]} 
                          onPress={() => setPurchaseType("gros")}
                        >
                          <Text style={[s.typeBtnText, { color: purchaseType === "gros" ? "#fff" : colors.muted }]}>Gros</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {/* Prix + Quantité */}
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1.2 }}>
                      <Text style={[s.label, { color: colors.muted }]}>PRIX DE VENTE (FCFA)</Text>
                      <TextInput
                        style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                        value={productPrice}
                        onChangeText={(t) => setProductPrice(t.replace(/[^0-9]/g, ""))}
                        placeholder="500"
                        placeholderTextColor={colors.muted}
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.label, { color: colors.muted }]}>QUANTITÉ EN STOCK</Text>
                      <View style={[s.qtyRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
                        <TouchableOpacity style={s.qtyBtn} onPress={() => setQuantity((q) => Math.max(0, parseInt(q, 10) - 1).toString())}>
                          <Text style={[s.qtyBtnTxt, { color: colors.primary }]}>−</Text>
                        </TouchableOpacity>
                        <TextInput
                          style={[s.qtyInput, { color: colors.text }]}
                          value={quantity}
                          onChangeText={(t) => setQuantity(t.replace(/[^0-9]/g, "") || "0")}
                          keyboardType="number-pad"
                          textAlign="center"
                        />
                        <TouchableOpacity style={s.qtyBtn} onPress={() => setQuantity((q) => (parseInt(q, 10) + 1).toString())}>
                          <Text style={[s.qtyBtnTxt, { color: colors.primary }]}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {/* Catégorie */}
                  <View>
                    <Text style={[s.label, { color: colors.muted }]}>CATÉGORIE (optionnel)</Text>
                    <TextInput
                      style={[s.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                      value={category}
                      onChangeText={setCategory}
                      placeholder="Ex: Boissons, Alimentation…"
                      placeholderTextColor={colors.muted}
                    />
                  </View>

                  <TouchableOpacity
                    style={[s.submitBtn, { backgroundColor: colors.primary, opacity: (!productName.trim() || !productPrice || saving) ? 0.5 : 1 }]}
                    onPress={handleSave}
                    disabled={!productName.trim() || !productPrice || saving}
                  >
                    {saving
                      ? <ActivityIndicator color="#FFD700" />
                      : <Text style={[s.submitBtnText, { color: "#FFD700" }]}>{localProduct ? "Mettre à jour le stock" : "Ajouter au stock"}</Text>
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
  submitBtn: { height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 4 },
  submitBtnText: { fontSize: 16, fontFamily: "Poppins_700Bold" },
  
  purchaseTypeRow: { flexDirection: "row", borderWidth: 1, borderColor: "#ccc", borderRadius: 14, height: 52, overflow: "hidden" },
  typeBtn: { flex: 1, alignItems: "center", justifyContent: "center" },
  typeBtnText: { fontSize: 12, fontFamily: "Poppins_600SemiBold" }
});

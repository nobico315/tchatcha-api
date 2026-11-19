import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  Barcode,
  ChevronRight,
  Edit3,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Tag,
  Trash2,
  TrendingUp,
  X,
  CheckCircle,
  Camera,
  Archive,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { useProducts, LocalProduct, LocalProductSale } from "@/context/ProductContext";
import { formatAmount, formatTime } from "@/utils/format";
import BarcodeScannerModal from "@/components/BarcodeScannerModal";
import QuickSaleModal from "@/components/QuickSaleModal";

type SheetMode = "catalog" | "sale" | "new-product" | "edit-product" | "barcode";

export default function VentePage() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    products,
    addProduct,
    editProduct,
    removeProduct,
    recordSale,
    searchProducts,
    searchProductByBarcode,
    getTodaySales,
    getSalesTotalToday,
  } = useProducts();

  const [sheetMode, setSheetMode] = useState<SheetMode | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [scannerVisible, setScannerVisible] = useState(false);
  
  // Quick sale scan state
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [quickSaleVisible, setQuickSaleVisible] = useState(false);

  // Product form state
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productBarcode, setProductBarcode] = useState("");
  const [productStock, setProductStock] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [editingProduct, setEditingProduct] = useState<LocalProduct | null>(null);

  // Sale form state
  const [selectedProduct, setSelectedProduct] = useState<LocalProduct | null>(null);
  const [saleProductName, setSaleProductName] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [saleQty, setSaleQty] = useState("1");
  const [saleNote, setSaleNote] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeResult, setBarcodeResult] = useState<LocalProduct | null | "not-found">(null);

  // Action directe de scan pour la vente
  const handleBarCodeScanned = (barcode: string) => {
    setScannedBarcode(barcode);
    setQuickSaleVisible(true);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const todaySales = getTodaySales();
  const totalToday = getSalesTotalToday();
  const filteredProducts = searchProducts(searchQuery);

  const resetProductForm = () => {
    setProductName("");
    setProductPrice("");
    setProductBarcode("");
    setProductStock("");
    setProductCategory("");
    setEditingProduct(null);
  };

  const resetSaleForm = () => {
    setSelectedProduct(null);
    setSaleProductName("");
    setSalePrice("");
    setSaleQty("1");
    setSaleNote("");
  };

  const closeSheet = () => {
    setSheetMode(null);
    resetProductForm();
    resetSaleForm();
    setSearchQuery("");
    setBarcodeInput("");
    setBarcodeResult(null);
  };

  const handleBarcodeSearch = () => {
    if (!barcodeInput.trim()) return;
    const found = searchProductByBarcode(barcodeInput.trim());
    if (found) {
      setBarcodeResult(found);
    } else {
      setBarcodeResult("not-found");
    }
  };

  const openSaleFromBarcode = (product: LocalProduct) => {
    setSelectedProduct(product);
    setSaleProductName(product.name);
    setSalePrice(product.price.toString());
    setSaleQty("1");
    setSheetMode("sale");
    setBarcodeInput("");
    setBarcodeResult(null);
  };

  const openSaleForProduct = (product: LocalProduct) => {
    setSelectedProduct(product);
    setSaleProductName(product.name);
    setSalePrice(product.price.toString());
    setSaleQty("1");
    setSheetMode("sale");
    setSearchQuery("");
  };

  const handleRecordSale = async () => {
    const name = saleProductName.trim();
    const price = parseInt(salePrice, 10);
    const qty = parseInt(saleQty, 10);

    if (!name) { Alert.alert("Erreur", "Saisissez le nom du produit."); return; }
    if (!price || price <= 0) { Alert.alert("Erreur", "Prix invalide."); return; }
    if (!qty || qty <= 0) { Alert.alert("Erreur", "Quantité invalide."); return; }

    setLoading(true);
    try {
      await recordSale({
        productId: selectedProduct?.id ?? null,
        productName: name,
        unitPrice: price,
        quantity: qty,
        totalPrice: price * qty,
        barcode: selectedProduct?.barcode ?? null,
        note: saleNote.trim() || null,
      });
      closeSheet();
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Erreur lors de l'enregistrement.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProduct = async () => {
    const name = productName.trim();
    const price = parseInt(productPrice, 10);

    if (!name) { Alert.alert("Erreur", "Saisissez le nom du produit."); return; }
    if (!price || price <= 0) { Alert.alert("Erreur", "Prix invalide."); return; }

    const stock = productStock.trim() ? parseInt(productStock, 10) : undefined;

    setLoading(true);
    try {
      if (editingProduct) {
        await editProduct(editingProduct.id, {
          name,
          price,
          barcode: productBarcode.trim() || null,
          stock: stock ?? null,
          category: productCategory.trim() || null,
        });
      } else {
        await addProduct({
          name,
          price,
          barcode: productBarcode.trim() || undefined,
          stock,
          category: productCategory.trim() || undefined,
        });
      }
      closeSheet();
    } catch (e: any) {
      Alert.alert("Erreur", e?.message ?? "Erreur lors de la sauvegarde.");
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (product: LocalProduct) => {
    setEditingProduct(product);
    setProductName(product.name);
    setProductPrice(product.price.toString());
    setProductBarcode(product.barcode ?? "");
    setProductStock(product.stock?.toString() ?? "");
    setProductCategory(product.category ?? "");
    setSheetMode("edit-product");
  };

  const handleDeleteProduct = (product: LocalProduct) => {
    Alert.alert(
      "Supprimer le produit",
      `Voulez-vous supprimer "${product.name}" du catalogue ?`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: async () => { await removeProduct(product.id); } },
      ]
    );
  };

  const saleTotal = (parseInt(salePrice, 10) || 0) * (parseInt(saleQty, 10) || 0);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* ── Header ── */}
      <LinearGradient colors={["#191970", "#0d0d5c", "#0B0B3F"]} style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View style={styles.bubbleDecorative1} />
        <View style={styles.bubbleDecorative2} />
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Caisse & Ventes</Text>
            <Text style={styles.headerSub}>Gestion catalogue & ventes directes</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerBtn} onPress={() => setScannerVisible(true)}>
              <Camera size={18} color="#FFD700" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn} onPress={() => setSheetMode("new-product")}>
              <Plus size={18} color="#FFD700" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.headerStats}>
          <View style={styles.statPill}>
            <ShoppingCart size={14} color="#FFD700" />
            <Text style={styles.statPillText}>{todaySales.length} vente{todaySales.length !== 1 ? "s" : ""}</Text>
          </View>
          <View style={styles.statPillBig}>
            <TrendingUp size={14} color="#FFD700" />
            <Text style={styles.statPillBigText}>{formatAmount(totalToday)} FCFA</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* ── Quick Actions ── */}
        <View style={styles.quickSection}>
          <TouchableOpacity
            style={styles.quickCardPrimary}
            onPress={() => { resetSaleForm(); setSheetMode("sale"); }}
            activeOpacity={0.85}
          >
            <LinearGradient colors={["#191970", "#0d0d5c"]} style={styles.quickCardGradient}>
              <View style={styles.quickIconPrimary}>
                <ShoppingCart size={20} color="#FFD700" />
              </View>
              <Text style={styles.quickLabelPrimary}>Vente rapide</Text>
              <Text style={styles.quickSubPrimary}>Enregistrement express</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setScannerVisible(true)}
            activeOpacity={0.75}
          >
            <View style={[styles.quickIcon, { backgroundColor: "rgba(25,25,112,0.08)" }]}>
              <Barcode size={20} color="#191970" />
            </View>
            <Text style={[styles.quickLabel, { color: colors.text }]}>Scanner Vente</Text>
            <Text style={[styles.quickSub, { color: colors.muted }]}>Scan code-barres</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickCard, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setSheetMode("catalog")}
            activeOpacity={0.75}
          >
            <View style={[styles.quickIcon, { backgroundColor: "rgba(25,25,112,0.08)" }]}>
              <Archive size={20} color="#191970" />
            </View>
            <Text style={[styles.quickLabel, { color: colors.text }]}>Catalogue</Text>
            <Text style={[styles.quickSub, { color: colors.muted }]}>{products.length} produit{products.length !== 1 ? "s" : ""}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Today's Sales ── */}
        <View style={{ paddingHorizontal: 20, marginTop: 8 }}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Ventes d'aujourd'hui</Text>
          {todaySales.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <ShoppingCart size={32} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>Aucune vente aujourd'hui</Text>
              <Text style={{ color: colors.muted, fontSize: 12, fontFamily: "Poppins_400Regular", textAlign: "center" }}>
                Scannez un code-barres ou choisissez un produit du catalogue
              </Text>
            </View>
          ) : (
            todaySales.map((sale) => (
              <SaleRow key={sale.id} sale={sale} colors={colors} />
            ))
          )}
        </View>

        {/* ── Products Preview ── */}
        <View style={{ paddingHorizontal: 20, marginTop: 24 }}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>Catalogue ({products.length})</Text>
            <TouchableOpacity onPress={() => setSheetMode("catalog")}>
              <Text style={{ color: colors.accent, fontSize: 13, fontFamily: "Poppins_600SemiBold" }}>Voir tout</Text>
            </TouchableOpacity>
          </View>
          {products.length === 0 ? (
            <TouchableOpacity style={[styles.emptyBox, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => setSheetMode("new-product")}>
              <Package size={32} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.muted }]}>Aucun produit</Text>
              <Text style={{ color: colors.primary, fontSize: 13, fontFamily: "Poppins_600SemiBold", marginTop: 4 }}>+ Créer un produit</Text>
            </TouchableOpacity>
          ) : (
            products.slice(0, 4).map((product) => (
              <ProductRow
                key={product.id}
                product={product}
                colors={colors}
                onPress={() => openSaleForProduct(product)}
                onEdit={() => openEdit(product)}
                onDelete={() => handleDeleteProduct(product)}
              />
            ))
          )}
        </View>
      </ScrollView>

      {/* ══ MODALS ══════════════════════════════════════════════════════════ */}

      {/* Scanner Modal principal */}
      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={handleBarCodeScanned}
        colors={colors}
        title="Scanner pour vendre"
      />

      {/* Quick Sale Modal (triggered after scan) */}
      <QuickSaleModal
        visible={quickSaleVisible}
        onClose={() => {
          setQuickSaleVisible(false);
          setScannedBarcode(null);
        }}
        barcode={scannedBarcode}
        colors={colors}
      />

      {/* Catalog Modal */}
      <Modal visible={sheetMode === "catalog"} transparent animationType="slide" onRequestClose={closeSheet}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeSheet} />
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.keyboardView}
          >
            <View style={[styles.sheet, styles.sheetTall, { backgroundColor: colors.background, paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 20 }]}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeaderRow}>
                <Text style={[styles.sheetTitle, { color: colors.primary }]}>Catalogue</Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: colors.primary }]}
                    onPress={() => { resetProductForm(); setSheetMode("new-product"); }}
                  >
                    <Plus size={16} color="#FFD700" />
                    <Text style={{ color: "#FFD700", fontSize: 13, fontFamily: "Poppins_600SemiBold" }}>Ajouter</Text>
                  </TouchableOpacity>
                   <TouchableOpacity onPress={closeSheet} style={styles.closeBtn}><X size={18} color={colors.muted} /></TouchableOpacity>
                </View>
              </View>

              <View style={[styles.phoneRow, { backgroundColor: colors.input, borderColor: colors.border, marginBottom: 12 }]}>
                <Search size={16} color={colors.muted} />
                <TextInput
                  style={[styles.phoneInput, { color: colors.text }]}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Rechercher un produit..."
                  placeholderTextColor={colors.muted}
                />
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {filteredProducts.length === 0 ? (
                  <View style={{ alignItems: "center", padding: 30, gap: 8 }}>
                    <Package size={40} color={colors.muted} />
                    <Text style={{ color: colors.muted, fontFamily: "Poppins_400Regular" }}>
                      {searchQuery ? "Aucun produit trouvé" : "Catalogue vide"}
                    </Text>
                  </View>
                ) : (
                  filteredProducts.map((product) => (
                    <ProductRow
                      key={product.id}
                      product={product}
                      colors={colors}
                      onPress={() => openSaleForProduct(product)}
                      onEdit={() => openEdit(product)}
                      onDelete={() => handleDeleteProduct(product)}
                    />
                  ))
                )}
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* New / Edit Product Modal */}
      <Modal visible={sheetMode === "new-product" || sheetMode === "edit-product"} transparent animationType="slide" onRequestClose={closeSheet}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeSheet} />
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.keyboardView}
          >
            <View style={[styles.sheet, styles.sheetTall, { backgroundColor: colors.background, paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 20 }]}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeaderRow}>
                <Text style={[styles.sheetTitle, { color: colors.primary }]}>
                  {editingProduct ? "Modifier le produit" : "Ajouter au catalogue"}
                </Text>
                <TouchableOpacity onPress={closeSheet} style={styles.closeBtn}><X size={18} color={colors.muted} /></TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={{ gap: 14 }}>
                  <View>
                    <FieldLabel label="NOM DU PRODUIT" colors={colors} required />
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                      value={productName}
                      onChangeText={setProductName}
                      placeholder="Ex: Coca-Cola 33cl, Pain..."
                      placeholderTextColor={colors.muted}
                    />
                  </View>

                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <FieldLabel label="PRIX (FCFA)" colors={colors} required />
                      <TextInput
                        style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                        value={productPrice}
                        onChangeText={(t) => setProductPrice(t.replace(/[^0-9]/g, ""))}
                        placeholder="Ex: 500"
                        placeholderTextColor={colors.muted}
                        keyboardType="number-pad"
                      />
                    </View>
                  </View>

                  <FieldLabel label="CODE-BARRES (optionnel)" colors={colors} />
                  <View style={[styles.phoneRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
                    <Barcode size={16} color={colors.primary} />
                    <TextInput
                      style={[styles.phoneInput, { color: colors.text }]}
                      value={productBarcode}
                      onChangeText={setProductBarcode}
                      placeholder="Ex: 6414202001231"
                      placeholderTextColor={colors.muted}
                      keyboardType="default"
                    />
                  </View>

                  <FieldLabel label="CATÉGORIE (optionnel)" colors={colors} />
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                    value={productCategory}
                    onChangeText={setProductCategory}
                    placeholder="Ex: Boissons, Alimentation..."
                    placeholderTextColor={colors.muted}
                  />

                  <TouchableOpacity
                    style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1, marginTop: 8 }]}
                    onPress={handleSaveProduct}
                    disabled={loading}
                  >
                    <Text style={[styles.submitBtnText, { color: "#FFD700" }]}>
                      {loading ? "Enregistrement..." : editingProduct ? "Enregistrer les modifications" : "Ajouter au catalogue"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Sale Modal standard */}
      <Modal visible={sheetMode === "sale"} transparent animationType="slide" onRequestClose={closeSheet}>
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeSheet} />
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.keyboardView}
          >
            <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 20 }]}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeaderRow}>
                <Text style={[styles.sheetTitle, { color: colors.primary }]}>Enregistrer une vente</Text>
                <TouchableOpacity onPress={closeSheet} style={styles.closeBtn}><X size={18} color={colors.muted} /></TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={{ gap: 14, paddingTop: 4 }}>
                  {selectedProduct && (
                    <View style={[styles.selectedProductBadge, { backgroundColor: "rgba(25,25,112,0.07)", borderColor: colors.primary }]}>
                      <Tag size={14} color={colors.primary} />
                      <Text style={{ color: colors.primary, fontFamily: "Poppins_600SemiBold", fontSize: 13, flex: 1, marginLeft: 6 }} numberOfLines={1}>
                        {selectedProduct.name}
                      </Text>
                      <TouchableOpacity onPress={() => { setSelectedProduct(null); setSaleProductName(""); setSalePrice(""); }}>
                        <X size={14} color={colors.muted} />
                      </TouchableOpacity>
                    </View>
                  )}

                  <View>
                    <FieldLabel label="PRODUIT" colors={colors} required />
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                      value={saleProductName}
                      onChangeText={(t) => { setSaleProductName(t); if (selectedProduct) setSelectedProduct(null); }}
                      placeholder="Nom du produit vendu"
                      placeholderTextColor={colors.muted}
                    />
                  </View>

                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <FieldLabel label="PRIX UNITAIRE (FCFA)" colors={colors} required />
                      <TextInput
                        style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                        value={salePrice}
                        onChangeText={(t) => setSalePrice(t.replace(/[^0-9]/g, ""))}
                        placeholder="500"
                        placeholderTextColor={colors.muted}
                        keyboardType="number-pad"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <FieldLabel label="QUANTITÉ" colors={colors} required />
                      <View style={[styles.qtyRow, { backgroundColor: colors.input, borderColor: colors.border }]}>
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => setSaleQty((q) => Math.max(1, parseInt(q, 10) - 1).toString())}>
                          <Text style={[styles.qtyBtnText, { color: colors.primary }]}>−</Text>
                        </TouchableOpacity>
                        <TextInput
                          style={[styles.qtyInput, { color: colors.text }]}
                          value={saleQty}
                          onChangeText={(t) => setSaleQty(t.replace(/[^0-9]/g, "") || "1")}
                          keyboardType="number-pad"
                          textAlign="center"
                        />
                        <TouchableOpacity style={styles.qtyBtn} onPress={() => setSaleQty((q) => (parseInt(q, 10) + 1).toString())}>
                          <Text style={[styles.qtyBtnText, { color: colors.primary }]}>+</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  {saleTotal > 0 && (
                    <View style={[styles.totalBadge, { backgroundColor: "rgba(25,25,112,0.05)", borderColor: colors.primary, borderWidth: 1 }]}>
                      <Text style={{ color: colors.muted, fontFamily: "Poppins_600SemiBold", fontSize: 14 }}>Total :</Text>
                      <Text style={{ color: colors.primary, fontFamily: "Poppins_700Bold", fontSize: 18 }}>
                        {formatAmount(saleTotal)} FCFA
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
                    onPress={handleRecordSale}
                    disabled={loading}
                  >
                    <ShoppingCart size={18} color="#FFD700" />
                    <Text style={[styles.submitBtnText, { color: "#FFD700", marginLeft: 8 }]}>
                      {loading ? "Enregistrement..." : "Enregistrer la vente"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

function FieldLabel({ label, colors, required }: { label: string; colors: any; required?: boolean }) {
  return (
    <View style={{ flexDirection: "row" }}>
      <Text style={[styles.label, { color: colors.muted }]}>{label}</Text>
      {required && <Text style={{ color: "#ef4444", fontSize: 12, marginLeft: 2 }}>*</Text>}
    </View>
  );
}

function ProductRow({
  product,
  colors,
  onPress,
  onEdit,
  onDelete,
}: {
  product: LocalProduct;
  colors: any;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View
      style={[
        styles.productCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderLeftColor: colors.primary,
        },
      ]}
    >
      <TouchableOpacity style={styles.productCardMain} onPress={onPress} activeOpacity={0.75}>
        <View style={[styles.productIcon, { backgroundColor: "rgba(25,25,112,0.08)" }]}>
          <Package size={18} color="#191970" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.productName, { color: colors.text }]} numberOfLines={1}>
            {product.name}
          </Text>
          <View style={{ flexDirection: "row", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
            {product.category && (
              <View style={styles.tagPill}>
                <Text style={styles.tagPillText}>{product.category}</Text>
              </View>
            )}
            {product.barcode && (
              <Text style={[styles.productTag, { color: colors.muted }]}>#{product.barcode}</Text>
            )}
          </View>
        </View>
        <Text style={[styles.productPrice, { color: colors.primary }]}>
          {formatAmount(product.price)}
          <Text style={{ fontSize: 11, fontFamily: "Poppins_600SemiBold" }}> FCFA</Text>
        </Text>
      </TouchableOpacity>
      <View style={styles.productActions}>
        <TouchableOpacity style={styles.productActionBtn} onPress={onEdit}>
          <Edit3 size={15} color={colors.muted} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.productActionBtn} onPress={onDelete}>
          <Trash2 size={15} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function SaleRow({ sale, colors }: { sale: LocalProductSale; colors: any }) {
  return (
    <View
      style={[
        styles.saleCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderLeftColor: "#16a34a",
        },
      ]}
    >
      <View style={[styles.saleIconWrap, { backgroundColor: "rgba(22,163,74,0.1)" }]}>
        <ShoppingCart size={16} color="#16a34a" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.saleName, { color: colors.text }]} numberOfLines={1}>
          {sale.productName}
        </Text>
        <Text style={[styles.saleMeta, { color: colors.muted }]}>
          {sale.quantity}× {formatAmount(sale.unitPrice)} F • {formatTime(sale.createdAt)}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[styles.saleTotal, { color: "#16a34a" }]}>+{formatAmount(sale.totalPrice)}</Text>
        <Text style={{ color: colors.accent, fontSize: 10, fontFamily: "Poppins_600SemiBold" }}>FCFA</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Header
  header: { paddingHorizontal: 20, paddingBottom: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, position: "relative", overflow: "hidden" },
  bubbleDecorative1: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255, 215, 0, 0.08)",
  },
  bubbleDecorative2: {
    position: "absolute",
    bottom: -30,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerTitle: { fontSize: 24, fontFamily: "Poppins_700Bold", color: "#FFFFFF", letterSpacing: -0.3 },
  headerSub: { fontSize: 12, fontFamily: "Poppins_400Regular", color: "rgba(255,255,255,0.7)", marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 10 },
  headerBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  headerStats: { flexDirection: "row", gap: 10, marginTop: 16 },
  statPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  statPillText: { color: "#FFFFFF", fontFamily: "Poppins_600SemiBold", fontSize: 12 },
  statPillBig: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,215,0,0.2)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7 },
  statPillBigText: { color: "#FFD700", fontFamily: "Poppins_700Bold", fontSize: 13 },

  // Quick actions
  quickSection: { flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingTop: 20 },
  quickCardPrimary: { flex: 1, borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  quickCardGradient: { padding: 14, gap: 6, minHeight: 105, justifyContent: "center" },
  quickIconPrimary: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,215,0,0.2)", marginBottom: 2 },
  quickLabelPrimary: { fontSize: 13, fontFamily: "Poppins_700Bold", color: "#FFFFFF" },
  quickSubPrimary: { fontSize: 11, fontFamily: "Poppins_400Regular", color: "rgba(255,255,255,0.7)" },

  quickCard: { flex: 1, borderRadius: 16, borderWidth: 1.5, padding: 14, gap: 6, minHeight: 105, justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  quickIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  quickLabel: { fontSize: 13, fontFamily: "Poppins_700Bold" },
  quickSub: { fontSize: 11, fontFamily: "Poppins_400Regular" },

  // Section
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontFamily: "Poppins_700Bold" },

  // Empty
  emptyBox: { borderRadius: 16, borderWidth: 1.5, padding: 28, alignItems: "center", gap: 10 },
  emptyText: { fontSize: 15, fontFamily: "Poppins_600SemiBold" },

  // Product card
  productCard: { flexDirection: "row", borderRadius: 16, borderWidth: 1, borderLeftWidth: 4, marginBottom: 10, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  productCardMain: { flex: 1, flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  productIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  productName: { fontSize: 15, fontFamily: "Poppins_600SemiBold" },
  productTag: { fontSize: 11, fontFamily: "Poppins_400Regular" },
  tagPill: { backgroundColor: "rgba(0,0,0,0.05)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  tagPillText: { fontSize: 10, fontFamily: "Poppins_600SemiBold", color: "#555" },
  productPrice: { fontSize: 16, fontFamily: "Poppins_700Bold" },
  productActions: { justifyContent: "center", borderLeftWidth: 1, borderLeftColor: "rgba(0,0,0,0.06)", paddingHorizontal: 4 },
  productActionBtn: { padding: 8 },

  // Sale card
  saleCard: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 16, borderWidth: 1, borderLeftWidth: 4, marginBottom: 10, gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  saleIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  saleName: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  saleMeta: { fontSize: 12, fontFamily: "Poppins_400Regular", marginTop: 2 },
  saleTotal: { fontSize: 16, fontFamily: "Poppins_700Bold" },

  // Sheet
  modalContainer: { flex: 1, justifyContent: "flex-end" },
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.58)" },
  keyboardView: { justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 10,
  },
  sheetTall: { maxHeight: "85%" },
  sheetHandle: { width: 50, height: 5, backgroundColor: "#DDDDE8", borderRadius: 3, alignSelf: "center", marginBottom: 8 },
  sheetHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheetTitle: { fontSize: 20, fontFamily: "Poppins_700Bold", letterSpacing: -0.3 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(0,0,0,0.06)", alignItems: "center", justifyContent: "center" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },

  // Form
  label: { fontSize: 11, fontFamily: "Poppins_600SemiBold", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 6, marginTop: 2, opacity: 0.6 },
  input: { height: 54, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 14, fontSize: 15, fontFamily: "Poppins_400Regular" },
  phoneRow: { flexDirection: "row", alignItems: "center", borderRadius: 16, borderWidth: 1.5, height: 54, paddingHorizontal: 14, gap: 10 },
  phoneInput: { flex: 1, fontSize: 15, fontFamily: "Poppins_400Regular" },

  // Quantity selector
  qtyRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, height: 52, overflow: "hidden" },
  qtyBtn: { width: 44, height: "100%", alignItems: "center", justifyContent: "center" },
  qtyBtnText: { fontSize: 22, fontFamily: "Poppins_700Bold" },
  qtyInput: { flex: 1, fontSize: 17, fontFamily: "Poppins_700Bold" },

  // Total badge
  totalBadge: { borderRadius: 12, padding: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  // Selected product badge
  selectedProductBadge: { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, gap: 6 },

  // Barcode
  barcodeBox: { height: 100, borderRadius: 16, borderWidth: 1.5, borderStyle: "dashed", alignItems: "center", justifyContent: "center", gap: 4 },
  notFoundBox: { borderRadius: 12, borderWidth: 1, padding: 14 },
  foundBox: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, padding: 12 },

  // Submit
  submitBtn: { height: 56, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  submitBtnText: { fontSize: 15, fontFamily: "Poppins_700Bold" },
});

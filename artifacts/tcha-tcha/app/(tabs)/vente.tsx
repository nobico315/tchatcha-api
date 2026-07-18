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
      <LinearGradient colors={["#191970", "#0B0B3F"]} style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Ventes</Text>
            <Text style={styles.headerSub}>Catalogue & caisse rapide</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerBtn} onPress={() => setScannerVisible(true)}>
              <Camera size={20} color="#FFD700" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn} onPress={() => setSheetMode("new-product")}>
              <Plus size={20} color="#FFD700" />
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
          <TouchableOpacity style={[styles.quickCard, { backgroundColor: "#191970" }]} onPress={() => { resetSaleForm(); setSheetMode("sale"); }}>
            <View style={styles.quickIcon}><ShoppingCart size={22} color="#FFD700" /></View>
            <Text style={styles.quickLabel}>Vente rapide</Text>
            <Text style={styles.quickSub}>Sans catalogue</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]} onPress={() => setScannerVisible(true)}>
            <View style={[styles.quickIcon, { backgroundColor: "rgba(25,25,112,0.08)" }]}><Barcode size={22} color="#191970" /></View>
            <Text style={[styles.quickLabel, { color: colors.text }]}>Scanner Vente</Text>
            <Text style={[styles.quickSub, { color: colors.muted }]}>Scan direct caisse</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]} onPress={() => setSheetMode("catalog")}>
            <View style={[styles.quickIcon, { backgroundColor: "rgba(25,25,112,0.08)" }]}><Archive size={22} color="#191970" /></View>
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
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeSheet} />
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
              <TouchableOpacity onPress={closeSheet}><X size={22} color={colors.muted} /></TouchableOpacity>
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

          <ScrollView showsVerticalScrollIndicator={false}>
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
      </Modal>

      {/* New / Edit Product Modal */}
      <Modal visible={sheetMode === "new-product" || sheetMode === "edit-product"} transparent animationType="slide" onRequestClose={closeSheet}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeSheet} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, justifyContent: "flex-end" }}>
          <View style={[styles.sheet, styles.sheetTall, { backgroundColor: colors.background, paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 20 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeaderRow}>
              <Text style={[styles.sheetTitle, { color: colors.primary }]}>
                {editingProduct ? "Modifier le produit" : "Ajouter au catalogue"}
              </Text>
              <TouchableOpacity onPress={closeSheet}><X size={22} color={colors.muted} /></TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
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
                  <View style={{ flex: 1 }}>
                    <FieldLabel label="STOCK INITIAL (opt.)" colors={colors} />
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                      value={productStock}
                      onChangeText={(t) => setProductStock(t.replace(/[^0-9]/g, ""))}
                      placeholder="Ex: 10"
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
      </Modal>

      {/* Sale Modal standard */}
      <Modal visible={sheetMode === "sale"} transparent animationType="slide" onRequestClose={closeSheet}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={closeSheet} />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 20 }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeaderRow}>
              <Text style={[styles.sheetTitle, { color: colors.primary }]}>Enregistrer une vente</Text>
              <TouchableOpacity onPress={closeSheet}><X size={22} color={colors.muted} /></TouchableOpacity>
            </View>

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

            <FieldLabel label="PRODUIT" colors={colors} required />
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
              value={saleProductName}
              onChangeText={(t) => { setSaleProductName(t); if (selectedProduct) setSelectedProduct(null); }}
              placeholder="Nom du produit vendu"
              placeholderTextColor={colors.muted}
            />

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
        </KeyboardAvoidingView>
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
    <View style={[styles.productCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TouchableOpacity style={styles.productCardMain} onPress={onPress}>
        <View style={[styles.productIcon, { backgroundColor: "rgba(25,25,112,0.08)" }]}>
          <Package size={18} color="#191970" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.productName, { color: colors.text }]} numberOfLines={1}>{product.name}</Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 2, flexWrap: "wrap" }}>
            {product.category && (
              <Text style={[styles.productTag, { color: colors.muted }]}>{product.category}</Text>
            )}
            {product.barcode && (
              <Text style={[styles.productTag, { color: colors.muted }]}>#{product.barcode}</Text>
            )}
            {product.stock !== null && product.stock !== undefined && (
              <Text style={[styles.productTag, { color: product.stock <= 5 ? "#ef4444" : colors.muted }]}>
                Stock: {product.stock}
              </Text>
            )}
          </View>
        </View>
        <Text style={[styles.productPrice, { color: colors.primary }]}>{formatAmount(product.price)}<Text style={{ fontSize: 11 }}> F</Text></Text>
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
    <View style={[styles.saleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.saleIconWrap, { backgroundColor: "rgba(26,122,74,0.1)" }]}>
        <ShoppingCart size={16} color="#1a7a4a" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.saleName, { color: colors.text }]} numberOfLines={1}>{sale.productName}</Text>
        <Text style={[styles.saleMeta, { color: colors.muted }]}>
          {sale.quantity}× {formatAmount(sale.unitPrice)} F • {formatTime(sale.createdAt)}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={[styles.saleTotal, { color: "#1a7a4a" }]}>{formatAmount(sale.totalPrice)}</Text>
        <Text style={{ color: colors.muted, fontSize: 10, fontFamily: "Poppins_400Regular" }}>FCFA</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Header
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerTitle: { fontSize: 26, fontFamily: "Poppins_700Bold", color: "#FFFFFF" },
  headerSub: { fontSize: 13, fontFamily: "Poppins_400Regular", color: "rgba(255,255,255,0.6)", marginTop: 2 },
  headerActions: { flexDirection: "row", gap: 10 },
  headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,215,0,0.15)", alignItems: "center", justifyContent: "center" },
  headerStats: { flexDirection: "row", gap: 10, marginTop: 16 },
  statPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  statPillText: { color: "rgba(255,255,255,0.85)", fontFamily: "Poppins_600SemiBold", fontSize: 12 },
  statPillBig: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,215,0,0.2)", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  statPillBigText: { color: "#FFD700", fontFamily: "Poppins_700Bold", fontSize: 13 },

  // Quick actions
  quickSection: { flexDirection: "row", gap: 12, paddingHorizontal: 20, paddingTop: 20 },
  quickCard: { flex: 1, borderRadius: 16, padding: 14, gap: 6, minHeight: 100, justifyContent: "center" },
  quickIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,215,0,0.15)", marginBottom: 2 },
  quickLabel: { fontSize: 13, fontFamily: "Poppins_700Bold", color: "#FFFFFF" },
  quickSub: { fontSize: 11, fontFamily: "Poppins_400Regular", color: "rgba(255,255,255,0.65)" },

  // Section
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontFamily: "Poppins_700Bold" },

  // Empty
  emptyBox: { borderRadius: 16, borderWidth: 1, padding: 28, alignItems: "center", gap: 10 },
  emptyText: { fontSize: 15, fontFamily: "Poppins_600SemiBold" },

  // Product card
  productCard: { flexDirection: "row", borderRadius: 14, borderWidth: 1, marginBottom: 10, overflow: "hidden" },
  productCardMain: { flex: 1, flexDirection: "row", alignItems: "center", padding: 12, gap: 10 },
  productIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  productName: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  productTag: { fontSize: 11, fontFamily: "Poppins_400Regular" },
  productPrice: { fontSize: 16, fontFamily: "Poppins_700Bold" },
  productActions: { justifyContent: "center", borderLeftWidth: 1, borderLeftColor: "rgba(0,0,0,0.06)", paddingHorizontal: 6 },
  productActionBtn: { padding: 8 },

  // Sale card
  saleCard: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8, gap: 10 },
  saleIconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  saleName: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  saleMeta: { fontSize: 12, fontFamily: "Poppins_400Regular", marginTop: 1 },
  saleTotal: { fontSize: 15, fontFamily: "Poppins_700Bold" },

  // Sheet
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 14 },
  sheetTall: { maxHeight: "85%" },
  sheetHandle: { width: 40, height: 4, backgroundColor: "#E0E0E0", borderRadius: 2, alignSelf: "center", marginBottom: 8 },
  sheetHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sheetTitle: { fontSize: 20, fontFamily: "Poppins_700Bold" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },

  // Form
  label: { fontSize: 11, fontFamily: "Poppins_600SemiBold", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 6, marginTop: 2 },
  input: { height: 52, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 15, fontFamily: "Poppins_400Regular" },
  phoneRow: { flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1, height: 52, paddingHorizontal: 14, gap: 10 },
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

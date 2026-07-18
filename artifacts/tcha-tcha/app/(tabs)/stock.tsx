import React, { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Archive, Barcode, Camera, Plus, Search, X, Edit3, Trash2, CheckCircle, Package, TrendingUp, ShoppingCart } from "lucide-react-native";
import { useColors } from "@/hooks/useColors";
import { useProducts, LocalProduct, LocalProductSale } from "@/context/ProductContext";
import { formatAmount, formatTime, formatShortDate } from "@/utils/format";
import BarcodeScannerModal from "@/components/BarcodeScannerModal";
import QuickStockModal from "@/components/QuickStockModal";

export default function StockPage() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { products, sales, addProduct, editProduct, removeProduct, isOnline, searchProducts, findProductByBarcode } = useProducts();

  const [activeTab, setActiveTab] = useState<"inventory" | "reports">("inventory");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Stock add scan state
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [quickStockVisible, setQuickStockVisible] = useState(false);

  // Formulaire d'édition/ajout standard
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<LocalProduct | null>(null);
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productStock, setProductStock] = useState("");
  const [productBarcode, setProductBarcode] = useState("");
  const [productCategory, setProductCategory] = useState("");
  
  // Nouveaux states de prix d'achat
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseType, setPurchaseType] = useState<"detail" | "gros">("detail");

  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeResult, setBarcodeResult] = useState<LocalProduct | null | "not-found" >(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  const filteredProducts = useMemo(() => searchProducts(searchQuery), [searchProducts, searchQuery]);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const resetForm = () => {
    setEditingProduct(null);
    setProductName("");
    setProductPrice("");
    setProductStock("");
    setProductBarcode("");
    setProductCategory("");
    setPurchasePrice("");
    setPurchaseType("detail");
  };

  const openNewProduct = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditProduct = (product: LocalProduct) => {
    setEditingProduct(product);
    setProductName(product.name);
    setProductPrice(product.price.toString());
    setProductStock(product.stock?.toString() ?? "");
    setProductBarcode(product.barcode ?? "");
    setProductCategory(product.category ?? "");
    
    // Décoder le prix d'achat
    setPurchasePrice("");
    setPurchaseType("detail");
    if (product.description) {
      try {
        const meta = JSON.parse(product.description);
        if (meta.purchasePrice !== undefined) {
          setPurchasePrice(meta.purchasePrice.toString());
          setPurchaseType(meta.purchaseType || "detail");
        }
      } catch {
        // Pas du JSON valide, on laisse vide
      }
    }
    setShowForm(true);
  };

  const handleSave = async () => {
    const name = productName.trim();
    const price = parseInt(productPrice, 10);
    const stock = productStock.trim() ? parseInt(productStock, 10) : undefined;
    const pPrice = parseInt(purchasePrice, 10) || 0;

    if (!name) { Alert.alert("Erreur", "Le nom du produit est requis."); return; }
    if (!price || price <= 0) { Alert.alert("Erreur", "Le prix doit être un montant valide."); return; }

    setLoading(true);

    // Encodage en JSON dans la description
    const descJson = JSON.stringify({
      purchasePrice: pPrice,
      purchaseType: purchaseType
    });

    try {
      if (editingProduct) {
        await editProduct(editingProduct.id, {
          name,
          price,
          barcode: productBarcode.trim() || null,
          stock: stock ?? null,
          category: productCategory.trim() || null,
          description: descJson,
        });
      } else {
        await addProduct({
          name,
          price,
          barcode: productBarcode.trim() || undefined,
          stock,
          category: productCategory.trim() || undefined,
          description: descJson,
        });
      }
      setShowForm(false);
      resetForm();
    } catch (error: any) {
      Alert.alert("Erreur", error?.message ?? "Impossible d'enregistrer le produit.");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = (product: LocalProduct) => {
    Alert.alert(
      "Supprimer le produit",
      `Voulez-vous supprimer ${product.name} ?`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: async () => await removeProduct(product.id) },
      ]
    );
  };

  const handleBarcodeSearch = async () => {
    if (!barcodeInput.trim()) return;
    const found = await findProductByBarcode(barcodeInput.trim());
    if (found) {
      setBarcodeResult(found);
      setSearchQuery(found.name);
    } else {
      setBarcodeResult("not-found");
    }
  };

  const handleBarCodeScanned = (barcode: string) => {
    setScannedBarcode(barcode);
    setQuickStockVisible(true);
  };

  const handleUseBarcodeProduct = (product: LocalProduct) => {
    openEditProduct(product);
  };

  const totalRevenue = useMemo(() => sales.reduce((sum, s) => sum + s.totalPrice, 0), [sales]);
  const totalQuantitySold = useMemo(() => sales.reduce((sum, s) => sum + s.quantity, 0), [sales]);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}>
        <View>
          <Text style={[styles.title, { color: colors.primary }]}>Gestion de stock</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Catalogue produit et codes-barres</Text>
        </View>
        {activeTab === "inventory" && (
          <View style={{ flexDirection: "row", gap: 10, alignSelf: "flex-end" }}>
            <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={() => setScannerVisible(true)} activeOpacity={0.8}>
              <Camera size={20} color="#FFD700" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.addButton, { backgroundColor: colors.primary }]} onPress={openNewProduct} activeOpacity={0.8}>
              <Plus size={20} color="#FFD700" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Tabs */}
      <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "inventory" && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
          onPress={() => setActiveTab("inventory")}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, { color: activeTab === "inventory" ? colors.primary : colors.muted }]}>
            Inventaire
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "reports" && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
          onPress={() => setActiveTab("reports")}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabText, { color: activeTab === "reports" ? colors.primary : colors.muted }]}>
            Rapports des ventes
          </Text>
        </TouchableOpacity>
      </View>

      {/* INVENTORY TAB */}
      {activeTab === "inventory" && (
        <FlatList<LocalProduct>
          data={filteredProducts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 120 }}
          ListHeaderComponent={
            <>
              <View style={[styles.searchBox, { backgroundColor: colors.input, borderColor: colors.border }]}>
                <Search size={18} color={colors.muted} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="Rechercher produit ou code-barres"
                  placeholderTextColor={colors.muted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              </View>

              <View style={[styles.barcodeRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.barcodeIcon}><Barcode size={20} color={colors.primary} /></View>
                <TextInput
                  style={[styles.barcodeInput, { color: colors.text }]}
                  value={barcodeInput}
                  onChangeText={(text) => { setBarcodeInput(text); setBarcodeResult(null); }}
                  placeholder="Scanner ou saisir un code-barres"
                  placeholderTextColor={colors.muted}
                  keyboardType="default"
                  onSubmitEditing={handleBarcodeSearch}
                />
                <TouchableOpacity onPress={() => setScannerVisible(true)} activeOpacity={0.7} style={styles.barcodeScanButton}>
                  <Camera size={18} color={colors.accent} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleBarcodeSearch} activeOpacity={0.7} style={styles.barcodeSearchButton}>
                  <Text style={[styles.barcodeSearchText, { color: colors.accent }]}>OK</Text>
                </TouchableOpacity>
              </View>

              {barcodeResult === "not-found" && (
                <View style={[styles.barcodeResult, { backgroundColor: "#fff8e1", borderColor: "#ffd54f" }]}>
                  <Text style={[styles.barcodeResultTitle, { color: "#795548" }]}>Produit introuvable</Text>
                  <Text style={[styles.barcodeResultText, { color: "#795548" }]}>Vous pouvez créer le produit manuellement.</Text>
                  <TouchableOpacity style={[styles.barcodeButton, { backgroundColor: colors.primary }]} onPress={() => { setProductBarcode(barcodeInput); openNewProduct(); }}>
                    <Text style={[styles.barcodeButtonText, { color: "#FFD700" }]}>Créer ce produit</Text>
                  </TouchableOpacity>
                </View>
              )}

              {barcodeResult && barcodeResult !== "not-found" && (
                <View style={[styles.barcodeResult, { backgroundColor: "#eafaf0", borderColor: "#1a7a4a" }]}>
                  <CheckCircle size={20} color="#1a7a4a" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={[styles.barcodeResultTitle, { color: "#1a7a4a" }]}>{barcodeResult.name}</Text>
                    <Text style={[styles.barcodeResultText, { color: "#1a7a4a" }]}>Prix: {formatAmount(barcodeResult.price)} FCFA • Stock actuel: {barcodeResult.stock ?? 0}</Text>
                  </View>
                  <TouchableOpacity style={[styles.barcodeButton, { backgroundColor: "#1a7a4a" }]} onPress={() => handleUseBarcodeProduct(barcodeResult)}>
                    <Text style={[styles.barcodeButtonText, { color: "#fff" }]}>Gérer</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          }
          renderItem={({ item }) => (
            <View style={[styles.productCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.productInfo}>
                <Text style={[styles.productName, { color: colors.text }]}>{item.name}</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                  {item.category && (
                    <Text style={[styles.productMeta, { color: colors.muted }]}>{item.category} •</Text>
                  )}
                  <Text style={[styles.productMeta, { color: colors.muted }]}>{formatAmount(item.price)} FCFA</Text>
                  {item.barcode && (
                    <Text style={[styles.productMeta, { color: colors.primary }]}> • Code: {item.barcode}</Text>
                  )}
                </View>
              </View>
              <View style={styles.stockBadgeContainer}>
                <View style={[styles.stockBadge, { backgroundColor: (item.stock ?? 0) <= 5 ? "rgba(239, 68, 68, 0.1)" : "rgba(25, 25, 112, 0.08)" }]}>
                  <Text style={[styles.stockText, { color: (item.stock ?? 0) <= 5 ? "#ef4444" : colors.primary }]}>
                    Qté: {item.stock ?? 0}
                  </Text>
                </View>
                <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => openEditProduct(item)}>
                    <Edit3 size={16} color={colors.muted} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleRemove(item)}>
                    <Trash2 size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        />
      )}

      {/* REPORTS TAB */}
      {activeTab === "reports" && (
        <FlatList<LocalProductSale>
          data={sales}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 120 }}
          ListHeaderComponent={
            <>
              {/* Stats Grid */}
              <View style={styles.statsGrid}>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <TrendingUp size={22} color={colors.accent} />
                  <Text style={[styles.statVal, { color: colors.text }]}>{formatAmount(totalRevenue)} F</Text>
                  <Text style={[styles.statLbl, { color: colors.muted }]}>Revenus</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Package size={22} color={colors.primary} />
                  <Text style={[styles.statVal, { color: colors.text }]}>{totalQuantitySold}</Text>
                  <Text style={[styles.statLbl, { color: colors.muted }]}>Qté vendue</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <ShoppingCart size={22} color="#1a7a4a" />
                  <Text style={[styles.statVal, { color: colors.text }]}>{sales.length}</Text>
                  <Text style={[styles.statLbl, { color: colors.muted }]}>Ventes</Text>
                </View>
              </View>
              <Text style={[styles.sectionTitle, { color: colors.primary }]}>Historique des Ventes</Text>
            </>
          }
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.muted }]}>Aucune vente enregistrée.</Text>
              <Text style={[styles.emptyTextSmall, { color: colors.muted }]}>Les ventes enregistrées depuis la page de ventes apparaîtront ici.</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={[styles.saleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.saleProdName, { color: colors.text }]}>{item.productName}</Text>
                <Text style={[styles.saleProdMeta, { color: colors.muted }]}>
                  Qté: {item.quantity} • PU: {formatAmount(item.unitPrice)} F • {formatShortDate(item.createdAt)}
                </Text>
              </View>
              <Text style={[styles.saleProdPrice, { color: "#1a7a4a" }]}>{formatAmount(item.totalPrice)} F</Text>
            </View>
          )}
        />
      )}

      {/* MODALS */}
      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={handleBarCodeScanned}
        colors={colors}
        title="Scanner pour le Stock"
      />

      <QuickStockModal
        visible={quickStockVisible}
        onClose={() => {
          setQuickStockVisible(false);
          setScannedBarcode(null);
        }}
        barcode={scannedBarcode}
        colors={colors}
      />

      {/* Formulaire standard Nouveau/Modifier */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowForm(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 20 }]}> 
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeaderRow}>
            <Text style={[styles.sheetTitle, { color: colors.primary }]}>{editingProduct ? "Modifier le produit" : "Nouveau produit"}</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}><X size={22} color={colors.muted} /></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: "75%" }}>
            <Text style={[styles.label, { color: colors.muted }]}>NOM</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
              value={productName}
              onChangeText={setProductName}
              placeholder="Nom du produit"
              placeholderTextColor={colors.muted}
            />

            {/* Prix d'achat */}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <View style={{ flex: 1.2 }}>
                <Text style={[styles.label, { color: colors.muted }]}>PRIX D'ACHAT (FCFA)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                  value={purchasePrice}
                  onChangeText={setPurchasePrice}
                  placeholder="Ex: 1500"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.muted }]}>TYPE D'ACHAT</Text>
                <View style={styles.purchaseTypeRow}>
                  <TouchableOpacity 
                    style={[styles.typeBtn, purchaseType === "detail" && { backgroundColor: colors.primary }]} 
                    onPress={() => setPurchaseType("detail")}
                  >
                    <Text style={[styles.typeBtnText, { color: purchaseType === "detail" ? "#fff" : colors.muted }]}>Détail</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.typeBtn, purchaseType === "gros" && { backgroundColor: colors.primary }]} 
                    onPress={() => setPurchaseType("gros")}
                  >
                    <Text style={[styles.typeBtnText, { color: purchaseType === "gros" ? "#fff" : colors.muted }]}>Gros</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.muted }]}>PRIX DE VENTE (FCFA)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                  value={productPrice}
                  onChangeText={(text) => setProductPrice(text.replace(/[^0-9]/g, ""))}
                  placeholder="Ex: 500"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.muted }]}>STOCK INITIAL</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                  value={productStock}
                  onChangeText={(text) => setProductStock(text.replace(/[^0-9]/g, ""))}
                  placeholder="Ex: 10"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <Text style={[styles.label, { color: colors.muted, marginTop: 12 }]}>CODE-BARRES</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
              value={productBarcode}
              onChangeText={setProductBarcode}
              placeholder="Saisir ou scanner"
              placeholderTextColor={colors.muted}
            />

            <Text style={[styles.label, { color: colors.muted, marginTop: 12 }]}>CATÉGORIE</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
              value={productCategory}
              onChangeText={setProductCategory}
              placeholder="Ex: Boissons, Snacks"
              placeholderTextColor={colors.muted}
            />

            <TouchableOpacity style={[styles.submitButton, { backgroundColor: colors.primary }]} onPress={handleSave} disabled={loading}>
              <Text style={[styles.submitButtonText, { color: "#FFD700" }]}>{loading ? "Enregistrement..." : "Enregistrer"}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  title: { fontSize: 24, fontFamily: "Poppins_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Poppins_400Regular" },
  addButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  
  tabContainer: { flexDirection: "row", borderBottomWidth: 1 },
  tabButton: { flex: 1, paddingVertical: 14, alignItems: "center" },
  tabText: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },

  searchBox: { flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginTop: 16, paddingHorizontal: 12, height: 48, borderRadius: 12, borderWidth: 1, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Poppins_400Regular" },

  barcodeRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 20, marginTop: 10, paddingHorizontal: 12, height: 48, borderRadius: 12, borderWidth: 1, gap: 8 },
  barcodeIcon: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  barcodeInput: { flex: 1, fontSize: 14, fontFamily: "Poppins_400Regular" },
  barcodeScanButton: { padding: 6 },
  barcodeSearchButton: { paddingHorizontal: 10 },
  barcodeSearchText: { fontSize: 14, fontFamily: "Poppins_700Bold" },

  barcodeResult: { marginHorizontal: 20, marginTop: 10, borderRadius: 12, borderWidth: 1, padding: 14, gap: 6 },
  barcodeResultTitle: { fontSize: 14, fontFamily: "Poppins_700Bold" },
  barcodeResultText: { fontSize: 12, fontFamily: "Poppins_400Regular" },
  barcodeButton: { alignSelf: "flex-start", marginTop: 8, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  barcodeButtonText: { fontSize: 13, fontFamily: "Poppins_600SemiBold" },

  productCard: { flexDirection: "row", marginHorizontal: 20, marginTop: 10, padding: 12, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "space-between" },
  productInfo: { flex: 1, marginRight: 10 },
  productName: { fontSize: 15, fontFamily: "Poppins_600SemiBold" },
  productMeta: { fontSize: 12, fontFamily: "Poppins_400Regular" },
  stockBadgeContainer: { alignItems: "flex-end", gap: 8 },
  stockBadge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8 },
  stockText: { fontSize: 12, fontFamily: "Poppins_700Bold" },
  actionButtons: { flexDirection: "row", gap: 10 },
  actionBtn: { padding: 4 },

  statsGrid: { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginTop: 16, marginBottom: 12 },
  statCard: { flex: 1, borderRadius: 12, borderWidth: 1, padding: 12, alignItems: "center", gap: 4 },
  statVal: { fontSize: 15, fontFamily: "Poppins_700Bold", textAlign: "center" },
  statLbl: { fontSize: 11, fontFamily: "Poppins_400Regular" },

  sectionTitle: { fontSize: 16, fontFamily: "Poppins_700Bold", marginHorizontal: 20, marginTop: 12, marginBottom: 6 },
  saleCard: { flexDirection: "row", marginHorizontal: 20, marginBottom: 8, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  saleProdName: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  saleProdMeta: { fontSize: 12, fontFamily: "Poppins_400Regular", marginTop: 1 },
  saleProdPrice: { fontSize: 15, fontFamily: "Poppins_700Bold", marginLeft: "auto" },

  emptyContainer: { padding: 40, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 14, fontFamily: "Poppins_600SemiBold" },
  emptyTextSmall: { fontSize: 12, fontFamily: "Poppins_400Regular", textAlign: "center", marginTop: 4 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  sheetHandle: { width: 40, height: 4, backgroundColor: "#E0E0E0", borderRadius: 2, alignSelf: "center", marginBottom: 10 },
  sheetHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontFamily: "Poppins_700Bold" },
  
  label: { fontSize: 11, fontFamily: "Poppins_600SemiBold" },
  input: { height: 48, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, fontSize: 14 },
  submitButton: { height: 48, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 20 },
  submitButtonText: { fontSize: 14, fontFamily: "Poppins_700Bold" },
  
  purchaseTypeRow: { flexDirection: "row", borderWidth: 1, borderColor: "#ccc", borderRadius: 10, height: 48, overflow: "hidden" },
  typeBtn: { flex: 1, alignItems: "center", justifyContent: "center" },
  typeBtnText: { fontSize: 12, fontFamily: "Poppins_600SemiBold" }
});

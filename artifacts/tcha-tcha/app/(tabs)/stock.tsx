import React, { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
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
  SectionList,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Archive, Barcode, Camera, Plus, Search, X, Edit3, Trash2, CheckCircle, Package, TrendingUp, ShoppingCart, AlertCircle, Eye, EyeOff, Download, MoreVertical, Minus } from "lucide-react-native";
import { useColors } from "@/hooks/useColors";
import { useProducts, LocalProduct, LocalProductSale } from "@/context/ProductContext";
import { formatAmount, formatTime, formatShortDate } from "@/utils/format";
import BarcodeScannerModal from "@/components/BarcodeScannerModal";
import QuickStockModal from "@/components/QuickStockModal";

export default function StockPage() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { products, sales, addProduct, editProduct, removeProduct, isOnline, searchProducts, findProductByBarcode, recordSale } = useProducts();

  const [activeTab, setActiveTab] = useState<"inventory" | "ventes" | "analyses" | "alertes">("inventory");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [sortBy, setSortBy] = useState<"name" | "price" | "stock" | "margin">("name");
  const [showFilters, setShowFilters] = useState(false);
  
  // Scanned barcode and quick sale
  const [scannedBarcode, setScannedBarcode] = useState<string | null>(null);
  const [quickStockVisible, setQuickStockVisible] = useState(false);
  const [saleQuantity, setSaleQuantity] = useState("");
  const [salesModalVisible, setSalesModalVisible] = useState(false);
  const [selectedProductForSale, setSelectedProductForSale] = useState<LocalProduct | null>(null);

  // Product form
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<LocalProduct | null>(null);
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productStock, setProductStock] = useState("");
  const [productBarcode, setProductBarcode] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseType, setPurchaseType] = useState<"detail" | "gros">("detail");

  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeResult, setBarcodeResult] = useState<LocalProduct | null | "not-found" >(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);
  const [selectedMenuProduct, setSelectedMenuProduct] = useState<LocalProduct | null>(null);

  const filteredProducts = useMemo(() => {
    let result = searchProducts(searchQuery);
    
    if (filterCategory) {
      result = result.filter(p => (p.category || "").toLowerCase() === filterCategory.toLowerCase());
    }

    // Sort
    switch(sortBy) {
      case "price":
        result.sort((a, b) => b.price - a.price);
        break;
      case "stock":
        result.sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));
        break;
      case "margin":
        result.sort((a, b) => {
          const aMargin = calculateMargin(a);
          const bMargin = calculateMargin(b);
          return bMargin - aMargin;
        });
        break;
      default:
        result.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    return result;
  }, [searchProducts, searchQuery, filterCategory, sortBy]);

  const categories = useMemo(() => {
    const cats = new Set(products.map(p => p.category).filter(Boolean) as string[]);
    return Array.from(cats).sort();
  }, [products]);

  const calculateMargin = (product: LocalProduct): number => {
    try {
      const meta = product.description ? JSON.parse(product.description) : {};
      const purchasePrice = meta.purchasePrice ?? 0;
      if (purchasePrice <= 0) return 0;
      return ((product.price - purchasePrice) / purchasePrice) * 100;
    } catch {
      return 0;
    }
  };

  const getLowStockProducts = (): LocalProduct[] => {
    return products.filter(p => (p.stock ?? 0) <= 5).sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));
  };

  const getTopSellingProducts = (): { product: LocalProduct | null; quantity: number; revenue: number }[] => {
    const salesByProduct = new Map<string, { quantity: number; revenue: number }>();
    sales.forEach(sale => {
      const key = sale.productId;
      if (!key) return; // Skip if no productId
      const existing = salesByProduct.get(key) || { quantity: 0, revenue: 0 };
      existing.quantity += sale.quantity;
      existing.revenue += sale.totalPrice;
      salesByProduct.set(key, existing);
    });
    
    return Array.from(salesByProduct.entries())
      .map(([productId, stats]) => ({
        product: products.find(p => p.id === productId) || null,
        ...stats
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  };

  const getSlowMovingProducts = (): LocalProduct[] => {
    const salesByProduct = new Set(sales.map(s => s.productId).filter(Boolean));
    return products
      .filter(p => !salesByProduct.has(p.id) && (p.stock ?? 0) > 0)
      .sort((a, b) => (b.stock ?? 0) - (a.stock ?? 0))
      .slice(0, 5);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const isSmallScreen = width < 375;
  const isLargeScreen = width > 500;

  // Responsive sizing
  const getResponsiveSize = (small: number, medium: number, large: number) => {
    if (isSmallScreen) return small;
    if (isLargeScreen) return large;
    return medium;
  };

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
        // Pas du JSON valide
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

  const openQuickSale = (product: LocalProduct) => {
    setSelectedProductForSale(product);
    setSaleQuantity("1");
    setSalesModalVisible(true);
  };

  const handleQuickSale = async () => {
    if (!selectedProductForSale || !saleQuantity) return;
    const quantity = parseInt(saleQuantity, 10);
    
    if (quantity <= 0) {
      Alert.alert("Erreur", "La quantité doit être supérieure à 0");
      return;
    }

    if ((selectedProductForSale.stock ?? 0) < quantity) {
      Alert.alert("Erreur", `Stock insuffisant. Disponible: ${selectedProductForSale.stock ?? 0}`);
      return;
    }

    try {
      const totalPrice = selectedProductForSale.price * quantity;
      await recordSale({
        productId: selectedProductForSale.id,
        productName: selectedProductForSale.name,
        unitPrice: selectedProductForSale.price,
        quantity,
        totalPrice,
        barcode: selectedProductForSale.barcode,
      });

      // Update stock
      const newStock = (selectedProductForSale.stock ?? 0) - quantity;
      await editProduct(selectedProductForSale.id, { stock: newStock > 0 ? newStock : null });

      Alert.alert("Succès", `Vente de ${quantity}x ${selectedProductForSale.name} enregistrée`);
      setSalesModalVisible(false);
      setSaleQuantity("");
      setSelectedProductForSale(null);
    } catch (error: any) {
      Alert.alert("Erreur", error?.message ?? "Impossible d'enregistrer la vente");
    }
  };

  const handleUseBarcodeProduct = (product: LocalProduct) => {
    openEditProduct(product);
  };

  const totalRevenue = useMemo(() => sales.reduce((sum, s) => sum + s.totalPrice, 0), [sales]);
  const totalQuantitySold = useMemo(() => sales.reduce((sum, s) => sum + s.quantity, 0), [sales]);
  const totalStockValue = useMemo(() => products.reduce((sum, p) => sum + (p.price * (p.stock ?? 0)), 0), [products]);
  const averageMargin = useMemo(() => {
    const margins = products.map(calculateMargin);
    return margins.length ? margins.reduce((a, b) => a + b) / margins.length : 0;
  }, [products]);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}>
        <View>
          <Text style={[styles.title, { color: colors.primary }]}>Gestion de Stock</Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>Inventaire & Ventes</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 8, alignSelf: "flex-end" }}>
          {activeTab === "inventory" && (
            <>
              <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.primary + "20" }]} onPress={() => setShowFilters(!showFilters)} activeOpacity={0.8}>
                <Search size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.primary + "20" }]} onPress={() => setScannerVisible(true)} activeOpacity={0.8}>
                <Camera size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.accent + "20" }]} onPress={openNewProduct} activeOpacity={0.8}>
                <Plus size={18} color={colors.accent} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
        {(["inventory", "ventes", "analyses", "alertes"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabButton, activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 3 }]}
            onPress={() => { setActiveTab(tab); setShowFilters(false); }}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, { color: activeTab === tab ? colors.primary : colors.muted }]}>
              {{inventory: "Inventaire", ventes: "Ventes", analyses: "Analyses", alertes: "Alertes"}[tab]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* INVENTORY TAB */}
      {activeTab === "inventory" && (
        <>
          {showFilters && (
            <View style={[styles.filterPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.filterLabel, { color: colors.text }]}>Trier par</Text>
              <View style={styles.filterRow}>
                {(["name", "price", "stock", "margin"] as const).map(opt => (
                  <TouchableOpacity key={opt} style={[styles.filterChip, sortBy === opt && { backgroundColor: colors.primary }]} onPress={() => setSortBy(opt)}>
                    <Text style={[styles.filterChipText, { color: sortBy === opt ? "#fff" : colors.muted }]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {categories.length > 0 && (
                <>
                  <Text style={[styles.filterLabel, { color: colors.text, marginTop: 12 }]}>Catégorie</Text>
                  <View style={styles.filterRow}>
                    <TouchableOpacity style={[styles.filterChip, !filterCategory && { backgroundColor: colors.primary }]} onPress={() => setFilterCategory("")}>
                      <Text style={[styles.filterChipText, { color: !filterCategory ? "#fff" : colors.muted }]}>Tous</Text>
                    </TouchableOpacity>
                    {categories.map(cat => (
                      <TouchableOpacity key={cat} style={[styles.filterChip, filterCategory === cat && { backgroundColor: colors.primary }]} onPress={() => setFilterCategory(cat)}>
                        <Text style={[styles.filterChipText, { color: filterCategory === cat ? "#fff" : colors.muted }]}>{cat}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}

          <FlatList<LocalProduct>
            data={filteredProducts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 140 }}
            ListHeaderComponent={
              <View style={[styles.searchBox, { backgroundColor: colors.input, borderColor: colors.border }]}>
                <Search size={18} color={colors.muted} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="Chercher produit, code-barres..."
                  placeholderTextColor={colors.muted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery && <TouchableOpacity onPress={() => setSearchQuery("")}><X size={16} color={colors.muted} /></TouchableOpacity>}
              </View>
            }
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Package size={40} color={colors.muted} />
                <Text style={[styles.emptyText, { color: colors.muted, marginTop: 12 }]}>Aucun produit trouvé</Text>
                <TouchableOpacity style={[styles.emptyButton, { backgroundColor: colors.primary }]} onPress={openNewProduct}>
                  <Text style={{ color: "#fff", fontFamily: "Poppins_600SemiBold" }}>+ Ajouter un produit</Text>
                </TouchableOpacity>
              </View>
            )}
            renderItem={({ item }) => (
              <View style={[styles.productCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.productInfo}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.productName, { color: colors.text }]}>{item.name}</Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                      {item.category && (
                        <View style={[styles.badge, { backgroundColor: colors.primary + "20" }]}>
                          <Text style={[styles.badgeText, { color: colors.primary }]}>{item.category}</Text>
                        </View>
                      )}
                      {(item.stock ?? 0) <= 5 && (
                        <View style={[styles.badge, { backgroundColor: "#ef4444" + "20" }]}>
                          <Text style={[styles.badgeText, { color: "#ef4444" }]}>⚠ Stock faible</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity style={styles.menuBtn} onPress={() => { setSelectedMenuProduct(item); setMoreMenuVisible(true); }}>
                    <MoreVertical size={18} color={colors.muted} />
                  </TouchableOpacity>
                </View>

                <View style={styles.productStats}>
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: colors.muted }]}>Prix</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>{formatAmount(item.price)} F</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: colors.muted }]}>Stock</Text>
                    <Text style={[styles.statValue, { color: (item.stock ?? 0) <= 5 ? "#ef4444" : colors.primary }]}>{item.stock ?? 0}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={[styles.statLabel, { color: colors.muted }]}>Marge</Text>
                    <Text style={[styles.statValue, { color: "#1a7a4a" }]}>{calculateMargin(item).toFixed(0)}%</Text>
                  </View>
                  {item.barcode && (
                    <View style={styles.statItem}>
                      <Text style={[styles.statLabel, { color: colors.muted }]}>Code</Text>
                      <Text style={[styles.statValue, { color: colors.primary, fontSize: 12 }]}>{item.barcode.substring(0, 8)}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.productActions}>
                  <TouchableOpacity style={[styles.actionBtnSmall, { backgroundColor: colors.accent + "20" }]} onPress={() => openQuickSale(item)}>
                    <ShoppingCart size={16} color={colors.accent} />
                    <Text style={{ color: colors.accent, fontSize: 12, fontFamily: "Poppins_600SemiBold" }}>Vendre</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtnSmall, { backgroundColor: colors.primary + "20" }]} onPress={() => openEditProduct(item)}>
                    <Edit3 size={16} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontSize: 12, fontFamily: "Poppins_600SemiBold" }}>Modifier</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtnSmall, { backgroundColor: "#ef4444" + "20" }]} onPress={() => handleRemove(item)}>
                    <Trash2 size={16} color="#ef4444" />
                    <Text style={{ color: "#ef4444", fontSize: 12, fontFamily: "Poppins_600SemiBold" }}>Supprimer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </>
      )}

      {/* VENTES TAB */}
      {activeTab === "ventes" && (
        <FlatList<LocalProductSale>
          data={sales}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 140 }}
          ListHeaderComponent={
            <>
              <View style={styles.statsGrid}>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.statIconBg, { backgroundColor: colors.accent + "20" }]}>
                    <TrendingUp size={20} color={colors.accent} />
                  </View>
                  <Text style={[styles.statCardValue, { color: colors.text }]}>{formatAmount(totalRevenue)} F</Text>
                  <Text style={[styles.statCardLabel, { color: colors.muted }]}>Revenus</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.statIconBg, { backgroundColor: colors.primary + "20" }]}>
                    <Package size={20} color={colors.primary} />
                  </View>
                  <Text style={[styles.statCardValue, { color: colors.text }]}>{totalQuantitySold}</Text>
                  <Text style={[styles.statCardLabel, { color: colors.muted }]}>Qté vendue</Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.statIconBg, { backgroundColor: "#1a7a4a" + "20" }]}>
                    <ShoppingCart size={20} color="#1a7a4a" />
                  </View>
                  <Text style={[styles.statCardValue, { color: colors.text }]}>{sales.length}</Text>
                  <Text style={[styles.statCardLabel, { color: colors.muted }]}>Transactions</Text>
                </View>
              </View>
              <Text style={[styles.sectionTitle, { color: colors.primary }]}>Historique des ventes</Text>
            </>
          }
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <ShoppingCart size={40} color={colors.muted} />
              <Text style={[styles.emptyText, { color: colors.muted, marginTop: 12 }]}>Aucune vente enregistrée</Text>
            </View>
          )}
          renderItem={({ item }) => (
            <View style={[styles.saleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.saleName, { color: colors.text }]}>{item.productName}</Text>
                <Text style={[styles.saleMeta, { color: colors.muted }]}>Qté: {item.quantity} • PU: {formatAmount(item.unitPrice)} F</Text>
                <Text style={[styles.saleTime, { color: colors.muted }]}>{formatShortDate(item.createdAt)}</Text>
              </View>
              <Text style={[styles.salePrice, { color: "#1a7a4a" }]}>{formatAmount(item.totalPrice)} F</Text>
            </View>
          )}
        />
      )}

      {/* ANALYSES TAB */}
      {activeTab === "analyses" && (
        <ScrollView contentContainerStyle={{ paddingBottom: 140, paddingHorizontal: 16, paddingTop: 12, gap: 16 }}>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.statIconBg, { backgroundColor: "#fbbf24" + "20" }]}>
                <Package size={20} color="#fbbf24" />
              </View>
              <Text style={[styles.statCardValue, { color: colors.text }]}>{formatAmount(totalStockValue)} F</Text>
              <Text style={[styles.statCardLabel, { color: colors.muted }]}>Valeur stock</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.statIconBg, { backgroundColor: "#34d399" + "20" }]}>
                <TrendingUp size={20} color="#34d399" />
              </View>
              <Text style={[styles.statCardValue, { color: colors.text }]}>{averageMargin.toFixed(0)}%</Text>
              <Text style={[styles.statCardLabel, { color: colors.muted }]}>Marge moy.</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.statIconBg, { backgroundColor: colors.primary + "20" }]}>
                <Package size={20} color={colors.primary} />
              </View>
              <Text style={[styles.statCardValue, { color: colors.text }]}>{products.length}</Text>
              <Text style={[styles.statCardLabel, { color: colors.muted }]}>Produits</Text>
            </View>
          </View>

          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>Top 5 - Produits les plus vendus</Text>
            {getTopSellingProducts().length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.muted, textAlign: "center", marginTop: 20 }]}>Aucune vente pour le moment</Text>
            ) : (
              getTopSellingProducts().map((item, idx) => (
                <View key={idx} style={styles.analysisItem}>
                  <View style={[styles.rankBadge, { backgroundColor: colors.primary }]}>
                    <Text style={{ color: "#fff", fontFamily: "Poppins_700Bold", fontSize: 12 }}>#{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.analysisName, { color: colors.text }]}>{item.product?.name ?? "Produit inconnu"}</Text>
                    <Text style={[styles.analysisMeta, { color: colors.muted }]}>Qté: {item.quantity} • Revenus: {formatAmount(item.revenue)} F</Text>
                  </View>
                </View>
              ))
            )}
          </View>

          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>Produits lents à vendre</Text>
            {getSlowMovingProducts().length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.muted, textAlign: "center", marginTop: 20 }]}>Tous les produits se vendent bien!</Text>
            ) : (
              getSlowMovingProducts().map((product, idx) => (
                <View key={idx} style={styles.analysisItem}>
                  <View style={[styles.rankBadge, { backgroundColor: "#fbbf24" }]}>
                    <Text style={{ color: "#000", fontFamily: "Poppins_700Bold", fontSize: 12 }}>!</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.analysisName, { color: colors.text }]}>{product.name}</Text>
                    <Text style={[styles.analysisMeta, { color: colors.muted }]}>Stock: {product.stock ?? 0} • Marge: {calculateMargin(product).toFixed(0)}%</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      {/* ALERTES TAB */}
      {activeTab === "alertes" && (
        <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
          <View style={[styles.alertPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <View style={[styles.alertIconBg, { backgroundColor: "#ef4444" + "20" }]}>
                <AlertCircle size={20} color="#ef4444" />
              </View>
              <Text style={[styles.alertTitle, { color: colors.text }]}>Stock faible</Text>
            </View>

            {getLowStockProducts().length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.muted }]}>✓ Tous les stocks sont bons</Text>
            ) : (
              getLowStockProducts().map((product) => (
                <View key={product.id} style={[styles.alertItem, { borderColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.alertItemName, { color: colors.text }]}>{product.name}</Text>
                    <Text style={[styles.alertItemMeta, { color: colors.muted }]}>Stock restant: {product.stock ?? 0}</Text>
                  </View>
                  <TouchableOpacity style={[styles.miniBtn, { backgroundColor: colors.primary + "20" }]} onPress={() => openEditProduct(product)}>
                    <Edit3 size={14} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      {/* MODALS */}
      <BarcodeScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScanned={handleBarCodeScanned}
        colors={colors}
        title="Scanner un produit"
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

      {/* Modal Vente Rapide */}
      <Modal visible={salesModalVisible} transparent animationType="slide" onRequestClose={() => setSalesModalVisible(false)}>
        <View style={styles.modalContainer}>
          <Pressable style={styles.modalOverlay} onPress={() => setSalesModalVisible(false)} />
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.keyboardView}
          >
            <View style={[styles.quickSaleSheet, { backgroundColor: colors.background, paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 20 }]}>
              <View style={styles.sheetHandle} />
              <Text style={[styles.sheetTitle, { color: colors.primary, marginBottom: 12 }]}>Enregistrer une vente</Text>

              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.label, { color: colors.muted }]}>PRODUIT</Text>
                <View style={[styles.productBox, { backgroundColor: colors.input, borderColor: colors.border }]}>
                  <Text style={[styles.productBoxName, { color: colors.text }]}>{selectedProductForSale?.name}</Text>
                  <Text style={[styles.productBoxPrice, { color: colors.primary }]}>{formatAmount(selectedProductForSale?.price ?? 0)} F</Text>
                </View>
              </View>

              <Text style={[styles.label, { color: colors.muted }]}>QUANTITÉ</Text>
              <TextInput
                style={[styles.quantityInput, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                value={saleQuantity}
                onChangeText={setSaleQuantity}
                keyboardType="number-pad"
                placeholder="1"
                placeholderTextColor={colors.muted}
              />

              <View style={{ marginTop: 20, flexDirection: "row", gap: 12 }}>
                <TouchableOpacity style={[styles.saleModalBtn, { backgroundColor: colors.muted + "20" }]} onPress={() => setSalesModalVisible(false)} activeOpacity={0.8}>
                  <Text style={[styles.saleModalBtnText, { color: colors.muted }]}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.saleModalBtn, { backgroundColor: colors.accent, flex: 1 }]} onPress={handleQuickSale} activeOpacity={0.8}>
                  <Text style={[styles.saleModalBtnText, { color: "#fff" }]}>Vendre</Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Modal Menu Plus */}
      <Modal visible={moreMenuVisible} transparent animationType="fade" onRequestClose={() => setMoreMenuVisible(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMoreMenuVisible(false)} />
        <View style={[styles.contextMenu, { backgroundColor: colors.card }]}>
          <TouchableOpacity style={styles.menuItem} onPress={() => { if (selectedMenuProduct) openQuickSale(selectedMenuProduct); setMoreMenuVisible(false); }}>
            <ShoppingCart size={16} color={colors.accent} />
            <Text style={[styles.menuItemText, { color: colors.accent }]}>Vendre</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => { if (selectedMenuProduct) openEditProduct(selectedMenuProduct); setMoreMenuVisible(false); }}>
            <Edit3 size={16} color={colors.primary} />
            <Text style={[styles.menuItemText, { color: colors.primary }]}>Modifier</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => { if (selectedMenuProduct) handleRemove(selectedMenuProduct); setMoreMenuVisible(false); }}>
            <Trash2 size={16} color="#ef4444" />
            <Text style={[styles.menuItemText, { color: "#ef4444" }]}>Supprimer</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Formulaire standard Nouveau/Modifier */}
      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <View style={styles.modalContainer}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowForm(false)} />
          <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.keyboardView}
          >
            <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: (Platform.OS === "web" ? 20 : insets.bottom) + 20 }]}> 
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeaderRow}>
                <Text style={[styles.sheetTitle, { color: colors.primary }]}>{editingProduct ? "Modifier le produit" : "Nouveau produit"}</Text>
                <TouchableOpacity onPress={() => setShowForm(false)}><X size={22} color={colors.muted} /></TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: "80%" }} keyboardShouldPersistTaps="handled">
                <Text style={[styles.label, { color: colors.muted }]}>NOM</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                  value={productName}
                  onChangeText={setProductName}
                  placeholder="Nom du produit"
                  placeholderTextColor={colors.muted}
                />

                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <View style={{ flex: 1.2 }}>
                    <Text style={[styles.label, { color: colors.muted }]}>PRIX D'ACHAT (F)</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                      value={purchasePrice}
                      onChangeText={setPurchasePrice}
                      placeholder="1500"
                      placeholderTextColor={colors.muted}
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: colors.muted }]}>TYPE</Text>
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
                    <Text style={[styles.label, { color: colors.muted }]}>PRIX DE VENTE (F)</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                      value={productPrice}
                      onChangeText={(text) => setProductPrice(text.replace(/[^0-9]/g, ""))}
                      placeholder="2500"
                      placeholderTextColor={colors.muted}
                      keyboardType="number-pad"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: colors.muted }]}>STOCK</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.input, borderColor: colors.border, color: colors.text }]}
                      value={productStock}
                      onChangeText={(text) => setProductStock(text.replace(/[^0-9]/g, ""))}
                      placeholder="10"
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
                  placeholder="Boissons, Snacks, etc"
                  placeholderTextColor={colors.muted}
                />

                <TouchableOpacity style={[styles.submitButton, { backgroundColor: colors.primary }]} onPress={handleSave} disabled={loading}>
                  <Text style={[styles.submitButtonText, { color: "#FFD700" }]}>{loading ? "Enregistrement..." : "Enregistrer"}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (width: number) => {
  const isSmallScreen = width < 375;
  const isMediumScreen = width >= 375 && width < 500;
  const isLargeScreen = width >= 500;
  
  const getPadding = () => isSmallScreen ? 12 : isMediumScreen ? 16 : 20;
  const getMarginH = () => isSmallScreen ? 12 : isMediumScreen ? 16 : 20;
  const getTitleSize = () => isSmallScreen ? 20 : isMediumScreen ? 24 : 28;
  const getSubtitleSize = () => isSmallScreen ? 11 : 13;
  const getLabelSize = () => isSmallScreen ? 9 : 10;
  const getBodySize = () => isSmallScreen ? 12 : isMediumScreen ? 13 : 14;
  const getInputHeight = () => isSmallScreen ? 44 : 48;

  return StyleSheet.create({
    container: { flex: 1 },
    header: { 
      paddingHorizontal: getPadding(), 
      paddingBottom: isSmallScreen ? 12 : 16, 
      flexDirection: "row", 
      justifyContent: "space-between", 
      alignItems: "flex-end",
      gap: 8,
    },
    title: { fontSize: getTitleSize(), fontFamily: "Poppins_700Bold" },
    subtitle: { fontSize: getSubtitleSize(), fontFamily: "Poppins_400Regular" },
    addButton: { width: isSmallScreen ? 36 : 42, height: isSmallScreen ? 36 : 42, borderRadius: isSmallScreen ? 18 : 21, alignItems: "center", justifyContent: "center" },
    
    tabContainer: { flexDirection: "row", borderBottomWidth: 1 },
    tabButton: { flex: 1, paddingVertical: isSmallScreen ? 10 : 14, alignItems: "center" },
    tabText: { fontSize: isSmallScreen ? 12 : 14, fontFamily: "Poppins_600SemiBold" },

    searchBox: { flexDirection: "row", alignItems: "center", marginHorizontal: getMarginH(), marginTop: isSmallScreen ? 12 : 16, paddingHorizontal: 10, height: getInputHeight(), borderRadius: 12, borderWidth: 1, gap: 6 },
    searchInput: { flex: 1, fontSize: getBodySize(), fontFamily: "Poppins_400Regular" },

    barcodeRow: { flexDirection: "row", alignItems: "center", marginHorizontal: getMarginH(), marginTop: 8, paddingHorizontal: 10, height: getInputHeight(), borderRadius: 12, borderWidth: 1, gap: 6 },
    barcodeIcon: { width: 24, height: 24, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    barcodeInput: { flex: 1, fontSize: getBodySize(), fontFamily: "Poppins_400Regular", minWidth: 0 },
    barcodeScanButton: { padding: 4, flexShrink: 0 },
    barcodeSearchButton: { paddingHorizontal: 8, flexShrink: 0 },
    barcodeSearchText: { fontSize: isSmallScreen ? 12 : 14, fontFamily: "Poppins_700Bold" },

    barcodeResult: { marginHorizontal: getMarginH(), marginTop: 8, borderRadius: 12, borderWidth: 1, padding: isSmallScreen ? 10 : 14, gap: 6 },
    barcodeResultTitle: { fontSize: isSmallScreen ? 12 : 14, fontFamily: "Poppins_700Bold" },
    barcodeResultText: { fontSize: isSmallScreen ? 11 : 12, fontFamily: "Poppins_400Regular" },
    barcodeButton: { alignSelf: "flex-start", marginTop: 8, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8 },
    barcodeButtonText: { fontSize: isSmallScreen ? 11 : 13, fontFamily: "Poppins_600SemiBold" },

    productCard: { marginHorizontal: getMarginH(), marginTop: 8, padding: isSmallScreen ? 10 : 12, borderRadius: 14, borderWidth: 1 },
    productInfo: { marginBottom: 8 },
    productName: { fontSize: isSmallScreen ? 13 : 15, fontFamily: "Poppins_600SemiBold", marginBottom: 6 },
    productMeta: { fontSize: isSmallScreen ? 11 : 12, fontFamily: "Poppins_400Regular" },
    stockBadgeContainer: { alignItems: "flex-end", gap: 8 },
    stockBadge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8 },
    stockText: { fontSize: isSmallScreen ? 11 : 12, fontFamily: "Poppins_700Bold" },
    actionButtons: { flexDirection: "row", gap: 10 },
    actionBtn: { padding: 4 },

    statsGrid: { flexDirection: isSmallScreen ? "column" : "row", gap: 8, paddingHorizontal: getPadding(), marginTop: 12, marginBottom: 10 },
    statVal: { fontSize: isSmallScreen ? 13 : 15, fontFamily: "Poppins_700Bold", textAlign: "center" },
    statLbl: { fontSize: 10, fontFamily: "Poppins_400Regular" },

    sectionTitle: { fontSize: isSmallScreen ? 14 : 16, fontFamily: "Poppins_700Bold", marginHorizontal: getMarginH(), marginTop: 10, marginBottom: 6 },
    saleCard: { marginHorizontal: getMarginH(), marginBottom: 6, padding: isSmallScreen ? 10 : 12, borderRadius: 12, borderWidth: 1 },
    saleProdName: { fontSize: isSmallScreen ? 12 : 14, fontFamily: "Poppins_600SemiBold" },
    saleProdMeta: { fontSize: isSmallScreen ? 11 : 12, fontFamily: "Poppins_400Regular", marginTop: 2 },
    saleProdPrice: { fontSize: isSmallScreen ? 13 : 15, fontFamily: "Poppins_700Bold", marginTop: 4 },

    emptyContainer: { padding: isSmallScreen ? 24 : 40, alignItems: "center", justifyContent: "center", minHeight: 200 },
    emptyText: { fontSize: isSmallScreen ? 12 : 14, fontFamily: "Poppins_600SemiBold" },
    emptyTextSmall: { fontSize: isSmallScreen ? 11 : 12, fontFamily: "Poppins_400Regular", textAlign: "center", marginTop: 4 },

    modalOverlay: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.58)" },
    modalContainer: { flex: 1, justifyContent: "flex-end" },
    keyboardView: { width: "100%" },
    sheet: {
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      padding: getPadding(),
      shadowColor: "#000",
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 10,
    },
    sheetHandle: { width: 50, height: 5, backgroundColor: "#DDDDE8", borderRadius: 3, alignSelf: "center", marginBottom: 10 },
    sheetHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10 },
    sheetTitle: { fontSize: isSmallScreen ? 16 : 18, fontFamily: "Poppins_700Bold", flex: 1, letterSpacing: -0.3 },
    closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(0,0,0,0.06)", alignItems: "center", justifyContent: "center" },
    
    label: { fontSize: getLabelSize(), fontFamily: "Poppins_600SemiBold", marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.6 },
    input: { height: getInputHeight(), borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 14, fontSize: getBodySize() },
    submitButton: { height: getInputHeight(), borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 16 },
    submitButtonText: { fontSize: getBodySize(), fontFamily: "Poppins_700Bold", letterSpacing: 0.2 },
    
    purchaseTypeRow: { flexDirection: "row", borderWidth: 1, borderColor: "#ccc", borderRadius: 10, height: getInputHeight(), overflow: "hidden" },
    typeBtn: { flex: 1, alignItems: "center", justifyContent: "center" },
    typeBtnText: { fontSize: isSmallScreen ? 11 : 12, fontFamily: "Poppins_600SemiBold" },
    
    iconBtn: { width: isSmallScreen ? 34 : 38, height: isSmallScreen ? 34 : 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    filterPanel: { borderRadius: 12, borderWidth: 1, marginHorizontal: getMarginH(), marginTop: 10, padding: isSmallScreen ? 10 : 12, gap: 8 },
    filterLabel: { fontSize: isSmallScreen ? 11 : 12, fontFamily: "Poppins_600SemiBold", marginBottom: 4 },
    filterRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
    filterChip: { paddingHorizontal: isSmallScreen ? 10 : 12, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: "#e0e0e0" },
    filterChipText: { fontSize: isSmallScreen ? 10 : 12, fontFamily: "Poppins_500Medium" },
    
    productStats: { flexDirection: isSmallScreen ? "column" : "row", gap: 8, marginTop: 8, paddingTop: 8, borderTopWidth: 1 },
    statItem: { alignItems: "center", flex: isSmallScreen ? 1 : undefined },
    statLabel: { fontSize: 9, fontFamily: "Poppins_500Medium" },
    statValue: { fontSize: isSmallScreen ? 12 : 14, fontFamily: "Poppins_700Bold", marginTop: 2 },
    
    productActions: { flexDirection: "row", gap: 6, marginTop: 8, justifyContent: "space-between" },
    actionBtnSmall: { flex: 1, paddingVertical: isSmallScreen ? 6 : 8, paddingHorizontal: 6, borderRadius: 8, alignItems: "center", justifyContent: "center", gap: 2, minHeight: isSmallScreen ? 36 : 40 },
    
    badge: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
    badgeText: { fontSize: isSmallScreen ? 10 : 11, fontFamily: "Poppins_500Medium" },
    
    menuBtn: { padding: 4 },
    menuOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)" },
    contextMenu: { position: "absolute", bottom: 80, right: 10, borderRadius: 12, overflow: "hidden", minWidth: 120 },
    menuItem: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
    menuItemText: { fontSize: isSmallScreen ? 12 : 14, fontFamily: "Poppins_500Medium" },
    
    statCard: { alignItems: "center", borderRadius: 12, borderWidth: 1, padding: isSmallScreen ? 10 : 12, gap: 4, flex: 1 },
    statIconBg: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginBottom: 2 },
    statCardValue: { fontSize: isSmallScreen ? 14 : 16, fontFamily: "Poppins_700Bold" },
    statCardLabel: { fontSize: isSmallScreen ? 10 : 12, fontFamily: "Poppins_400Regular" },
    
    sectionCard: { marginHorizontal: getMarginH(), borderRadius: 12, borderWidth: 1, padding: isSmallScreen ? 10 : 14, gap: 10 },
    analysisItem: { flexDirection: "row", alignItems: "center", gap: 8, paddingBottom: 8, borderBottomWidth: 1 },
    rankBadge: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    analysisName: { fontSize: isSmallScreen ? 12 : 14, fontFamily: "Poppins_600SemiBold", flex: 1, minWidth: 0 },
    analysisMeta: { fontSize: isSmallScreen ? 10 : 12, fontFamily: "Poppins_400Regular", marginTop: 2 },
    
    alertPanel: { borderRadius: 12, borderWidth: 1, marginHorizontal: getMarginH(), marginTop: 10, padding: isSmallScreen ? 10 : 14 },
    alertIconBg: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    alertTitle: { fontSize: isSmallScreen ? 13 : 15, fontFamily: "Poppins_600SemiBold" },
    alertItem: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, borderBottomWidth: 1 },
    alertItemName: { fontSize: isSmallScreen ? 12 : 14, fontFamily: "Poppins_600SemiBold", flex: 1, minWidth: 0 },
    alertItemMeta: { fontSize: isSmallScreen ? 10 : 12, fontFamily: "Poppins_400Regular", marginTop: 2 },
    miniBtn: { width: 28, height: 28, borderRadius: 6, alignItems: "center", justifyContent: "center", flexShrink: 0 },
    
    quickSaleSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: getPadding(), maxHeight: "60%" },
    productBox: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8 },
    productBoxName: { fontSize: isSmallScreen ? 12 : 14, fontFamily: "Poppins_600SemiBold" },
    productBoxPrice: { fontSize: isSmallScreen ? 11 : 12, fontFamily: "Poppins_500Medium", marginTop: 2 },
    quantityInput: { height: getInputHeight(), borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, fontSize: isSmallScreen ? 14 : 16, fontFamily: "Poppins_600SemiBold", textAlign: "center" },
    saleModalBtn: { height: getInputHeight(), borderRadius: 10, alignItems: "center", justifyContent: "center", flex: 1 },
    saleModalBtnText: { fontSize: getBodySize(), fontFamily: "Poppins_600SemiBold" },
    
    emptyButton: { marginTop: 12, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10 },
    
    saleName: { fontSize: isSmallScreen ? 12 : 14, fontFamily: "Poppins_600SemiBold" },
    saleMeta: { fontSize: isSmallScreen ? 10 : 12, fontFamily: "Poppins_400Regular", marginTop: 2 },
    saleTime: { fontSize: isSmallScreen ? 9 : 11, fontFamily: "Poppins_400Regular", marginTop: 2 },
    salePrice: { fontSize: isSmallScreen ? 13 : 15, fontFamily: "Poppins_700Bold" }
  });
};

const styles = getStyles(375); // Default

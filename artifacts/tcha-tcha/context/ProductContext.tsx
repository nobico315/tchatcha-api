import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from "react";
import NetInfo from "@react-native-community/netinfo";
import {
  getProducts as apiGetProducts,
  createProduct as apiCreateProduct,
  updateProduct as apiUpdateProduct,
  deleteProduct as apiDeleteProduct,
  getProductByBarcode as apiGetProductByBarcode,
  getProductSales as apiGetProductSales,
  createProductSale as apiCreateProductSale,
  type Product,
  type ProductSale,
} from "@workspace/api-client-react";

export type { Product, ProductSale };

export type SaleSyncStatus = "synced" | "pending" | "error";

export interface LocalProductSale extends ProductSale {
  syncStatus: SaleSyncStatus;
}

export interface LocalProduct extends Product {
  syncStatus: "synced" | "pending" | "pending_update" | "error";
}

interface ProductContextType {
  products: LocalProduct[];
  sales: LocalProductSale[];
  isOnline: boolean;
  // Products
  addProduct: (data: Omit<Product, "id" | "agentId" | "createdAt" | "updatedAt">) => Promise<LocalProduct>;
  editProduct: (id: string, data: Partial<Omit<Product, "id" | "agentId">>) => Promise<void>;
  removeProduct: (id: string) => Promise<void>;
  searchProductByBarcode: (barcode: string) => LocalProduct | null;
  findProductByBarcode: (barcode: string) => Promise<LocalProduct | null>;
  searchProducts: (query: string) => LocalProduct[];
  // Sales
  recordSale: (data: {
    productId?: string | null;
    productName: string;
    unitPrice: number;
    quantity: number;
    totalPrice: number;
    barcode?: string | null;
    note?: string | null;
  }) => Promise<LocalProductSale>;
  getTodaySales: () => LocalProductSale[];
  getSalesTotalToday: () => number;
  refreshProducts: () => Promise<void>;
}

const ProductContext = createContext<ProductContextType | null>(null);

const PRODUCTS_KEY = "@tcha_products";
const SALES_KEY = "@tcha_product_sales";
const PENDING_DEL_KEY = "@tcha_pending_product_deletions";

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

export function ProductProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [sales, setSales] = useState<LocalProductSale[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const isSyncingRef = useRef(false);

  // ── Persist helpers ────────────────────────────────────────────────────────
  const saveProducts = async (data: LocalProduct[]) => {
    await AsyncStorage.setItem(PRODUCTS_KEY, JSON.stringify(data));
    setProducts(data);
  };

  const saveSales = async (data: LocalProductSale[]) => {
    await AsyncStorage.setItem(SALES_KEY, JSON.stringify(data));
    setSales(data);
  };

  // ── Load on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [p, s] = await Promise.all([
        AsyncStorage.getItem(PRODUCTS_KEY),
        AsyncStorage.getItem(SALES_KEY),
      ]);
      if (p) setProducts(JSON.parse(p));
      if (s) setSales(JSON.parse(s));
    })();

    const unsub = NetInfo.addEventListener((state) => {
      setIsOnline(!!state.isConnected);
    });
    return () => unsub();
  }, []);

  // ── Background sync when online ────────────────────────────────────────────
  const syncAll = useCallback(async () => {
    if (isSyncingRef.current || !isOnline) return;
    isSyncingRef.current = true;

    try {
      // 0. Flush pending product deletions
      const delRaw = await AsyncStorage.getItem(PENDING_DEL_KEY);
      const delQueue: string[] = delRaw ? JSON.parse(delRaw) : [];
      if (delQueue.length > 0) {
        const remaining: string[] = [];
        for (const id of delQueue) {
          try {
            await apiDeleteProduct(id);
          } catch (e: any) {
            if ((e?.status ?? e?.statusCode) !== 404) remaining.push(id);
          }
        }
        await AsyncStorage.setItem(PENDING_DEL_KEY, JSON.stringify(remaining));
      }

      // 1. Sync pending / pending_update products
      const localProducts: LocalProduct[] = JSON.parse(await AsyncStorage.getItem(PRODUCTS_KEY) ?? "[]");
      let changed = false;
      for (const p of localProducts) {
        if (p.syncStatus === "pending") {
          try {
            await apiCreateProduct({
              name: p.name,
              barcode: p.barcode ?? undefined,
              price: p.price,
              stock: p.stock ?? undefined,
              category: p.category ?? undefined,
              description: p.description ?? undefined,
            });
            p.syncStatus = "synced";
            changed = true;
          } catch { /* keep pending */ }
        } else if (p.syncStatus === "pending_update") {
          try {
            await apiUpdateProduct(p.id, {
              name: p.name,
              barcode: p.barcode,
              price: p.price,
              stock: p.stock,
              category: p.category,
              description: p.description,
            });
            p.syncStatus = "synced";
            changed = true;
          } catch { /* keep pending_update */ }
        }
      }
      if (changed) await saveProducts(localProducts);

      // 2. Fetch fresh product catalog
      try {
        const serverProducts = await apiGetProducts();
        const localNonSynced = localProducts.filter((p) => p.syncStatus !== "synced");
        const normalized: LocalProduct[] = serverProducts.map((p) => ({
          ...p,
          barcode: p.barcode ?? null,
          stock: p.stock ?? null,
          category: p.category ?? null,
          description: p.description ?? null,
          syncStatus: "synced" as const,
        }));
        const merged = [
          ...localNonSynced,
          ...normalized.filter((sp) => !localNonSynced.some((lp) => lp.id === sp.id)),
        ];
        await saveProducts(merged);
      } catch { /* keep local */ }

      // 3. Sync pending sales
      const localSales: LocalProductSale[] = JSON.parse(await AsyncStorage.getItem(SALES_KEY) ?? "[]");
      let salesChanged = false;
      for (const sale of localSales) {
        if (sale.syncStatus === "pending") {
          try {
            await apiCreateProductSale({
              id: sale.id,
              productId: sale.productId,
              productName: sale.productName,
              unitPrice: sale.unitPrice,
              quantity: sale.quantity,
              totalPrice: sale.totalPrice,
              barcode: sale.barcode,
              note: sale.note,
              createdAt: sale.createdAt,
            });
            sale.syncStatus = "synced";
            salesChanged = true;
          } catch { /* keep pending */ }
        }
      }
      if (salesChanged) await saveSales(localSales);

      // 4. Fetch fresh sales
      try {
        const serverSales = await apiGetProductSales();
        const localPending = localSales.filter((s) => s.syncStatus !== "synced");
        const normalizedSales: LocalProductSale[] = serverSales.map((s) => ({
          ...s,
          barcode: s.barcode ?? null,
          note: s.note ?? null,
          productId: s.productId ?? null,
          syncStatus: "synced" as const,
        }));
        const mergedSales = [
          ...localPending,
          ...normalizedSales.filter((ss) => !localPending.some((ls) => ls.id === ss.id)),
        ];
        await saveSales(mergedSales);
      } catch { /* keep local */ }

    } finally {
      isSyncingRef.current = false;
    }
  }, [isOnline]);

  useEffect(() => {
    if (isOnline) {
      syncAll();
      const interval = setInterval(syncAll, 30000);
      return () => clearInterval(interval);
    }
  }, [isOnline, syncAll]);

  // ── Products CRUD ──────────────────────────────────────────────────────────
  const addProduct = useCallback(async (data: Omit<Product, "id" | "agentId" | "createdAt" | "updatedAt">): Promise<LocalProduct> => {
    const localProduct: LocalProduct = {
      id: generateId(),
      agentId: "",
      name: data.name,
      barcode: data.barcode ?? null,
      price: data.price,
      stock: data.stock ?? null,
      category: data.category ?? null,
      description: data.description ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: "pending",
    };

    const stored: LocalProduct[] = JSON.parse(await AsyncStorage.getItem(PRODUCTS_KEY) ?? "[]");
    await saveProducts([localProduct, ...stored]);

    if (isOnline) {
      try {
        const serverProduct = await apiCreateProduct({
          name: data.name,
          barcode: data.barcode ?? undefined,
          price: data.price,
          stock: data.stock ?? undefined,
          category: data.category ?? undefined,
          description: data.description ?? undefined,
        });
        const synced: LocalProduct = { ...serverProduct, barcode: serverProduct.barcode ?? null, stock: serverProduct.stock ?? null, category: serverProduct.category ?? null, description: serverProduct.description ?? null, syncStatus: "synced" };
        const latest: LocalProduct[] = JSON.parse(await AsyncStorage.getItem(PRODUCTS_KEY) ?? "[]");
        await saveProducts(latest.map((p) => p.id === localProduct.id ? synced : p));
        return synced;
      } catch { /* keep pending */ }
    }

    return localProduct;
  }, [isOnline]);

  const editProduct = useCallback(async (id: string, data: Partial<Omit<Product, "id" | "agentId">>) => {
    const stored: LocalProduct[] = JSON.parse(await AsyncStorage.getItem(PRODUCTS_KEY) ?? "[]");
    const original = stored.find((p) => p.id === id);
    if (!original) return;

    const newSyncStatus = original.syncStatus === "pending" ? "pending" : "pending_update";
    const updated = stored.map((p) => p.id === id ? { ...p, ...data, updatedAt: new Date().toISOString(), syncStatus: newSyncStatus as LocalProduct["syncStatus"] } : p);
    await saveProducts(updated);

    if (isOnline) {
      try {
        const serverProduct = await apiUpdateProduct(id, data);
        const latest: LocalProduct[] = JSON.parse(await AsyncStorage.getItem(PRODUCTS_KEY) ?? "[]");
        await saveProducts(latest.map((p) => p.id === id ? { ...serverProduct, barcode: serverProduct.barcode ?? null, stock: serverProduct.stock ?? null, category: serverProduct.category ?? null, description: serverProduct.description ?? null, syncStatus: "synced" as const } : p));
      } catch { /* keep pending_update */ }
    }
  }, [isOnline]);

  const removeProduct = useCallback(async (id: string) => {
    const stored: LocalProduct[] = JSON.parse(await AsyncStorage.getItem(PRODUCTS_KEY) ?? "[]");
    await saveProducts(stored.filter((p) => p.id !== id));

    if (isOnline) {
      try { await apiDeleteProduct(id); } catch {}
    } else {
      const delRaw = await AsyncStorage.getItem(PENDING_DEL_KEY);
      const queue: string[] = delRaw ? JSON.parse(delRaw) : [];
      if (!queue.includes(id)) {
        await AsyncStorage.setItem(PENDING_DEL_KEY, JSON.stringify([...queue, id]));
      }
    }
  }, [isOnline]);

  const searchProductByBarcode = useCallback((barcode: string): LocalProduct | null => {
    return products.find((p) => p.barcode === barcode) ?? null;
  }, [products]);

  const findProductByBarcode = useCallback(async (barcode: string): Promise<LocalProduct | null> => {
    const cleaned = barcode.trim();
    if (!cleaned) return null;
    const local = products.find((p) => p.barcode === cleaned);
    if (local) return local;
    if (!isOnline) return null;

    try {
      const serverProduct = await apiGetProductByBarcode(cleaned);
      const normalized: LocalProduct = {
        ...serverProduct,
        barcode: serverProduct.barcode ?? null,
        stock: serverProduct.stock ?? null,
        category: serverProduct.category ?? null,
        description: serverProduct.description ?? null,
        syncStatus: "synced",
      };
      const stored: LocalProduct[] = JSON.parse(await AsyncStorage.getItem(PRODUCTS_KEY) ?? "[]");
      const merged = [normalized, ...stored.filter((p) => p.id !== normalized.id)];
      await saveProducts(merged);
      return normalized;
    } catch {
      return null;
    }
  }, [isOnline, products]);

  const searchProducts = useCallback((query: string): LocalProduct[] => {
    const q = query.toLowerCase().trim();
    if (!q) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.barcode && p.barcode.includes(q)) ||
      (p.category && p.category.toLowerCase().includes(q))
    );
  }, [products]);

  // ── Sales ──────────────────────────────────────────────────────────────────
  const recordSale = useCallback(async (data: {
    productId?: string | null;
    productName: string;
    unitPrice: number;
    quantity: number;
    totalPrice: number;
    barcode?: string | null;
    note?: string | null;
  }): Promise<LocalProductSale> => {
    const localSale: LocalProductSale = {
      id: generateId(),
      agentId: "",
      productId: data.productId ?? null,
      productName: data.productName,
      unitPrice: data.unitPrice,
      quantity: data.quantity,
      totalPrice: data.totalPrice,
      barcode: data.barcode ?? null,
      note: data.note ?? null,
      createdAt: new Date().toISOString(),
      syncStatus: "pending",
    };

    const stored: LocalProductSale[] = JSON.parse(await AsyncStorage.getItem(SALES_KEY) ?? "[]");
    await saveSales([localSale, ...stored]);

    // Decrement local stock if product linked
    if (data.productId) {
      const prods: LocalProduct[] = JSON.parse(await AsyncStorage.getItem(PRODUCTS_KEY) ?? "[]");
      await saveProducts(prods.map((p) =>
        p.id === data.productId && p.stock !== null
          ? { ...p, stock: Math.max(0, (p.stock ?? 0) - data.quantity) }
          : p
      ));
    }

    if (isOnline) {
      try {
        const serverSale = await apiCreateProductSale({
          id: localSale.id,
          ...data,
          createdAt: localSale.createdAt,
        });
        const synced: LocalProductSale = { ...serverSale, barcode: serverSale.barcode ?? null, note: serverSale.note ?? null, productId: serverSale.productId ?? null, syncStatus: "synced" };
        const latest: LocalProductSale[] = JSON.parse(await AsyncStorage.getItem(SALES_KEY) ?? "[]");
        await saveSales(latest.map((s) => s.id === localSale.id ? synced : s));
        return synced;
      } catch { /* keep pending */ }
    }

    return localSale;
  }, [isOnline, products]);

  const getTodaySales = useCallback((): LocalProductSale[] => {
    const today = new Date().toISOString().split("T")[0];
    return sales.filter((s) => s.createdAt.startsWith(today));
  }, [sales]);

  const getSalesTotalToday = useCallback((): number => {
    return getTodaySales().reduce((sum, s) => sum + s.totalPrice, 0);
  }, [getTodaySales]);

  const refreshProducts = useCallback(async () => {
    await syncAll();
  }, [syncAll]);

  return (
    <ProductContext.Provider value={{
      products, sales, isOnline,
      addProduct, editProduct, removeProduct, searchProductByBarcode, findProductByBarcode, searchProducts,
      recordSale, getTodaySales, getSalesTotalToday, refreshProducts,
    }}>
      {children}
    </ProductContext.Provider>
  );
}

export function useProducts() {
  const ctx = useContext(ProductContext);
  if (!ctx) throw new Error("useProducts must be used inside ProductProvider");
  return ctx;
}

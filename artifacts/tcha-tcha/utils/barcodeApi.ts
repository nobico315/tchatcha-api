/**
 * barcodeApi.ts
 * Recherche de produit par code-barres multi-sources fiable et structurée.
 * Utilise uniquement des bases de données officielles :
 * 1. e-Répertoire des prix de référence du Bénin
 * 2. Open Food Facts (Bénin & Global)
 * 3. UpcItemDb (Base de données globale de produits finis)
 * 
 * Aucun scraping instable n'est utilisé afin d'éviter les noms aberrants.
 */

export interface BarcodeProduct {
  barcode: string;
  name: string;
  brand?: string;
  category?: string;
  imageUrl?: string;
  found: boolean;
}

/**
 * Nettoie et formate proprement le nom du produit.
 */
function cleanProductName(name: string): string {
  if (!name) return "";
  let clean = name.replace(/<[^>]*>/g, ""); // Retire le HTML
  clean = clean.replace(/\s+/g, " ").trim();
  return clean;
}

/**
 * Recherche les informations d'un produit à partir de son code-barres.
 * Retourne le produit trouvé ou null si le produit est inconnu des bases de données officielles.
 */
export async function lookupBarcode(barcode: string): Promise<BarcodeProduct | null> {
  const cleanBarcode = barcode?.trim() ?? "";
  if (cleanBarcode.length < 4) return null;

  const codesToTest = [cleanBarcode];
  if (cleanBarcode.startsWith("0") && cleanBarcode.length > 8) {
    codesToTest.push(cleanBarcode.substring(1));
  }

  for (const code of codesToTest) {
    // 1. Tenter e-Répertoire des Finances du Bénin (erepertoire.finances.bj)
    try {
      const url = `https://erepertoire.finances.bj/api/products/search?q=${encodeURIComponent(code)}`;
      const res = await fetch(url, { headers: { "Accept": "application/json" } });
      if (res.ok) {
        const json = await res.json();
        const items = json.data || json;
        if (Array.isArray(items) && items.length > 0) {
          const item = items[0];
          const name = item.libelle || item.designation || item.name;
          if (name) {
            return {
              barcode: cleanBarcode,
              name: cleanProductName(name),
              found: true
            };
          }
        }
      }
    } catch (e) {
      // Passer au suivant en cas de problème de réseau ou d'API
    }

    // 2. Tenter Open Food Facts (Bénin & World)
    const sources = [
      `https://bj.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}?fields=product_name,brands,categories_tags,image_small_url,product_name_fr`,
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}?fields=product_name,brands,categories_tags,image_small_url,product_name_fr`
    ];

    for (const url of sources) {
      try {
        const res = await fetch(url, { headers: { "User-Agent": "TchaTcha-App/1.0" } });
        if (res.ok) {
          const json = await res.json();
          if (json.status === 1 && json.product) {
            const p = json.product;
            const name = p.product_name_fr?.trim() || p.product_name?.trim();
            if (name) {
              const brands = p.brands?.split(",")[0]?.trim() ?? undefined;
              const cats = (p.categories_tags as string[] | undefined)
                ?.filter((c) => c.startsWith("fr:") || c.startsWith("en:"))
                ?.map((c) => c.replace(/^(fr:|en:)/, "").replace(/-/g, " "))
                ?.slice(0, 1)?.[0];

              const fullName = brands ? `${brands} — ${name}` : name;
              return {
                barcode: cleanBarcode,
                name: cleanProductName(fullName),
                brand: brands,
                category: cats,
                imageUrl: p.image_small_url ?? undefined,
                found: true,
              };
            }
          }
        }
      } catch (e) {
        // Passer au suivant
      }
    }

    // 3. Tenter UpcItemDb (Base mondiale)
    try {
      const url = `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(code)}`;
      const res = await fetch(url, { headers: { "Content-Type": "application/json" } });
      if (res.ok) {
        const json = await res.json();
        if (json.items && json.items.length > 0) {
          const item = json.items[0];
          const title = item.title?.trim();
          if (title) {
            const brand = item.brand?.trim() || undefined;
            const fullName = brand ? `${brand} — ${title}` : title;
            return {
              barcode: cleanBarcode,
              name: cleanProductName(fullName),
              brand: brand,
              category: item.category?.trim() || undefined,
              imageUrl: item.images?.[0] || undefined,
              found: true,
            };
          }
        }
      }
    } catch (e) {
      // Ignorer
    }
  }

  return null;
}

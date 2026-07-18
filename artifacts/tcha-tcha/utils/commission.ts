import AsyncStorage from "@react-native-async-storage/async-storage";

export type Operator = "MTN" | "Moov" | "Celtis";
export type TransactionType = "depot" | "retrait" | "vente" | "recharge";

export interface OperatorCommissions {
  depot: number; // in % (e.g. 0.6)
  retrait: number; // in % (e.g. 0.6)
  vente: number; // in % (e.g. 5.0)
}

export interface CommissionSettings {
  useProgressiveGrid: boolean;
  MTN: OperatorCommissions;
  Moov: OperatorCommissions;
  Celtis: OperatorCommissions;
}

export const DEFAULT_COMMISSION_SETTINGS: CommissionSettings = {
  useProgressiveGrid: true,
  MTN: { depot: 0.6, retrait: 0.6, vente: 5.0 },
  Moov: { depot: 0.6, retrait: 0.6, vente: 5.0 },
  Celtis: { depot: 0.7, retrait: 0.7, vente: 5.0 },
};

const COMMISSION_SETTINGS_KEY = "@tcha_commission_settings";

/**
 * Calculates the progressive commission based on standard Benin Mobile Money grids.
 */
export function calculateProgressiveCommission(
  type: "depot" | "retrait",
  amount: number,
  operator: Operator
): number {
  if (operator === "Celtis") {
    // Celtis public operator progressive grid (slightly higher to attract agents)
    if (amount <= 500) return 15;
    if (amount <= 1000) return 25;
    if (amount <= 5000) return 60;
    if (amount <= 10000) return 120;
    if (amount <= 20000) return 180;
    if (amount <= 50000) return 350;
    if (amount <= 100000) return 650;
    if (amount <= 200000) return 1200;
    if (amount <= 500000) return 1500;
    return Math.floor(amount * 0.003); // 0.3% flat for large amounts
  } else {
    // MTN MoMo & Moov Money standard progressive grid in Benin
    if (amount <= 500) return 10;
    if (amount <= 1000) return 20;
    if (amount <= 5000) return 50;
    if (amount <= 10000) return 100;
    if (amount <= 20000) return 150;
    if (amount <= 50000) return 300;
    if (amount <= 100000) return 500;
    if (amount <= 200000) return 1000;
    if (amount <= 500000) return 1250;
    return Math.floor(amount * 0.0025); // 0.25% flat for large amounts
  }
}

/**
 * Main function to calculate commission/profit for a given transaction.
 */
export function calculateCommission(
  type: TransactionType,
  amount: number,
  operator: Operator,
  settings: CommissionSettings = DEFAULT_COMMISSION_SETTINGS
): number {
  if (type === "vente") {
    const rate = (settings[operator]?.vente ?? 5.0) / 100;
    return Math.floor(amount * rate);
  }

  if (settings.useProgressiveGrid) {
    return calculateProgressiveCommission(type, amount, operator);
  } else {
    const rate = ((type === "depot" ? settings[operator]?.depot : settings[operator]?.retrait) ?? 0.6) / 100;
    return Math.floor(amount * rate);
  }
}

/**
 * Loads the commission settings from AsyncStorage.
 */
export async function loadCommissionSettings(): Promise<CommissionSettings> {
  try {
    const json = await AsyncStorage.getItem(COMMISSION_SETTINGS_KEY);
    if (json) {
      const parsed = JSON.parse(json);
      // Fallback/validation to ensure all operators and types exist
      return {
        useProgressiveGrid: parsed.useProgressiveGrid ?? true,
        MTN: { ...DEFAULT_COMMISSION_SETTINGS.MTN, ...parsed.MTN },
        Moov: { ...DEFAULT_COMMISSION_SETTINGS.Moov, ...parsed.Moov },
        Celtis: { ...DEFAULT_COMMISSION_SETTINGS.Celtis, ...parsed.Celtis },
      };
    }
  } catch (error) {
    console.error("Error loading commission settings:", error);
  }
  return DEFAULT_COMMISSION_SETTINGS;
}

/**
 * Saves the commission settings to AsyncStorage.
 */
export async function saveCommissionSettings(settings: CommissionSettings): Promise<boolean> {
  try {
    await AsyncStorage.setItem(COMMISSION_SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error("Error saving commission settings:", error);
    return false;
  }
}

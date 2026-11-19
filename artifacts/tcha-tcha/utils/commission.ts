import AsyncStorage from "@react-native-async-storage/async-storage";

export type Operator = "MTN" | "Moov" | "Celtis";
export type TransactionType = "depot" | "retrait" | "vente" | "recharge";

export interface OperatorCommissions {
  /** % du montant — PROVISOIRE, à remplacer par le contrat agent */
  depot: number;
  /** % du montant — utilisé seulement si la grille est désactivée */
  retrait: number;
  /** % du montant — PROVISOIRE */
  vente: number;
  /** % du montant — PROVISOIRE */
  recharge: number;
  /**
   * Part de l'agent sur les frais de retrait payés par le client (0 à 1).
   * 0.4 = ESTIMATION issue d'une source non béninoise (Burkina Faso).
   * À remplacer par la valeur du contrat agent MTN / Moov / Celtiis.
   */
  agentShare: number;
}

export interface CommissionSettings {
  /** true = retrait calculé via grille de frais client × agentShare */
  useProgressiveGrid: boolean;
  MTN: OperatorCommissions;
  Moov: OperatorCommissions;
  Celtis: OperatorCommissions;
}

export const DEFAULT_COMMISSION_SETTINGS: CommissionSettings = {
  useProgressiveGrid: true,
  MTN: { depot: 0.6, retrait: 0.6, vente: 4.0, recharge: 4.0, agentShare: 0.4 },
  Moov: { depot: 0.6, retrait: 0.6, vente: 4.0, recharge: 4.0, agentShare: 0.4 },
  Celtis: { depot: 0.7, retrait: 0.7, vente: 5.0, recharge: 5.0, agentShare: 0.4 },
};

const COMMISSION_SETTINGS_KEY = "@tcha_commission_settings";

type Tier = { max: number; fee: number };
type AgentCommissionTier = { max: number; depot: number; retrait: number };

const AGENT_COMMISSION_GRID: AgentCommissionTier[] = [
  { max: 500, depot: 10, retrait: 15 },
  { max: 5_000, depot: 20, retrait: 45 },
  { max: 10_000, depot: 35, retrait: 85 },
  { max: 20_000, depot: 45, retrait: 140 },
  { max: 50_000, depot: 60, retrait: 260 },
  { max: 100_000, depot: 80, retrait: 380 },
  { max: 200_000, depot: 120, retrait: 750 },
  { max: 300_000, depot: 150, retrait: 1_100 },
  { max: 500_000, depot: 200, retrait: 1_350 },
  { max: 750_000, depot: 250, retrait: 1_850 },
  { max: 1_000_000, depot: 300, retrait: 2_200 },
  { max: 1_500_000, depot: 400, retrait: 2_900 },
  { max: 2_000_000, depot: 500, retrait: 3_600 },
];

/**
 * Frais de retrait payés par le CLIENT (FCFA) — MTN et Moov.
 * Source : visuel officiel « Grille tarifaire des retraits Mobile Money » de MTN Mobile Money SA
 * (confirmé par le fondateur), identique chez Moov (page officielle moov-africa.bj).
 */
const MTN_MOOV_GRID: Tier[] = [
  { max: 500, fee: 50 },
  { max: 5_000, fee: 125 },
  { max: 10_000, fee: 225 },
  { max: 20_000, fee: 375 },
  { max: 50_000, fee: 700 },
  { max: 100_000, fee: 1_000 },
  { max: 200_000, fee: 2_000 },
  { max: 300_000, fee: 3_000 },
  { max: 500_000, fee: 3_500 },
  { max: 750_000, fee: 5_000 },
  { max: 1_000_000, fee: 6_000 },
  { max: 1_500_000, fee: 8_000 },
  { max: 2_000_000, fee: 9_900 },
];

/**
 * Frais de retrait payés par le CLIENT (FCFA) — Celtiis Cash.
 * ATTENTION : lecture de l'ordre du texte de celtiis.bj/celtiis-cash (montants et tarifs
 * affichés dans deux listes séparées). Première tranche à confirmer (50 F vs « à partir de 25 F »).
 */
const CELTIIS_GRID: Tier[] = [
  { max: 500, fee: 50 },
  { max: 5_000, fee: 120 },
  { max: 10_000, fee: 200 },
  { max: 20_000, fee: 300 },
  { max: 50_000, fee: 600 },
  { max: 75_000, fee: 900 },
  { max: 100_000, fee: 1_000 },
  { max: 200_000, fee: 2_000 },
  { max: 300_000, fee: 3_000 },
  { max: 500_000, fee: 3_500 },
  { max: 750_000, fee: 5_000 },
  { max: 1_000_000, fee: 5_800 },
  { max: 1_500_000, fee: 7_800 },
  { max: 2_000_000, fee: 9_800 },
];

/** Frais de retrait que le client paie pour un montant donné (0 hors grille). */
export function getClientWithdrawalFee(amount: number, operator: Operator): number {
  if (!Number.isFinite(amount) || amount <= 0 || amount > 2_000_000) return 0;
  const grid = operator === "Celtis" ? CELTIIS_GRID : MTN_MOOV_GRID;
  return grid.find((t) => amount <= t.max)?.fee ?? 0;
}

/**
 * Rémunération fixe de l'agent sur dépôt/retrait selon la tranche du montant.
 */
export function calculateProgressiveCommission(
  type: "depot" | "retrait",
  amount: number,
  operator: Operator,
  settings: CommissionSettings = DEFAULT_COMMISSION_SETTINGS
): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (amount > 2_000_000) return 0;

  if (operator === "Celtis" && type === "depot") {
    return amount <= 500_000 ? amount * 0.0033 : 1_644;
  }
  if (operator === "Celtis" && type === "retrait") {
    return amount <= 500_000 ? amount * 0.001 : 500;
  }

  const tier = AGENT_COMMISSION_GRID.find((commissionTier) => amount <= commissionTier.max);
  if (!tier) return 0;
  return operator === "Celtis" || type === "retrait" ? tier[type] : tier.depot;
}

/** Commission/gain pour une transaction donnée. */
export function calculateCommission(
  type: TransactionType,
  amount: number,
  operator: Operator,
  settings: CommissionSettings = DEFAULT_COMMISSION_SETTINGS
): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  const op = { ...DEFAULT_COMMISSION_SETTINGS[operator], ...settings[operator] };

  switch (type) {
    case "vente":
      return amount * (operator === "Celtis" ? 0.05 : 0.04);
    case "recharge":
      return amount * (operator === "Celtis" ? 0.05 : 0.04);
    case "depot":
      return settings.useProgressiveGrid
        ? calculateProgressiveCommission("depot", amount, operator, settings)
        : Math.floor(amount * (op.depot / 100));
    case "retrait":
      return settings.useProgressiveGrid
        ? calculateProgressiveCommission("retrait", amount, operator, settings)
        : Math.floor(amount * (op.retrait / 100));
  }
}

/** Charge les réglages depuis AsyncStorage (fusion avec les valeurs par défaut). */
export async function loadCommissionSettings(): Promise<CommissionSettings> {
  try {
    const json = await AsyncStorage.getItem(COMMISSION_SETTINGS_KEY);
    if (json) {
      const parsed = JSON.parse(json);
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

/** Sauvegarde les réglages dans AsyncStorage. */
export async function saveCommissionSettings(settings: CommissionSettings): Promise<boolean> {
  try {
    await AsyncStorage.setItem(COMMISSION_SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error("Error saving commission settings:", error);
    return false;
  }
}
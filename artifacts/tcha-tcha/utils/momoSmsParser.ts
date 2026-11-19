import type { Operator, TransactionType } from "@/context/TransactionContext";
import { normalizeBeninPhone } from "@/utils/beninPhone";

export interface ParsedMomoSms {
  operator: Operator;
  type: TransactionType;
  amount: number;
  clientPhone: string; // 8 digits after +229 01, or "" if not found
  clientName: string;
  reference: string | null;
  newBalance: number | null;
  rawBody: string;
}

const SENDER_OPERATOR_MAP: Array<{ pattern: RegExp; operator: Operator }> = [
  { pattern: /mtn|momo|mobile\s*money/i, operator: "MTN" },
  { pattern: /moov|flooz/i, operator: "Moov" },
  { pattern: /celtis|celtiis|sbin/i, operator: "Celtis" },
];

export function detectOperatorFromSms(sender: string, body: string): Operator | null {
  for (const entry of SENDER_OPERATOR_MAP) {
    if (entry.pattern.test(sender) || entry.pattern.test(body)) {
      return entry.operator;
    }
  }
  return null;
}

function parseAmountValue(raw: string): number {
  const cleaned = raw.replace(/[\s.,\u00A0]/g, "");
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function extractAmount(body: string): number {
  const match = body.match(/(\d[\d\s.,]{1,12})\s*(?:fcfa|f\s*cfa|xof|f\b)/i);
  if (!match) return 0;
  return parseAmountValue(match[1]);
}

function extractNewBalance(body: string): number | null {
  const match = body.match(/(?:nouveau\s*solde|solde\s*(?:actuel|disponible)?|balance)\s*[:\-]?\s*(\d[\d\s.,]{0,12})\s*(?:fcfa|f\s*cfa|xof|f\b)?/i);
  if (!match) return null;
  const val = parseAmountValue(match[1]);
  return val > 0 ? val : null;
}

function extractReference(body: string): string | null {
  const match = body.match(/(?:id(?:\s*de)?\s*transaction|ref(?:erence|érence)?|trans\.?\s*id|txnid)\s*[:\-#]?\s*([a-z0-9\-]{5,32})/i);
  return match ? match[1].trim() : null;
}

function extractClientPhone(body: string): string {
  // Match Benin phone numbers (+229 01 XX XX XX XX, 01XXXXXXXX, or 8 digits)
  const matches = body.match(/(?:\+?229[\s-]*)?(?:01[\s-]*)?(?:\d{2}[\s-]*){4}/g);
  if (!matches) return "";
  for (const candidate of matches) {
    const digits = normalizeBeninPhone(candidate);
    if (digits.length === 8) return digits;
  }
  return "";
}

function extractClientName(body: string): string {
  const match = body.match(/(?:de|par|client|vers|pour)\s+([A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ]+){0,2})/);
  return match ? match[1].trim() : "";
}

function detectTransactionType(body: string): TransactionType | null {
  const lower = body.toLowerCase();

  // Retrait client chez l'agent : l'agent reçoit des UV / cash-out
  if (/(retrait|cash[\s-]*out|vous avez re[cç]u|d[eé]bit[eé]\s+pour\s+retrait)/i.test(lower)) {
    return "retrait";
  }

  // Vente de crédit ou forfait
  if (/(forfait|cr[eé]dit|recharge|airtime|bundle|pass)/i.test(lower)) {
    return "vente";
  }

  // Dépôt client : l'agent envoie des UV / transfert / cash-in
  if (/(d[eé]p[oô]t|cash[\s-]*in|vous avez envoy[eé]|transfert\s+(?:effectu[eé]|r[eé]ussi))/i.test(lower)) {
    return "depot";
  }

  return null;
}

/**
 * Parse un SMS de confirmation Mobile Money (MTN, Moov, Celtiis).
 * Retourne null si le SMS ne correspond pas à une transaction exploitable.
 */
export function parseMomoSms(body: string, sender = ""): ParsedMomoSms | null {
  const trimmed = body.trim();
  if (!trimmed) return null;

  const operator = detectOperatorFromSms(sender, trimmed);
  const type = detectTransactionType(trimmed);
  const amount = extractAmount(trimmed);

  if (!operator || !type || amount <= 0) {
    return null;
  }

  const clientPhone = extractClientPhone(trimmed);
  const clientName = extractClientName(trimmed) || (clientPhone ? `Client ${clientPhone}` : `Client ${operator}`);
  const reference = extractReference(trimmed);
  const newBalance = extractNewBalance(trimmed);

  return {
    operator,
    type,
    amount,
    clientPhone,
    clientName,
    reference,
    newBalance,
    rawBody: trimmed,
  };
}

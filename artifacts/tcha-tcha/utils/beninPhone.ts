import type { Operator } from "@/context/TransactionContext";

/* ───────────────────────── Opérateurs ───────────────────────── */

const MTN_PREFIXES = new Set([
  "42", "46", "50", "51", "52", "53", "54", "56", "57", "59",
  "61", "62", "66", "67", "69", "90", "91", "96", "97",
]);
const MOOV_PREFIXES = new Set([
  "45", "55", "58", "60", "63", "64", "65", "68", "94", "95", "98", "99",
]);
const CELTIS_PREFIXES = new Set([
  "20", "21", "22", "23", "24", "28", "29", "40", "41", "43",
  "44", "47", "48", "49", "92", "93",
]);

/** Détecte le réseau à partir des 8 chiffres (après +229 01). Null si inconnu ou ambigu. */
export const detectOperatorFromDigits = (digits: string): Operator | null => {
  if (digits.length < 2) return null;
  const prefix = digits.slice(0, 2);
  const matches: Operator[] = [];
  if (MTN_PREFIXES.has(prefix)) matches.push("MTN");
  if (MOOV_PREFIXES.has(prefix)) matches.push("Moov");
  if (CELTIS_PREFIXES.has(prefix)) matches.push("Celtis");
  return matches.length === 1 ? matches[0] : null;
};

/* ───────────────────────── Normalisation ───────────────────────── */

/**
 * Ramène n'importe quelle saisie (collée, dictée) à 8 chiffres max, sans +229 ni 01.
 * "+229 01 97 64 40 96" -> "97644096"
 * Le préfixe 229 n'est retiré que s'il y a plus de 8 chiffres : un vrai numéro
 * peut commencer par 22 (Celtiis).
 */
export const normalizeBeninPhone = (raw: string): string => {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00229")) d = d.slice(5);
  else if (d.length > 8 && d.startsWith("229")) d = d.slice(3);
  if (d.startsWith("01")) d = d.slice(2);
  return d.slice(0, 8);
};

/** "97644096" -> "97 64 40 96" */
export const formatPhonePairs = (digits: string): string =>
  digits.replace(/(\d{2})(?=\d)/g, "$1 ");

/** 25000 -> "25 000" (formatage manuel : fiable sur Hermes, sans espace insécable) */
export const groupThousands = (n: number): string =>
  String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/* ───────────────────────── Français parlé -> chiffres ───────────────────────── */

const UNITS: Record<string, number> = {
  zéro: 0, zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5,
  six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12,
  treize: 13, quatorze: 14, quinze: 15, seize: 16,
};

const TENS: Record<string, number> = {
  vingt: 20, trente: 30, quarante: 40, cinquante: 50,
  septante: 70, octante: 80, huitante: 80, nonante: 90,
};

/** Lit un nombre 0-19 à la position i. Retourne [valeur, mots consommés]. */
const readSmall = (w: string[], i: number): [number, number] | null => {
  if (w[i] === "dix" && ["sept", "huit", "neuf"].includes(w[i + 1])) {
    return [10 + UNITS[w[i + 1]], 2];
  }
  if (w[i] in UNITS) return [UNITS[w[i]], 1];
  return null;
};

/**
 * Convertit une phrase dictée en chaîne de chiffres.
 * Gère : "quatre-vingt-dix-sept soixante-quatre" -> "9764"
 *        "neuf sept six quatre"                  -> "9764"
 *        "97 64 40 96" (iOS renvoie souvent des chiffres) -> "97644096"
 *        mélange chiffres + mots.
 */
export const frenchToDigits = (text: string): string => {
  const t = text
    .toLowerCase()
    .replace(/[-']/g, " ")
    .replace(/\bet\b/g, " ")
    .replace(/[,.;]/g, " ")
    .trim();

  const w = t.split(/\s+/).filter(Boolean);
  let out = "";
  let i = 0;

  while (i < w.length) {
    // Chiffres déjà écrits ("97", "6")
    if (/^\d+$/.test(w[i])) {
      out += w[i];
      i++;
      continue;
    }

    let n: number;

    if (w[i] === "quatre" && (w[i + 1] === "vingt" || w[i + 1] === "vingts")) {
      n = 80;
      i += 2;
      const s = readSmall(w, i);
      if (s && s[0] >= 1 && s[0] <= 19) { n += s[0]; i += s[1]; }
    } else if (w[i] === "soixante") {
      n = 60;
      i++;
      const s = readSmall(w, i);
      if (s && s[0] >= 1 && s[0] <= 19) { n += s[0]; i += s[1]; }
    } else if (w[i] in TENS) {
      n = TENS[w[i]];
      i++;
      const s = readSmall(w, i);
      if (s && s[0] >= 1 && s[0] <= 9) { n += s[0]; i += s[1]; }
    } else {
      const s = readSmall(w, i);
      if (!s) { i++; continue; } // mot inconnu : ignoré
      n = s[0];
      i += s[1];
    }

    out += String(n);
  }

  return out;
};

import { useCallback, useEffect, useRef, useState } from "react";
import * as Haptics from "expo-haptics";

import { frenchToDigits, normalizeBeninPhone } from "@/utils/beninPhone";

/**
 * Chargement SÛR du module natif : dans Expo Go il n'existe pas et un import
 * statique ferait planter toute l'app (Expo Router charge toutes les routes).
 */
let speech: typeof import("expo-speech-recognition") | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  speech = require("expo-speech-recognition");
} catch {
  speech = null;
}

// Même référence à chaque rendu (règle des hooks respectée)
const useSpeechEvent: (name: string, listener: (event: any) => void) => void =
  speech ? (speech.useSpeechRecognitionEvent as any) : () => {};

const ERROR_MESSAGES: Record<string, string> = {
  "no-speech": "Aucune voix détectée, réessayez.",
  "not-allowed": "Autorisez le micro et la reconnaissance vocale dans les Réglages.",
  "service-not-allowed": "Autorisez le micro et la reconnaissance vocale dans les Réglages.",
  network: "Une connexion internet est requise pour la dictée.",
  "language-not-supported": "Le français n'est pas pris en charge sur cet appareil.",
};

export function usePhoneDictation(onDigits: (digits: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onDigitsRef = useRef(onDigits);
  useEffect(() => {
    onDigitsRef.current = onDigits;
  }, [onDigits]);

  const stop = useCallback(() => {
    try {
      speech?.ExpoSpeechRecognitionModule.stop();
    } catch {
      /* ignore */
    }
    setIsListening(false);
  }, []);

  const start = useCallback(async () => {
    if (!speech) {
      setError("La dictée vocale nécessite l'app installée (build de développement), pas Expo Go.");
      return;
    }
    const Mod = speech.ExpoSpeechRecognitionModule;
    try {
      setError(null);

      const available = await Mod.isRecognitionAvailable();
      if (!available) {
        setError("Reconnaissance vocale indisponible sur cet appareil.");
        return;
      }

      const perm = await Mod.requestPermissionsAsync();
      if (!perm.granted) {
        setError("Autorisez le micro et la reconnaissance vocale dans les Réglages.");
        return;
      }

      Mod.start({
        lang: "fr-FR",
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
      });
      setIsListening(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      console.warn("Dictée : démarrage impossible", e);
      setError("Impossible de démarrer la dictée vocale.");
      setIsListening(false);
    }
  }, []);

  const toggle = useCallback(() => {
    if (isListening) stop();
    else void start();
  }, [isListening, start, stop]);

  /* ── Événements ── */
  useSpeechEvent("result", (e) => {
    const transcript: string = e?.results?.[0]?.transcript ?? "";
    const digits = normalizeBeninPhone(frenchToDigits(transcript));
    if (!digits) return;
    onDigitsRef.current(digits);
    if (digits.length >= 8) stop(); // numéro complet : on coupe le micro
  });

  useSpeechEvent("error", (e) => {
    if (e?.error === "aborted") return;
    setError(ERROR_MESSAGES[e?.error] ?? "Erreur de reconnaissance vocale.");
    setIsListening(false);
  });

  useSpeechEvent("nomatch", () => {
    setError("Aucun numéro détecté, réessayez.");
    setIsListening(false);
  });

  useSpeechEvent("end", () => setIsListening(false));

  /* ── Coupe le micro en quittant l'écran ── */
  useEffect(() => {
    return () => {
      try {
        speech?.ExpoSpeechRecognitionModule.abort();
      } catch {
        /* ignore */
      }
    };
  }, []);

  return { isListening, error, toggle, stop };
}

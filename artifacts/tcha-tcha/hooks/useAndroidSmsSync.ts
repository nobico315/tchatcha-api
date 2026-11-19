import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef } from "react";
import { AppState, DeviceEventEmitter, NativeModules, PermissionsAndroid, Platform } from "react-native";
import { useAuth } from "@/context/AuthContext";
import { useTransactions } from "@/context/TransactionContext";
import { parseMomoSms } from "@/utils/momoSmsParser";
import { emitAppEvent } from "@/utils/appEvents";

const IMPORTED_SMS_REFS_KEY = "@tcha_imported_sms_refs";
const LAST_SMS_SCAN_KEY = "@tcha_last_sms_scan_ms";

interface SmsPayload {
  sender?: string;
  body?: string;
  timestamp?: number;
}

interface SmsListenerNative {
  startListening?: () => void;
  stopListening?: () => void;
  readRecentSms?: (sinceTimestampMs: number) => Promise<SmsPayload[]>;
}

/**
 * Parcourt automatiquement la boîte SMS Android (MTN, Moov, Celtiis)
 * à l'ouverture / reprise de l'app et écoute les nouveaux SMS en direct
 * via le module natif SmsListenerModule.
 */
export function useAndroidSmsSync(enabled = true) {
  const { user } = useAuth();
  const { addTransaction } = useTransactions();
  const processedRef = useRef<Set<string>>(new Set());
  const isScanningRef = useRef(false);

  const processSmsPayload = useCallback(
    async (payload: SmsPayload) => {
      if (!user || user.role !== "agent") return false;
      const body = payload?.body ?? "";
      const sender = payload?.sender ?? "";
      const parsed = parseMomoSms(body, sender);
      if (!parsed) return false;

      const dedupKey =
        parsed.reference ??
        `${parsed.operator}:${parsed.amount}:${payload?.timestamp ?? body.slice(0, 40)}`;
      if (processedRef.current.has(dedupKey)) return false;

      processedRef.current.add(dedupKey);
      const updatedRefs = Array.from(processedRef.current).slice(-300);
      await AsyncStorage.setItem(IMPORTED_SMS_REFS_KEY, JSON.stringify(updatedRefs));

      await addTransaction({
        type: parsed.type,
        clientName: parsed.clientName,
        clientPhone: parsed.clientPhone ? `+22901${parsed.clientPhone}` : "",
        amount: parsed.amount,
        operator: parsed.operator,
        note: parsed.reference ? `Auto-SMS (${parsed.reference})` : "Auto-SMS",
        paid: true,
        savedClient: false,
        agentId: user.id,
      });
      emitAppEvent(
        "sms:imported",
        { amount: parsed.amount, operator: parsed.operator, reference: parsed.reference },
        "light"
      );
      return true;
    },
    [user, addTransaction]
  );

  useEffect(() => {
    if (!enabled || Platform.OS !== "android" || !user || user.role !== "agent") return;

    const smsModule = NativeModules.SmsListenerModule as SmsListenerNative | undefined;
    if (!smsModule) {
      return;
    }

    let subscription: { remove: () => void } | null = null;
    let appStateSub: { remove: () => void } | null = null;
    let cancelled = false;

    const scanInbox = async () => {
      if (isScanningRef.current || cancelled || !smsModule.readRecentSms) return;
      isScanningRef.current = true;
      try {
        const lastScanRaw = await AsyncStorage.getItem(LAST_SMS_SCAN_KEY);
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const sinceMs = lastScanRaw ? Number(lastScanRaw) : startOfToday.getTime();

        const messages = await smsModule.readRecentSms(sinceMs);
        let maxTimestamp = sinceMs;
        for (const msg of messages) {
          await processSmsPayload(msg);
          if (typeof msg.timestamp === "number" && msg.timestamp > maxTimestamp) {
            maxTimestamp = msg.timestamp;
          }
        }
        await AsyncStorage.setItem(LAST_SMS_SCAN_KEY, String(maxTimestamp));
      } catch (err) {
        console.warn("[SMS-SYNC] Erreur lecture boîte SMS:", err);
      } finally {
        isScanningRef.current = false;
      }
    };

    const setup = async () => {
      try {
        const stored = await AsyncStorage.getItem(IMPORTED_SMS_REFS_KEY);
        if (stored) {
          const list = JSON.parse(stored) as string[];
          list.forEach((id) => processedRef.current.add(id));
        }

        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECEIVE_SMS,
          PermissionsAndroid.PERMISSIONS.READ_SMS,
        ]);

        const hasRead =
          granted[PermissionsAndroid.PERMISSIONS.READ_SMS] === PermissionsAndroid.RESULTS.GRANTED;
        const hasReceive =
          granted[PermissionsAndroid.PERMISSIONS.RECEIVE_SMS] === PermissionsAndroid.RESULTS.GRANTED;

        if ((!hasRead && !hasReceive) || cancelled) return;

        if (hasRead) {
          await scanInbox();
        }

        if (hasReceive) {
          smsModule.startListening?.();
          subscription = DeviceEventEmitter.addListener("onMomoSmsReceived", (payload: SmsPayload) => {
            void processSmsPayload(payload);
          });
        }

        appStateSub = AppState.addEventListener("change", (nextState) => {
          if (nextState === "active" && hasRead) {
            void scanInbox();
          }
        });
      } catch (err) {
        console.warn("[SMS-SYNC] Erreur initialisation listener Android:", err);
      }
    };

    void setup();

    return () => {
      cancelled = true;
      subscription?.remove();
      appStateSub?.remove();
      smsModule.stopListening?.();
    };
  }, [enabled, user, processSmsPayload]);
}

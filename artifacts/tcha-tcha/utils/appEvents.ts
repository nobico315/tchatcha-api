import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

export type AppEventMap = {
  "transaction:created": { amount: number; operator: string; type: string };
  "sms:imported": { amount: number; operator: string; reference?: string | null };
  "day:opened": { agentId: string };
  "day:closed": { agentId: string };
  "sync:completed": { source: string };
  "subscription:renewed": { reference?: string };
  "pin:reset": { phone: string };
  "agent:added": { phone: string };
};

export type AppEventName = keyof AppEventMap;
type Listener<K extends AppEventName> = (payload: AppEventMap[K]) => void;

const listeners = new Map<AppEventName, Set<Listener<any>>>();

export function onAppEvent<K extends AppEventName>(event: K, listener: Listener<K>): () => void {
  let set = listeners.get(event);
  if (!set) {
    set = new Set();
    listeners.set(event, set);
  }
  set.add(listener);
  return () => {
    set?.delete(listener);
  };
}

export function emitAppEvent<K extends AppEventName>(
  event: K,
  payload: AppEventMap[K],
  haptic: "success" | "light" | "none" = "none"
): void {
  if (Platform.OS !== "web") {
    if (haptic === "success") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else if (haptic === "light") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  }

  const set = listeners.get(event);
  if (!set) return;
  for (const listener of set) {
    try {
      listener(payload);
    } catch (err) {
      console.warn(`[APP-EVENT] Listener error on ${event}:`, err);
    }
  }
}

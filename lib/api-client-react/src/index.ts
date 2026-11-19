export * from "./generated/api";
export * from "./generated/api.schemas";
export * from "./generated/products-api";
import { customFetch, setBaseUrl, setAuthTokenGetter } from "./custom-fetch";
export { setBaseUrl, setAuthTokenGetter, customFetch };
export type { AuthTokenGetter } from "./custom-fetch";

export async function getInviteCode(): Promise<{ code: string; managerName: string; shareMessage: string }> {
  return customFetch("/api/agents/invite-code", { method: "GET" });
}

export async function joinByCode(code: string): Promise<{ success: boolean; message: string; manager?: any; error?: string }> {
  return customFetch("/api/agents/join-by-code", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export interface ApiNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export async function getNotifications(): Promise<ApiNotification[]> {
  return customFetch<ApiNotification[]>("/api/notifications", { method: "GET" });
}

export async function reportLowBalance(operator: "MTN" | "Moov" | "Celtis", balance: number, threshold: 5000 | 10000): Promise<void> {
  await customFetch("/api/notifications/low-balance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ operator, balance, threshold }),
  });
}

export async function markNotificationRead(id: string): Promise<void> {
  await customFetch(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "POST" });
}

export async function markAllNotificationsRead(): Promise<void> {
  await customFetch("/api/notifications/read-all", { method: "POST" });
}



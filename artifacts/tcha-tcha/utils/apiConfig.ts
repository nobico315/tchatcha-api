import { Platform } from "react-native";

export function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, "");
  }
  if (process.env.EXPO_PUBLIC_DOMAIN) {
    return `https://${process.env.EXPO_PUBLIC_DOMAIN}`.replace(/\/+$/, "");
  }
  if (Platform.OS === "android") {
    return "http://10.0.2.2:5001";
  }
  return "http://localhost:5001";
}

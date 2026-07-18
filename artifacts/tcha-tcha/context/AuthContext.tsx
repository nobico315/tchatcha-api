import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { 
  login as apiLogin, 
  register as apiRegister, 
  logout as apiLogout, 
  getMe as apiGetMe, 
  getAgents as apiGetAgents, 
  createAgent as apiCreateAgent, 
  attachAgent as apiAttachAgent
} from "@workspace/api-client-react";

export type Role = "agent" | "gerant";

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  pin?: string;
  role: Role;
  createdAt: string;
  subscriptionExpiry: string;
  managerId?: string | null;
  manager?: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
  } | null;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (phone: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: Omit<User, "id" | "createdAt" | "subscriptionExpiry">) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  getMyAgents: () => Promise<User[]>;
  getUserById: (id: string) => Promise<User | null>;
  addAgentByManager: (data: { firstName: string; lastName: string; phone: string; pin: string }) => Promise<{ success: boolean; error?: string }>;
  attachAgentByManager: (data: { phone: string; pin: string }) => Promise<{ success: boolean; error?: string }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "@tcha_session_token";
const CACHED_USER_KEY = "@tcha_cached_user";
const DEFAULT_TIMEOUT = 30000; // 30 secondes

/**
 * Wraps an async function with a timeout
 */
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = DEFAULT_TIMEOUT,
  timeoutMessage: string = "La demande a dépassé le délai d'attente"
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
    ),
  ]);
}

/**
 * Normalizes error messages for better UX
 */
function normalizeErrorMessage(error: any): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    
    // Timeout errors
    if (msg.includes("timeout") || msg.includes("dépassé")) {
      return "La connexion au serveur est trop lente. Vérifiez votre connexion internet et réessayez.";
    }
    
    // Network errors
    if (msg.includes("network") || msg.includes("fetch")) {
      return "Erreur réseau. Vérifiez votre connexion internet.";
    }
    
    // API errors
    if (msg.includes("http") || msg.includes("400") || msg.includes("401") || msg.includes("500")) {
      return error.message;
    }
    
    return error.message;
  }
  
  if (typeof error === "string") {
    return error;
  }
  
  return "Une erreur inattendue s'est produite. Réessayez.";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const initAuth = async () => {
    try {
      // Load token and cached user in parallel (fast, no network)
      const [token, cached] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(CACHED_USER_KEY),
      ]);

      if (cached) {
        // Show the cached user immediately — no network wait
        setUser(JSON.parse(cached));
      }

      if (token) {
        // Refresh user data in background with a short timeout
        try {
          const fetchedUser = await withTimeout(
            apiGetMe(),
            15000,
            "Timeout de connexion au serveur."
          );
          const normalizedUser: User = {
            id: fetchedUser.id,
            firstName: fetchedUser.firstName,
            lastName: fetchedUser.lastName,
            phone: fetchedUser.phone,
            role: fetchedUser.role as Role,
            createdAt: fetchedUser.createdAt,
            subscriptionExpiry: fetchedUser.subscriptionExpiry,
            managerId: fetchedUser.managerId,
            manager: (fetchedUser as any).manager,
          };
          setUser(normalizedUser);
          await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(normalizedUser));
        } catch (error) {
          // Keep using cached user if network fails — don't log out
          if (!cached) {
            // No cache at all and network failed → force login
            await AsyncStorage.removeItem(TOKEN_KEY);
          }
        }
      }
    } catch {}
    setIsLoading(false);
  };


  useEffect(() => {
    initAuth();
  }, []);

  const login = useCallback(async (phone: string, pin: string) => {
    try {
      const res = await withTimeout(
        apiLogin({ phone, pin }),
        DEFAULT_TIMEOUT,
        "La connexion est trop lente. Vérifiez votre connexion et réessayez."
      );
      
      if (!res.success || !res.token || !res.user) {
        return { success: false, error: normalizeErrorMessage(res.error || "Identifiants invalides.") };
      }
      
      const normalizedUser: User = {
        id: res.user.id,
        firstName: res.user.firstName,
        lastName: res.user.lastName,
        phone: res.user.phone,
        role: res.user.role as Role,
        createdAt: res.user.createdAt,
        subscriptionExpiry: res.user.subscriptionExpiry,
        managerId: res.user.managerId,
        manager: (res.user as any).manager,
      };

      await AsyncStorage.setItem(TOKEN_KEY, res.token);
      await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(normalizedUser));
      setUser(normalizedUser);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: normalizeErrorMessage(err) };
    }
  }, []);

  const register = useCallback(async (data: Omit<User, "id" | "createdAt" | "subscriptionExpiry">) => {
    try {
      const res = await withTimeout(
        apiRegister({
          firstName: data.firstName,
          lastName: data.lastName,
          phone: data.phone,
          pin: data.pin as string,
          role: data.role as "agent" | "gerant",
          managerId: data.managerId || undefined,
        }),
        DEFAULT_TIMEOUT,
        "Création du compte trop lente. Vérifiez votre connexion et réessayez."
      );

      if (!res.success || !res.token || !res.user) {
        return { success: false, error: normalizeErrorMessage(res.error || "Erreur lors de l'inscription.") };
      }

      const normalizedUser: User = {
        id: res.user.id,
        firstName: res.user.firstName,
        lastName: res.user.lastName,
        phone: res.user.phone,
        role: res.user.role as Role,
        createdAt: res.user.createdAt,
        subscriptionExpiry: res.user.subscriptionExpiry,
        managerId: res.user.managerId,
        manager: (res.user as any).manager,
      };

      await AsyncStorage.setItem(TOKEN_KEY, res.token);
      await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(normalizedUser));
      setUser(normalizedUser);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: normalizeErrorMessage(err) };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {}
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(CACHED_USER_KEY);
    setUser(null);
  }, []);

  const updateUser = useCallback(async (updates: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...updates } as User;
    setUser(updated);
    await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(updated));
  }, [user]);

  const getMyAgents = useCallback(async (): Promise<User[]> => {
    try {
      const agents = await apiGetAgents();
      return agents.map((a) => ({
        id: a.id,
        firstName: a.firstName,
        lastName: a.lastName,
        phone: a.phone,
        role: a.role as Role,
        createdAt: a.createdAt,
        subscriptionExpiry: a.subscriptionExpiry,
        managerId: a.managerId,
      }));
    } catch {
      return [];
    }
  }, []);

  const getUserById = useCallback(async (id: string): Promise<User | null> => {
    if (user && user.id === id) return user;
    try {
      const agents = await getMyAgents();
      return agents.find((a) => a.id === id) || null;
    } catch {
      return null;
    }
  }, [user, getMyAgents]);

  const addAgentByManager = useCallback(async (data: { firstName: string; lastName: string; phone: string; pin: string }) => {
    try {
      const res = await apiCreateAgent({
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        pin: data.pin,
      });
      if (res.success) {
        return { success: true };
      }
      return { success: false, error: res.error || "Erreur lors de la création de l'agent." };
    } catch (err: any) {
      return { success: false, error: err.message || "Erreur lors de la connexion." };
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (token) {
        const fetchedUser = await withTimeout(
          apiGetMe(),
          15000,
          "Timeout de connexion au serveur."
        );
        const normalizedUser: User = {
          id: fetchedUser.id,
          firstName: fetchedUser.firstName,
          lastName: fetchedUser.lastName,
          phone: fetchedUser.phone,
          role: fetchedUser.role as Role,
          createdAt: fetchedUser.createdAt,
          subscriptionExpiry: fetchedUser.subscriptionExpiry,
          managerId: fetchedUser.managerId,
          manager: (fetchedUser as any).manager,
        };
        setUser(normalizedUser);
        await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(normalizedUser));
      }
    } catch {}
  }, []);

  const attachAgentByManager = useCallback(async (data: { phone: string; pin: string }) => {
    try {
      const res = await apiAttachAgent({
        phone: data.phone,
        pin: data.pin,
      });
      if (res.success) {
        return { success: true };
      }
      return { success: false, error: res.error || "Erreur lors du rattachement." };
    } catch (err: any) {
      return { success: false, error: err.message || "Erreur lors de la connexion." };
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      user, isLoading, login, register, logout, updateUser,
      getMyAgents, getUserById, addAgentByManager, attachAgentByManager,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}


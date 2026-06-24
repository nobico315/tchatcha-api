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
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "@tcha_session_token";
const CACHED_USER_KEY = "@tcha_cached_user";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const initAuth = async () => {
    try {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (token) {
        try {
          const fetchedUser = await apiGetMe();
          const normalizedUser: User = {
            id: fetchedUser.id,
            firstName: fetchedUser.firstName,
            lastName: fetchedUser.lastName,
            phone: fetchedUser.phone,
            role: fetchedUser.role as Role,
            createdAt: fetchedUser.createdAt,
            subscriptionExpiry: fetchedUser.subscriptionExpiry,
            managerId: fetchedUser.managerId,
          };
          setUser(normalizedUser);
          await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(normalizedUser));
        } catch (error) {
          const cached = await AsyncStorage.getItem(CACHED_USER_KEY);
          if (cached) {
            setUser(JSON.parse(cached));
          } else {
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
      const res = await apiLogin({ phone, pin });
      if (!res.success || !res.token || !res.user) {
        return { success: false, error: res.error || "Identifiants invalides." };
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
      };

      await AsyncStorage.setItem(TOKEN_KEY, res.token);
      await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(normalizedUser));
      setUser(normalizedUser);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Erreur de connexion au serveur." };
    }
  }, []);

  const register = useCallback(async (data: Omit<User, "id" | "createdAt" | "subscriptionExpiry">) => {
    try {
      const res = await apiRegister({
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        pin: data.pin as string,
        role: data.role as "agent" | "gerant",
        managerId: data.managerId || undefined,
      });

      if (!res.success || !res.token || !res.user) {
        return { success: false, error: res.error || "Erreur lors de l'inscription." };
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
      };

      await AsyncStorage.setItem(TOKEN_KEY, res.token);
      await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(normalizedUser));
      setUser(normalizedUser);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || "Erreur de connexion au serveur." };
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


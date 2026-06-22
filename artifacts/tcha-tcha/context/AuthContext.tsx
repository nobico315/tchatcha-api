import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Role = "agent" | "gerant";

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  pin: string;
  role: Role;
  createdAt: string;
  subscriptionExpiry: string;
  managerId?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (phone: string, pin: string) => Promise<{ success: boolean; error?: string }>;
  register: (data: Omit<User, "id" | "createdAt" | "subscriptionExpiry">) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => Promise<void>;
  getAgents: () => Promise<User[]>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const USERS_KEY = "@tcha_users";
const SESSION_KEY = "@tcha_session";

function generateId(): string {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const sessionId = await AsyncStorage.getItem(SESSION_KEY);
        if (sessionId) {
          const usersJson = await AsyncStorage.getItem(USERS_KEY);
          const users: User[] = usersJson ? JSON.parse(usersJson) : [];
          const found = users.find((u) => u.id === sessionId);
          if (found) setUser(found);
        }
      } catch {}
      setIsLoading(false);
    })();
  }, []);

  const getUsers = async (): Promise<User[]> => {
    const json = await AsyncStorage.getItem(USERS_KEY);
    return json ? JSON.parse(json) : [];
  };

  const saveUsers = async (users: User[]) => {
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
  };

  const login = useCallback(async (phone: string, pin: string) => {
    const users = await getUsers();
    const found = users.find((u) => u.phone === phone && u.pin === pin);
    if (!found) return { success: false, error: "Numéro ou code PIN incorrect." };
    await AsyncStorage.setItem(SESSION_KEY, found.id);
    setUser(found);
    return { success: true };
  }, []);

  const register = useCallback(async (data: Omit<User, "id" | "createdAt" | "subscriptionExpiry">) => {
    const users = await getUsers();
    if (users.find((u) => u.phone === data.phone)) {
      return { success: false, error: "Ce numéro est déjà utilisé." };
    }
    const newUser: User = {
      ...data,
      id: generateId(),
      createdAt: new Date().toISOString(),
      subscriptionExpiry: addDays(30),
    };
    await saveUsers([...users, newUser]);
    await AsyncStorage.setItem(SESSION_KEY, newUser.id);
    setUser(newUser);
    return { success: true };
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
    setUser(null);
  }, []);

  const updateUser = useCallback(async (updates: Partial<User>) => {
    if (!user) return;
    const users = await getUsers();
    const updated = users.map((u) => (u.id === user.id ? { ...u, ...updates } : u));
    await saveUsers(updated);
    setUser((prev) => (prev ? { ...prev, ...updates } : prev));
  }, [user]);

  const getAgents = useCallback(async (): Promise<User[]> => {
    const users = await getUsers();
    return users.filter((u) => u.role === "agent" && (user?.role === "gerant"));
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, updateUser, getAgents }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

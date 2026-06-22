import { BarChart2, Home, List, Plus, User, Users } from "lucide-react-native";
import { router, Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

function CustomTabBar({ state, descriptors, navigation }: any) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const isGerant = user?.role === "gerant";

  const agentRoutes = ["index", "transactions", "fab", "rapport", "profile"];
  const gerantRoutes = ["index", "equipe", "fab", "rapport", "profile"];
  const routes = isGerant ? gerantRoutes : agentRoutes;

  const labels: Record<string, string> = {
    index: "Accueil",
    transactions: "Transactions",
    rapport: "Rapport",
    profile: "Profil",
    equipe: "Équipe",
  };

  const icons: Record<string, (active: boolean) => React.ReactNode> = {
    index: (a) => <Home size={22} color={a ? colors.primary : colors.muted} strokeWidth={a ? 2.5 : 1.8} />,
    transactions: (a) => <List size={22} color={a ? colors.primary : colors.muted} strokeWidth={a ? 2.5 : 1.8} />,
    rapport: (a) => <BarChart2 size={22} color={a ? colors.primary : colors.muted} strokeWidth={a ? 2.5 : 1.8} />,
    profile: (a) => <User size={22} color={a ? colors.primary : colors.muted} strokeWidth={a ? 2.5 : 1.8} />,
    equipe: (a) => <Users size={22} color={a ? colors.primary : colors.muted} strokeWidth={a ? 2.5 : 1.8} />,
  };

  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.tabBar, { paddingBottom: bottomPad }]}>
      {routes.map((routeName) => {
        if (routeName === "fab") {
          return (
            <TouchableOpacity key="fab" style={styles.fabWrap} onPress={() => router.push("/new-transaction")} activeOpacity={0.85}>
              <View style={styles.fab}>
                <Plus size={26} color="#FFD700" strokeWidth={2.5} />
              </View>
            </TouchableOpacity>
          );
        }

        const tabIndex = state.routes.findIndex((r: any) => r.name === routeName);
        const isFocused = state.index === tabIndex;

        const onPress = () => {
          if (tabIndex < 0) return;
          const event = navigation.emit({ type: "tabPress", target: state.routes[tabIndex].key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(state.routes[tabIndex].name);
          }
        };

        return (
          <TouchableOpacity key={routeName} style={styles.tab} onPress={onPress} activeOpacity={0.7}>
            {icons[routeName]?.(isFocused)}
            <Text style={[styles.tabLabel, { color: isFocused ? colors.primary : colors.muted, fontFamily: isFocused ? "Poppins_700Bold" : "Poppins_400Regular" }]}>
              {labels[routeName]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <CustomTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="transactions" />
      <Tabs.Screen name="rapport" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="equipe" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
    paddingTop: 10,
    paddingHorizontal: 8,
  },
  tab: { flex: 1, alignItems: "center", gap: 3, paddingBottom: 4 },
  tabLabel: { fontSize: 11 },
  fabWrap: { flex: 1, alignItems: "center", justifyContent: "center", marginTop: -20 },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#191970",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#191970",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
});

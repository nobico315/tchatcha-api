import {
  Poppins_400Regular,
  Poppins_600SemiBold,
  Poppins_700Bold,
  useFonts,
} from "@expo-google-fonts/poppins";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setBaseUrl, setAuthTokenGetter } from "@workspace/api-client-react";
import { getApiBaseUrl } from "@/utils/apiConfig";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/context/AuthContext";
import { TransactionProvider } from "@/context/TransactionContext";
import { AlertProvider } from "@/context/AlertContext";
import { ProductProvider } from "@/context/ProductContext";

SplashScreen.preventAutoHideAsync();

const apiHost = getApiBaseUrl();

setBaseUrl(apiHost);
setAuthTokenGetter(async () => {
  return AsyncStorage.getItem("@tcha_session_token");
});

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="new-transaction" options={{ presentation: "modal" }} />
      <Stack.Screen name="ouvrir-journee" options={{ presentation: "modal" }} />
      <Stack.Screen name="fermer-journee" options={{ presentation: "modal" }} />
      <Stack.Screen name="alerts" options={{ presentation: "modal" }} />
      <Stack.Screen name="abonnement" options={{ presentation: "modal" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Réveille silencieusement le serveur Render dès l'ouverture de l'app
  useEffect(() => {
    if (apiHost) {
      fetch(apiHost).catch(() => {});
    }
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <TransactionProvider>
              <ProductProvider>
                <AlertProvider>
                  <GestureHandlerRootView>
                    <KeyboardProvider>
                      <RootLayoutNav />
                    </KeyboardProvider>
                  </GestureHandlerRootView>
                </AlertProvider>
              </ProductProvider>
            </TransactionProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

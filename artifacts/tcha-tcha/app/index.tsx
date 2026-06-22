import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useAuth } from "@/context/AuthContext";

export default function Index() {
  const { user, isLoading } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem("@onboarding_done").then((v) => setOnboardingDone(v === "true"));
  }, []);

  if (isLoading || onboardingDone === null) return <View style={{ flex: 1, backgroundColor: "#191970" }} />;
  if (!onboardingDone) return <Redirect href="/onboarding" />;
  if (!user) return <Redirect href="/(auth)/login" />;
  return <Redirect href="/(tabs)" />;
}

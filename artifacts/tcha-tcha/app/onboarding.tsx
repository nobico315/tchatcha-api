import AsyncStorage from "@react-native-async-storage/async-storage";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

const slides = [
  {
    image: require("../assets/images/onboarding1.png"),
    title: "Gérez votre argent mobile.",
    desc: "Enregistrez chaque dépôt et retrait en quelques secondes, même sans connexion internet.",
  },
  {
    image: require("../assets/images/onboarding2.png"),
    title: "Votre solde, toujours à jour.",
    desc: "Suivez votre solde flottant en temps réel et recevez des alertes avant de tomber à court.",
  },
  {
    image: require("../assets/images/onboarding3.png"),
    title: "Des rapports clairs chaque jour.",
    desc: "Consultez vos performances journalières et exportez vos rapports en un tap.",
  },
];

export default function Onboarding() {
  const [current, setCurrent] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();

  const goNext = async () => {
    if (current < slides.length - 1) {
      scrollRef.current?.scrollTo({ x: (current + 1) * width, animated: true });
      setCurrent(current + 1);
    } else {
      await AsyncStorage.setItem("@onboarding_done", "true");
      router.replace("/(auth)/login");
    }
  };

  const skip = async () => {
    await AsyncStorage.setItem("@onboarding_done", "true");
    router.replace("/(auth)/login");
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const page = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrent(page);
        }}
      >
        {slides.map((slide, i) => (
          <View key={i} style={[styles.slide, { width }]}>
            <Image source={slide.image} style={StyleSheet.absoluteFill} contentFit="cover" />
            {Platform.OS !== "web" && (
              <BlurView intensity={60} style={StyleSheet.absoluteFill} />
            )}
            <LinearGradient
              colors={["transparent", "rgba(25,25,112,0.85)"]}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ))}
      </ScrollView>

      <View style={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.textArea}>
          <Text style={styles.title}>{slides[current].title}</Text>
          <Text style={styles.desc}>{slides[current].desc}</Text>
        </View>

        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, { backgroundColor: i === current ? "#FFD700" : "rgba(255,255,255,0.4)" }]} />
          ))}
        </View>

        <View style={styles.buttons}>
          <TouchableOpacity onPress={skip}>
            <Text style={styles.skip}>Ignorer</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.nextBtn} onPress={goNext}>
            <Text style={styles.nextLabel}>
              {current === slides.length - 1 ? "Commencer" : "Suivant"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#191970" },
  slide: { flex: 1, height: "100%" },
  content: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    gap: 24,
  },
  textArea: { gap: 12 },
  title: { color: "#FFFFFF", fontSize: 24, fontFamily: "Poppins_700Bold", lineHeight: 34 },
  desc: { color: "rgba(255,255,255,0.85)", fontSize: 14, fontFamily: "Poppins_400Regular", lineHeight: 22 },
  dots: { flexDirection: "row", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  buttons: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  skip: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "Poppins_400Regular" },
  nextBtn: {
    backgroundColor: "#FFD700",
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  nextLabel: { color: "#191970", fontFamily: "Poppins_700Bold", fontSize: 14 },
});

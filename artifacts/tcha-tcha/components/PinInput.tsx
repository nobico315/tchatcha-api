import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

interface PinInputProps {
  value: string;
  onChange: (val: string) => void;
  length?: number;
  masked?: boolean;
  focusKey?: number;
  /** Deprecated: Now uses native system keyboard. Left for compatibility. */
  showKeypad?: boolean;
}

const MAX_SLOT_SIZE = 52;
const MIN_GAP = 8;
const MAX_GAP = 12;
const CONTAINER_HORIZONTAL_PADDING = 32;
const REVEAL_DURATION = 350; // ms pendant lesquels le chiffre reste visible avant le masquage

export function PinInput({ value, onChange, length = 6, masked = true, focusKey }: PinInputProps) {
  const colors = useColors();
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isInputFocused, setIsInputFocused] = useState(false);

  useEffect(() => {
    if (focusKey && focusKey > 0) {
      inputRef.current?.focus();
    }
  }, [focusKey]);

  // Index du dernier chiffre saisi, encore visible temporairement
  const [revealIndex, setRevealIndex] = useState<number | null>(null);
  const revealTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePress = () => {
    inputRef.current?.focus();
  };

  const handleChangeText = (text: string) => {
    const cleanText = text.replace(/[^0-9]/g, "");
    if (cleanText.length <= length) {
      if (cleanText.length > value.length) {
        Vibration.vibrate(10);

        // Révèle brièvement le dernier chiffre tapé, puis le masque
        const newDigitIndex = cleanText.length - 1;
        setRevealIndex(newDigitIndex);
        if (revealTimeout.current) clearTimeout(revealTimeout.current);
        revealTimeout.current = setTimeout(() => {
          setRevealIndex(null);
        }, REVEAL_DURATION);
      } else {
        // Suppression : on annule toute révélation en cours
        if (revealTimeout.current) clearTimeout(revealTimeout.current);
        setRevealIndex(null);
      }
      onChange(cleanText);
    }
  };

  useEffect(() => {
    return () => {
      if (revealTimeout.current) clearTimeout(revealTimeout.current);
    };
  }, []);

  const gap = MIN_GAP;
  const availableWidth = containerWidth - CONTAINER_HORIZONTAL_PADDING;
  const rawSlotSize =
    length > 0
      ? (availableWidth - gap * (length - 1)) / length
      : MAX_SLOT_SIZE;
  const slotWidth = Math.max(32, Math.min(MAX_SLOT_SIZE, rawSlotSize));
  const slotHeight = slotWidth * 1.18;
  const effectiveGap = Math.max(
    MIN_GAP,
    Math.min(MAX_GAP, rawSlotSize > MAX_SLOT_SIZE ? MAX_GAP : gap)
  );

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={handlePress}
      style={styles.container}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={value}
        onChangeText={handleChangeText}
        onFocus={() => setIsInputFocused(true)}
        onBlur={() => setIsInputFocused(false)}
        keyboardType="number-pad"
        maxLength={length}
        caretHidden
        secureTextEntry={masked}
        autoComplete="one-time-code"
        importantForAutofill="no"
      />

      {containerWidth > 0 && (
        <View style={[styles.slotsRow, { gap: effectiveGap }]}>
          {Array.from({ length }).map((_, i) => {
            const isFilled = i < value.length;
            const isFocused = isInputFocused && i === value.length;
            const isRevealing = isFilled && (!masked || i === revealIndex);

            return (
              <Slot
                key={i}
                digit={value[i]}
                isFilled={isFilled}
                isFocused={isFocused}
                isRevealing={isRevealing}
                colors={colors}
                width={slotWidth}
                height={slotHeight}
              />
            );
          })}
        </View>
      )}
    </TouchableOpacity>
  );
}

function Slot({
  digit,
  isFilled,
  isFocused,
  isRevealing,
  colors,
  width,
  height,
}: {
  digit?: string;
  isFilled: boolean;
  isFocused: boolean;
  isRevealing: boolean;
  colors: ReturnType<typeof useColors>;
  width: number;
  height: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const cursorOpacity = useRef(new Animated.Value(1)).current;
  // Transition croisée chiffre -> point
  const revealAnim = useRef(new Animated.Value(0)).current;

  // Pop animation quand un chiffre arrive dans ce slot
  useEffect(() => {
    if (isFilled) {
      scale.setValue(0.82);
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 140,
        useNativeDriver: true,
      }).start();
    }
  }, [isFilled]);

  // Fondu enchaîné entre le chiffre (révélé) et le point (masqué)
  useEffect(() => {
    Animated.timing(revealAnim, {
      toValue: isRevealing ? 1 : 0,
      duration: isRevealing ? 80 : 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [isRevealing]);

  // Curseur clignotant sur le slot actif
  useEffect(() => {
    if (!isFocused) return;
    cursorOpacity.setValue(1);
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, {
          toValue: 0,
          duration: 500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(cursorOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );
    blink.start();
    return () => blink.stop();
  }, [isFocused]);

  return (
    <Animated.View
      style={[
        styles.slot,
        {
          width,
          height,
          borderRadius: Math.min(14, width * 0.28),
          borderColor: isFocused
            ? colors.primary
            : isFilled
            ? "rgba(25, 25, 112, 0.4)"
            : colors.border,
          backgroundColor: isFocused
            ? "rgba(25, 25, 112, 0.02)"
            : colors.input,
          shadowColor: isFocused ? colors.primary : "transparent",
          shadowOpacity: isFocused ? 0.18 : 0,
          shadowRadius: isFocused ? 6 : 0,
          elevation: isFocused ? 3 : 0,
          transform: [{ scale: isFilled ? scale : 1 }],
        },
      ]}
    >
      {isFilled ? (
        <View style={styles.filledStack}>
          {/* Chiffre : visible brièvement à la saisie */}
          <Animated.Text
            style={[
              styles.digitText,
              {
                color: colors.primary,
                opacity: revealAnim,
                transform: [
                  {
                    scale: revealAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {digit}
          </Animated.Text>

          {/* Point : état masqué par défaut */}
          <Animated.View
            style={[
              styles.dot,
              {
                backgroundColor: colors.primary,
                width: Math.max(6, width * 0.16),
                height: Math.max(6, width * 0.16),
                borderRadius: Math.max(3, width * 0.08),
                opacity: revealAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0],
                }),
                transform: [
                  {
                    scale: revealAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 0.6],
                    }),
                  },
                ],
              },
            ]}
          />
        </View>
      ) : isFocused ? (
        <Animated.View
          style={[
            styles.cursor,
            {
              backgroundColor: colors.primary,
              opacity: cursorOpacity,
              height: height * 0.32,
            },
          ]}
        />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  hiddenInput: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
  slotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  slot: {
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 3 },
  },
  filledStack: {
    alignItems: "center",
    justifyContent: "center",
  },
  digitText: {
    position: "absolute",
    fontSize: 22,
    fontFamily: "Poppins_700Bold",
    lineHeight: 26,
    textAlign: "center",
  },
  dot: {
    position: "absolute",
  },
  cursor: {
    width: 2,
    borderRadius: 1,
  },
});
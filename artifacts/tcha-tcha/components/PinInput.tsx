import React, { useRef } from "react";
import {
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
  /** Deprecated: Now uses native system keyboard. Left for compatibility. */
  showKeypad?: boolean;
}

export function PinInput({ value, onChange, length = 6 }: PinInputProps) {
  const colors = useColors();
  const inputRef = useRef<TextInput>(null);

  const handlePress = () => {
    inputRef.current?.focus();
  };

  const handleChangeText = (text: string) => {
    // Only allow numbers
    const cleanText = text.replace(/[^0-9]/g, "");
    if (cleanText.length <= length) {
      if (cleanText.length > value.length) {
        // Soft haptic feedback on keypress
        Vibration.vibrate(10);
      }
      onChange(cleanText);
    }
  };

  return (
    <TouchableOpacity 
      activeOpacity={0.95} 
      onPress={handlePress} 
      style={styles.container}
    >
      {/* Hidden TextInput to drive the keyboard */}
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={value}
        onChangeText={handleChangeText}
        keyboardType="number-pad"
        maxLength={length}
        caretHidden
        autoComplete="one-time-code"
        importantForAutofill="no"
      />

      {/* Styled Slots Row */}
      <View style={styles.slotsRow}>
        {Array.from({ length }).map((_, i) => {
          const isFilled = i < value.length;
          const isFocused = i === value.length;

          return (
            <View
              key={i}
              style={[
                styles.slot,
                {
                  borderColor: isFocused 
                    ? colors.primary 
                    : isFilled 
                    ? "rgba(25, 25, 112, 0.4)" 
                    : colors.border,
                  backgroundColor: isFocused 
                    ? "rgba(25, 25, 112, 0.02)" 
                    : colors.input,
                  shadowColor: isFocused ? colors.primary : "transparent",
                  shadowOpacity: isFocused ? 0.15 : 0,
                  shadowRadius: 4,
                  elevation: isFocused ? 2 : 0,
                },
              ]}
            >
              {isFilled ? (
                <Text style={[styles.dotText, { color: colors.primary }]}>•</Text>
              ) : isFocused ? (
                <View style={[styles.cursor, { backgroundColor: colors.primary }]} />
              ) : null}
            </View>
          );
        })}
      </View>
    </TouchableOpacity>
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
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  slot: {
    width: 44,
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 2 },
  },
  dotText: {
    fontSize: 28,
    fontFamily: "Poppins_700Bold",
    lineHeight: 34,
    textAlign: "center",
  },
  cursor: {
    width: 2,
    height: 16,
    borderRadius: 1,
  },
});
